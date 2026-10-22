// ============================================================================
// Database Service Layer (Supabase PostgreSQL + In-Memory Fallback Store)
// Bridges Next.js API Routes and Client Views directly with Supabase.
// ============================================================================

import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import {
  SystemSettings,
  Staff,
  Student,
  MovementLog,
  DeviceStatus,
  SosAlert,
  NotificationLog,
  StudentStatus,
  DeviceCommand,
  GatePolicy,
} from './types';

// Initial Seed Data (matches schema.sql)
let localSettings: SystemSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  allowed_duration_sec: 60,
  gate_policy_on_overdue: 'WAIT_FOR_APPROVAL',
  updated_at: new Date().toISOString(),
};

let localStaff: Staff[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Mr. Robert Sharma (Math)',
    email: 'sharma@school.edu',
    role: 'TEACHER',
    keypad_code: '01',
    notification_chat_id: 'tg_staff_01',
    created_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Ms. Sarah Davis (Science)',
    email: 'davis@school.edu',
    role: 'TEACHER',
    keypad_code: '02',
    notification_chat_id: 'tg_staff_02',
    created_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Dr. Anand Rao (English)',
    email: 'rao@school.edu',
    role: 'TEACHER',
    keypad_code: '03',
    notification_chat_id: 'tg_staff_03',
    created_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Mrs. Eleanor Jenkins (Head Coordinator)',
    email: 'jenkins.coord@school.edu',
    role: 'COORDINATOR',
    keypad_code: '99',
    notification_chat_id: 'tg_coord_99',
    created_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Principal Arthur Miller (Admin)',
    email: 'miller.admin@school.edu',
    role: 'ADMIN',
    keypad_code: '00',
    notification_chat_id: 'tg_admin_00',
    created_at: new Date().toISOString(),
  },
];

let localStudents: Student[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    name: 'Aryan Patel',
    roll_no: '10-A-04',
    class_section: 'Class 10-A',
    rfid_uid: 'E2806894',
    current_status: 'INSIDE',
    parent_name: 'Vikram Patel',
    parent_contact: '+1 (555) 234-5678',
    parent_chat_id: 'tg_parent_aryan',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    name: 'Chloe Zhao',
    roll_no: '10-A-12',
    class_section: 'Class 10-A',
    rfid_uid: '43B1A289',
    current_status: 'INSIDE',
    parent_name: 'Mei Zhao',
    parent_contact: '+1 (555) 345-6789',
    parent_chat_id: 'tg_parent_chloe',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    name: 'Liam O\'Connor',
    roll_no: '10-A-19',
    class_section: 'Class 10-A',
    rfid_uid: 'A1B2C3D4',
    current_status: 'INSIDE',
    parent_name: 'Sean O\'Connor',
    parent_contact: '+1 (555) 456-7890',
    parent_chat_id: 'tg_parent_liam',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    name: 'Zara Al-Mansoor',
    roll_no: '10-A-28',
    class_section: 'Class 10-A',
    rfid_uid: '9876FEDC',
    current_status: 'INSIDE',
    parent_name: 'Tariq Al-Mansoor',
    parent_contact: '+1 (555) 567-8901',
    parent_chat_id: 'tg_parent_zara',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let localMovementLogs: MovementLog[] = [];

let localDeviceStatus: Record<string, DeviceStatus> = {
  DOOR_NODE_01: {
    device_id: 'DOOR_NODE_01',
    last_heartbeat: new Date().toISOString(),
    ip_address: '192.168.1.100',
    uptime_sec: 120,
    pending_command: 'NONE',
    lcd2_summary_text: 'Out: 0 | Late: 0',
    updated_at: new Date().toISOString(),
  },
};

let localSosAlerts: SosAlert[] = [];
let localNotificationLogs: NotificationLog[] = [];

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

export async function getSystemSettings(): Promise<SystemSettings> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();
    if (!error && data) return data as SystemSettings;
  }
  return localSettings;
}

export async function updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
  localSettings = { ...localSettings, ...updates, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .update(updates)
      .eq('id', localSettings.id)
      .select()
      .single();
    if (!error && data) return data as SystemSettings;
  }
  return localSettings;
}

// ============================================================================
// STAFF
// ============================================================================

export async function getAllStaff(): Promise<Staff[]> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('*')
      .order('name');
    if (!error && data) return data as Staff[];
  }
  return localStaff;
}

export async function getStaffByCode(code: string): Promise<Staff | null> {
  const normalized = code.trim().padStart(2, '0');
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('keypad_code', normalized)
      .maybeSingle();
    if (!error && data) return data as Staff;
  }
  return localStaff.find((s) => s.keypad_code === normalized) || null;
}

export async function getStaffById(id: string): Promise<Staff | null> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data as Staff;
  }
  return localStaff.find((s) => s.id === id) || null;
}

export async function saveStaff(staff: Omit<Staff, 'id' | 'created_at'> & { id?: string }): Promise<Staff> {
  const id = staff.id || `staff-${Date.now()}`;
  const record: Staff = {
    id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    keypad_code: staff.keypad_code || null,
    notification_chat_id: staff.notification_chat_id || null,
    created_at: new Date().toISOString(),
  };

  const existingIdx = localStaff.findIndex((s) => s.id === id || s.email === staff.email);
  if (existingIdx >= 0) {
    localStaff[existingIdx] = { ...localStaff[existingIdx], ...record };
  } else {
    localStaff.push(record);
  }

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin.from('staff').upsert(record);
  }
  return record;
}

// ============================================================================
// STUDENTS
// ============================================================================

export async function getAllStudents(): Promise<Student[]> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*')
      .order('name');
    if (!error && data) return data as Student[];
  }
  return localStudents;
}

export async function getStudentByRfid(rfid: string): Promise<Student | null> {
  const cleanUid = rfid.trim().toUpperCase().replace(/[:\s-]/g, '');
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*')
      .ilike('rfid_uid', cleanUid)
      .maybeSingle();
    if (!error && data) return data as Student;
  }
  return localStudents.find((s) => s.rfid_uid.toUpperCase().replace(/[:\s-]/g, '') === cleanUid) || null;
}

export async function getStudentById(id: string): Promise<Student | null> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data as Student;
  }
  return localStudents.find((s) => s.id === id) || null;
}

export async function saveStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Student> {
  const id = student.id || `student-${Date.now()}`;
  const now = new Date().toISOString();
  const record: Student = {
    id,
    name: student.name,
    roll_no: student.roll_no,
    class_section: student.class_section,
    rfid_uid: student.rfid_uid.toUpperCase().replace(/[:\s-]/g, ''),
    current_status: student.current_status || 'INSIDE',
    parent_name: student.parent_name,
    parent_contact: student.parent_contact,
    parent_chat_id: student.parent_chat_id || null,
    created_at: now,
    updated_at: now,
  };

  const existingIdx = localStudents.findIndex((s) => s.id === id || s.roll_no === student.roll_no);
  if (existingIdx >= 0) {
    localStudents[existingIdx] = { ...localStudents[existingIdx], ...record, updated_at: now };
  } else {
    localStudents.push(record);
  }

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin.from('students').upsert(record);
  }
  return record;
}

export async function updateStudentStatus(studentId: string, status: StudentStatus): Promise<void> {
  const now = new Date().toISOString();
  const student = localStudents.find((s) => s.id === studentId);
  if (student) {
    student.current_status = status;
    student.updated_at = now;
  }

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin
      .from('students')
      .update({ current_status: status, updated_at: now })
      .eq('id', studentId);
  }
}

// ============================================================================
// MOVEMENT LOGS
// ============================================================================

export async function getActiveMovementByStudent(studentId: string): Promise<MovementLog | null> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('movement_logs')
      .select('*, student:students(*), target_staff:staff!movement_logs_target_staff_id_fkey(*)')
      .eq('student_id', studentId)
      .in('status', ['ACTIVE', 'OVERDUE'])
      .order('exit_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as MovementLog;
  }

  const found = localMovementLogs
    .filter((m) => m.student_id === studentId && (m.status === 'ACTIVE' || m.status === 'OVERDUE'))
    .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime())[0];

  if (found) {
    return hydrateMovementLog(found);
  }
  return null;
}

export async function getMovementLogById(id: string): Promise<MovementLog | null> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('movement_logs')
      .select('*, student:students(*), target_staff:staff!movement_logs_target_staff_id_fkey(*)')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data as MovementLog;
  }

  const log = localMovementLogs.find((m) => m.id === id);
  return log ? hydrateMovementLog(log) : null;
}

export async function getAllMovementLogs(): Promise<MovementLog[]> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('movement_logs')
      .select('*, student:students(*), target_staff:staff!movement_logs_target_staff_id_fkey(*)')
      .order('exit_time', { ascending: false });
    if (!error && data) return data as MovementLog[];
  }

  return localMovementLogs
    .map(hydrateMovementLog)
    .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime());
}

export async function createMovementLog(
  input: Omit<MovementLog, 'id' | 'created_at' | 'updated_at'>
): Promise<MovementLog> {
  const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();
  const log: MovementLog = {
    ...input,
    id,
    created_at: now,
    updated_at: now,
  };

  localMovementLogs.unshift(log);

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('movement_logs')
      .insert(input)
      .select()
      .single();
    if (!error && data) return data as MovementLog;
  }

  return hydrateMovementLog(log);
}

export async function updateMovementLog(id: string, updates: Partial<MovementLog>): Promise<MovementLog | null> {
  const now = new Date().toISOString();
  const idx = localMovementLogs.findIndex((m) => m.id === id);
  if (idx >= 0) {
    localMovementLogs[idx] = {
      ...localMovementLogs[idx],
      ...updates,
      updated_at: now,
    };
  }

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('movement_logs')
      .update({ ...updates, updated_at: now })
      .eq('id', id)
      .select('*, student:students(*), target_staff:staff!movement_logs_target_staff_id_fkey(*)')
      .single();
    if (!error && data) return data as MovementLog;
  }

  const updated = localMovementLogs[idx];
  return updated ? hydrateMovementLog(updated) : null;
}

function hydrateMovementLog(log: MovementLog): MovementLog {
  const student = localStudents.find((s) => s.id === log.student_id);
  const targetStaff = log.target_staff_id ? localStaff.find((s) => s.id === log.target_staff_id) : null;
  const verifiedByStaff = log.verified_by_staff_id ? localStaff.find((s) => s.id === log.verified_by_staff_id) : null;

  return {
    ...log,
    student: log.student || student,
    target_staff: log.target_staff || targetStaff,
    verified_by_staff: log.verified_by_staff || verifiedByStaff,
  };
}

// ============================================================================
// AUTOMATIC OVERDUE SWEEPER (Called on heartbeat & monitor polls)
// ============================================================================

export async function checkAndExpireOverdueMovements(): Promise<number> {
  const now = Date.now();
  let updatedCount = 0;

  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.rpc('check_overdue_students');
    } catch {
      // Fallback to manual check if RPC not executed
    }
  }

  for (const log of localMovementLogs) {
    if (log.status === 'ACTIVE') {
      const exitMillis = new Date(log.exit_time).getTime();
      const elapsedSec = Math.floor((now - exitMillis) / 1000);

      if (elapsedSec > log.allowed_duration_sec) {
        log.status = 'OVERDUE';
        log.updated_at = new Date().toISOString();
        updatedCount++;

        // Update student state to OVERDUE if still outside
        const student = localStudents.find((s) => s.id === log.student_id);
        if (student && student.current_status === 'OUTSIDE_ACTIVE') {
          student.current_status = 'OVERDUE';
          student.updated_at = new Date().toISOString();
        }
      }
    }
  }

  return updatedCount;
}

// ============================================================================
// DEVICE STATUS & HEARTBEAT
// ============================================================================

export async function getDeviceStatus(deviceId: string = 'DOOR_NODE_01'): Promise<DeviceStatus> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('device_status')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();
    if (!error && data) return data as DeviceStatus;
  }

  if (!localDeviceStatus[deviceId]) {
    localDeviceStatus[deviceId] = {
      device_id: deviceId,
      last_heartbeat: new Date(Date.now() - 30000).toISOString(), // Initially offline until first ping
      ip_address: '192.168.1.100',
      uptime_sec: 0,
      pending_command: 'NONE',
      lcd2_summary_text: 'Out: 0 | Late: 0',
      updated_at: new Date().toISOString(),
    };
  }
  return localDeviceStatus[deviceId];
}

export async function updateDeviceHeartbeat(params: {
  deviceId: string;
  ipAddress?: string;
  uptime?: number;
  lcd2Summary?: string;
}): Promise<DeviceStatus> {
  const current = await getDeviceStatus(params.deviceId);
  const updated: DeviceStatus = {
    ...current,
    last_heartbeat: new Date().toISOString(),
    ip_address: params.ipAddress || current.ip_address,
    uptime_sec: params.uptime !== undefined ? params.uptime : current.uptime_sec + 3,
    lcd2_summary_text: params.lcd2Summary || current.lcd2_summary_text,
    updated_at: new Date().toISOString(),
  };

  localDeviceStatus[params.deviceId] = updated;

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin.from('device_status').upsert(updated);
  }

  return updated;
}

export async function setDevicePendingCommand(
  deviceId: string,
  command: DeviceCommand
): Promise<void> {
  const current = await getDeviceStatus(deviceId);
  current.pending_command = command;
  current.updated_at = new Date().toISOString();
  localDeviceStatus[deviceId] = current;

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin
      .from('device_status')
      .update({ pending_command: command, updated_at: current.updated_at })
      .eq('device_id', deviceId);
  }
}

export async function consumeDevicePendingCommand(deviceId: string): Promise<DeviceCommand> {
  const current = await getDeviceStatus(deviceId);
  const command = current.pending_command;

  if (command !== 'NONE') {
    current.pending_command = 'NONE';
    current.updated_at = new Date().toISOString();
    localDeviceStatus[deviceId] = current;

    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin
        .from('device_status')
        .update({ pending_command: 'NONE', updated_at: current.updated_at })
        .eq('device_id', deviceId);
    }
  }

  return command;
}

// ============================================================================
// SOS EMERGENCY ALERTS
// ============================================================================

export async function createSosAlert(alert: Omit<SosAlert, 'id' | 'triggered_at'>): Promise<SosAlert> {
  const record: SosAlert = {
    ...alert,
    id: `sos-${Date.now()}`,
    triggered_at: new Date().toISOString(),
    status: 'ACTIVE',
    acknowledged_by: null,
    acknowledged_at: null,
  };

  localSosAlerts.unshift(record);

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('sos_alerts')
      .insert(alert)
      .select()
      .single();
    if (!error && data) return data as SosAlert;
  }

  return record;
}

export async function getActiveSosAlerts(): Promise<SosAlert[]> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('sos_alerts')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('triggered_at', { ascending: false });
    if (!error && data) return data as SosAlert[];
  }

  return localSosAlerts.filter((s) => s.status === 'ACTIVE');
}

export async function acknowledgeSosAlert(id: string, staffName: string): Promise<SosAlert | null> {
  const now = new Date().toISOString();
  const alert = localSosAlerts.find((s) => s.id === id);
  if (alert) {
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledged_by = staffName;
    alert.acknowledged_at = now;
  }

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('sos_alerts')
      .update({ status: 'ACKNOWLEDGED', acknowledged_by: staffName, acknowledged_at: now })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data as SosAlert;
  }

  return alert || null;
}

// ============================================================================
// NOTIFICATION LOGS (Audited Delivery Confirmation)
// ============================================================================

export async function logNotification(record: Omit<NotificationLog, 'id' | 'sent_at'>): Promise<NotificationLog> {
  const log: NotificationLog = {
    ...record,
    id: `notif-${Date.now()}`,
    sent_at: new Date().toISOString(),
  };

  localNotificationLogs.unshift(log);

  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin.from('notification_logs').insert(log);
  }

  return log;
}

export async function getNotificationLogs(studentId?: string): Promise<NotificationLog[]> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    let query = supabaseAdmin.from('notification_logs').select('*').order('sent_at', { ascending: false });
    const { data, error } = await query;
    if (!error && data) return data as NotificationLog[];
  }

  return localNotificationLogs;
}
