-- ============================================================================
-- SMART OUTPASS SECURITY SYSTEM - SUPABASE DATABASE SCHEMA
-- PostgreSQL schema for Supabase with Realtime, RLS, triggers & seed data
-- ============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE staff_role_enum AS ENUM ('ADMIN', 'COORDINATOR', 'TEACHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE student_status_enum AS ENUM ('INSIDE', 'OUTSIDE_ACTIVE', 'OVERDUE', 'PENDING_VERIFICATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE movement_status_enum AS ENUM ('ACTIVE', 'RETURNED_ON_TIME', 'OVERDUE', 'RESOLVED_APPROVED', 'RESOLVED_REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE overdue_reason_enum AS ENUM ('NONE', 'TEACHER', 'COORDINATOR', 'INFIRMARY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gate_policy_enum AS ENUM ('WAIT_FOR_APPROVAL', 'ALLOW_ENTRY_AFTER_REASON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE device_command_enum AS ENUM ('NONE', 'OPEN_GATE', 'REJECT_BUZZER', 'CLEAR_SOS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sos_status_enum AS ENUM ('ACTIVE', 'ACKNOWLEDGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_source_enum AS ENUM ('ESP32_PHYSICAL', 'SIMULATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allowed_duration_sec INTEGER NOT NULL DEFAULT 60,
    gate_policy_on_overdue gate_policy_enum NOT NULL DEFAULT 'WAIT_FOR_APPROVAL',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role staff_role_enum NOT NULL,
    keypad_code TEXT UNIQUE, -- e.g. "01", "02", "03" for teachers
    notification_chat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    roll_no TEXT NOT NULL UNIQUE,
    class_section TEXT NOT NULL,
    rfid_uid TEXT NOT NULL UNIQUE,
    current_status student_status_enum NOT NULL DEFAULT 'INSIDE',
    parent_name TEXT NOT NULL,
    parent_contact TEXT NOT NULL,
    parent_chat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Movement Logs Table
CREATE TABLE IF NOT EXISTS movement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exit_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    allowed_duration_sec INTEGER NOT NULL DEFAULT 60,
    return_time TIMESTAMPTZ,
    status movement_status_enum NOT NULL DEFAULT 'ACTIVE',
    overdue_reason overdue_reason_enum NOT NULL DEFAULT 'NONE',
    reason_notes TEXT,
    target_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    verified_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    verification_status verification_status_enum NOT NULL DEFAULT 'NOT_REQUIRED',
    verified_at TIMESTAMPTZ,
    parent_notified BOOLEAN NOT NULL DEFAULT FALSE,
    parent_notified_at TIMESTAMPTZ,
    source event_source_enum NOT NULL DEFAULT 'ESP32_PHYSICAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Device Status Table
CREATE TABLE IF NOT EXISTS device_status (
    device_id TEXT PRIMARY KEY,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT DEFAULT '192.168.1.100',
    uptime_sec BIGINT DEFAULT 0,
    pending_command device_command_enum NOT NULL DEFAULT 'NONE',
    lcd2_summary_text TEXT DEFAULT 'Out: 0 | Late: 0',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SOS Alerts Table
CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL DEFAULT 'DOOR_NODE_01',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status sos_status_enum NOT NULL DEFAULT 'ACTIVE',
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    source event_source_enum NOT NULL DEFAULT 'ESP32_PHYSICAL'
);

-- 8. Notification Logs Table (Explicit 200 OK delivery auditing)
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_log_id UUID REFERENCES movement_logs(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL, -- 'PARENT', 'COORDINATOR', 'TEACHER'
    recipient_identifier TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'TELEGRAM', 'EMAIL', 'SYSTEM_LOG'
    message_content TEXT NOT NULL,
    status_code INTEGER NOT NULL, -- e.g. 200
    status_response TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_students_rfid ON students(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(current_status);
CREATE INDEX IF NOT EXISTS idx_movement_student_status ON movement_logs(student_id, status);
CREATE INDEX IF NOT EXISTS idx_movement_verification ON movement_logs(verification_status, target_staff_id);
CREATE INDEX IF NOT EXISTS idx_movement_exit_time ON movement_logs(exit_time);
CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_alerts(status);

-- 10. Auto-Update Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_students_updated_at ON students;
CREATE TRIGGER trigger_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_movement_logs_updated_at ON movement_logs;
CREATE TRIGGER trigger_movement_logs_updated_at
BEFORE UPDATE ON movement_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 11. Overdue Auto-check Function (Can be called by cron or heartbeat API)
CREATE OR REPLACE FUNCTION check_overdue_students()
RETURNS TABLE (
    updated_movement_id UUID,
    student_name TEXT,
    elapsed_seconds NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH expired AS (
        UPDATE movement_logs
        SET status = 'OVERDUE'
        WHERE status = 'ACTIVE'
          AND EXTRACT(EPOCH FROM (NOW() - exit_time)) > allowed_duration_sec
        RETURNING id, student_id, exit_time
    ),
    update_students AS (
        UPDATE students s
        SET current_status = 'OVERDUE'
        FROM expired e
        WHERE s.id = e.student_id
          AND s.current_status = 'OUTSIDE_ACTIVE'
        RETURNING s.id, s.name, e.id AS m_id, e.exit_time
    )
    SELECT 
        update_students.m_id AS updated_movement_id,
        update_students.name AS student_name,
        ROUND(EXTRACT(EPOCH FROM (NOW() - update_students.exit_time))) AS elapsed_seconds
    FROM update_students;
END;
$$ LANGUAGE plpgsql;

-- 12. Enable Row Level Security (RLS) & Allow Anonymous Read/Write for IoT Service & Demo
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for demo & full-stack IoT interaction
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public access system_settings" ON system_settings;
    CREATE POLICY "Public access system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access staff" ON staff;
    CREATE POLICY "Public access staff" ON staff FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access students" ON students;
    CREATE POLICY "Public access students" ON students FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access movement_logs" ON movement_logs;
    CREATE POLICY "Public access movement_logs" ON movement_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access device_status" ON device_status;
    CREATE POLICY "Public access device_status" ON device_status FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access sos_alerts" ON sos_alerts;
    CREATE POLICY "Public access sos_alerts" ON sos_alerts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access notification_logs" ON notification_logs;
    CREATE POLICY "Public access notification_logs" ON notification_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 13. Enable Supabase Realtime Publication
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE students;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE movement_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE device_status;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE sos_alerts;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- A. Default System Settings
INSERT INTO system_settings (id, allowed_duration_sec, gate_policy_on_overdue)
VALUES ('00000000-0000-0000-0000-000000000001', 60, 'WAIT_FOR_APPROVAL')
ON CONFLICT (id) DO UPDATE 
SET allowed_duration_sec = 60, gate_policy_on_overdue = 'WAIT_FOR_APPROVAL';

-- B. Staff (3 Teachers, 1 Coordinator, 1 Admin)
INSERT INTO staff (id, name, email, role, keypad_code, notification_chat_id)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'Mr. Robert Sharma (Math)', 'sharma@school.edu', 'TEACHER', '01', 'tg_staff_01'),
    ('11111111-1111-1111-1111-111111111102', 'Ms. Sarah Davis (Science)', 'davis@school.edu', 'TEACHER', '02', 'tg_staff_02'),
    ('11111111-1111-1111-1111-111111111103', 'Dr. Anand Rao (English)', 'rao@school.edu', 'TEACHER', '03', 'tg_staff_03'),
    ('11111111-1111-1111-1111-111111111104', 'Mrs. Eleanor Jenkins (Head Coordinator)', 'jenkins.coord@school.edu', 'COORDINATOR', '99', 'tg_coord_99'),
    ('11111111-1111-1111-1111-111111111105', 'Principal Arthur Miller (Admin)', 'miller.admin@school.edu', 'ADMIN', '00', 'tg_admin_00')
ON CONFLICT (email) DO NOTHING;

-- C. Students (4 sample students with test RFID UIDs)
INSERT INTO students (id, name, roll_no, class_section, rfid_uid, current_status, parent_name, parent_contact, parent_chat_id)
VALUES
    ('22222222-2222-2222-2222-222222222201', 'Aryan Patel', '10-A-04', 'Class 10-A', 'E2806894', 'INSIDE', 'Vikram Patel', '+1 (555) 234-5678', 'tg_parent_aryan'),
    ('22222222-2222-2222-2222-222222222202', 'Chloe Zhao', '10-A-12', 'Class 10-A', '43B1A289', 'INSIDE', 'Mei Zhao', '+1 (555) 345-6789', 'tg_parent_chloe'),
    ('22222222-2222-2222-2222-222222222203', 'Liam O''Connor', '10-A-19', 'Class 10-A', 'A1B2C3D4', 'INSIDE', 'Sean O''Connor', '+1 (555) 456-7890', 'tg_parent_liam'),
    ('22222222-2222-2222-2222-222222222204', 'Zara Al-Mansoor', '10-A-28', 'Class 10-A', '9876FEDC', 'INSIDE', 'Tariq Al-Mansoor', '+1 (555) 567-8901', 'tg_parent_zara')
ON CONFLICT (roll_no) DO NOTHING;

-- D. Initial Device Status
INSERT INTO device_status (device_id, last_heartbeat, ip_address, uptime_sec, pending_command, lcd2_summary_text)
VALUES ('DOOR_NODE_01', NOW(), '192.168.1.100', 120, 'NONE', 'Out: 0 | Late: 0')
ON CONFLICT (device_id) DO UPDATE
SET last_heartbeat = NOW(), lcd2_summary_text = 'Out: 0 | Late: 0';
