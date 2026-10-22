// ============================================================================
// TypeScript Type Definitions - Smart Outpass Security System
// ============================================================================

export type StaffRole = 'ADMIN' | 'COORDINATOR' | 'TEACHER';

export type StudentStatus = 'INSIDE' | 'OUTSIDE_ACTIVE' | 'OVERDUE' | 'PENDING_VERIFICATION';

export type MovementStatus = 'ACTIVE' | 'RETURNED_ON_TIME' | 'OVERDUE' | 'RESOLVED_APPROVED' | 'RESOLVED_REJECTED';

export type OverdueReason = 'NONE' | 'TEACHER' | 'COORDINATOR' | 'INFIRMARY' | 'OTHER';

export type VerificationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type GatePolicy = 'WAIT_FOR_APPROVAL' | 'ALLOW_ENTRY_AFTER_REASON';

export type DeviceCommand = 'NONE' | 'OPEN_GATE' | 'REJECT_BUZZER' | 'CLEAR_SOS';

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED';

export type EventSource = 'ESP32_PHYSICAL' | 'SIMULATED';

export interface SystemSettings {
  id: string;
  allowed_duration_sec: number;
  gate_policy_on_overdue: GatePolicy;
  updated_at: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  keypad_code: string | null;
  notification_chat_id: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  roll_no: string;
  class_section: string;
  rfid_uid: string;
  current_status: StudentStatus;
  parent_name: string;
  parent_contact: string;
  parent_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MovementLog {
  id: string;
  student_id: string;
  exit_time: string;
  allowed_duration_sec: number;
  return_time: string | null;
  status: MovementStatus;
  overdue_reason: OverdueReason;
  reason_notes: string | null;
  target_staff_id: string | null;
  verified_by_staff_id: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  parent_notified: boolean;
  parent_notified_at: string | null;
  source: EventSource;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: Student;
  target_staff?: Staff | null;
  verified_by_staff?: Staff | null;
}

export interface DeviceStatus {
  device_id: string;
  last_heartbeat: string;
  ip_address: string;
  uptime_sec: number;
  pending_command: DeviceCommand;
  lcd2_summary_text: string;
  updated_at: string;
}

export interface SosAlert {
  id: string;
  device_id: string;
  triggered_at: string;
  status: SosStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  source: EventSource;
}

export interface NotificationLog {
  id: string;
  movement_log_id: string | null;
  recipient_type: 'PARENT' | 'COORDINATOR' | 'TEACHER';
  recipient_identifier: string;
  channel: 'TELEGRAM' | 'EMAIL' | 'SYSTEM_LOG';
  message_content: string;
  status_code: number;
  status_response: string | null;
  sent_at: string;
  confirmed_at: string | null;
}

// Hardware API Request/Response shapes
export interface ScanRequest {
  card_uid: string;
  device_id?: string;
  source?: EventSource;
}

export interface ScanResponse {
  success: boolean;
  action: 'OPEN_EXIT' | 'OPEN_RETURN' | 'REQUIRE_REASON' | 'ACCESS_DENIED' | 'ALREADY_PENDING';
  message: string;
  student_name?: string;
  roll_no?: string;
  lcd1: string;
  lcd2: string;
  beep_pattern: string; // e.g., "1_SHORT", "2_SHORT", "3_SHORT", "1_LONG"
  open_gate: boolean;
  gate_hold_sec?: number;
  remaining_sec?: number;
}

export interface ReasonRequest {
  card_uid?: string;
  student_id?: string;
  reason_key: '1' | '2' | '3' | '4'; // 1: Teacher, 2: Coordinator, 3: Infirmary, 4: Other
  teacher_code?: string; // 2-digit e.g., "01"
  notes?: string;
  device_id?: string;
  source?: EventSource;
}

export interface ReasonResponse {
  success: boolean;
  message: string;
  action: 'QUEUED_FOR_TEACHER' | 'QUEUED_FOR_COORDINATOR' | 'INFIRMARY_LOGGED' | 'OTHER_NOTIFIED' | 'OPEN_ENTRY';
  lcd1: string;
  lcd2: string;
  open_gate: boolean;
  beep_pattern: string;
  parent_notified: boolean;
  notification_confirmed_at?: string;
}

export interface HeartbeatRequest {
  device_id: string;
  ip_address?: string;
  uptime?: number;
}

export interface HeartbeatResponse {
  success: boolean;
  pending_command: DeviceCommand;
  lcd2_summary: string;
  active_count: number;
  overdue_count: number;
  system_time: string;
}

export interface SosRequest {
  device_id: string;
  source?: EventSource;
}

export interface VerifyRequest {
  movement_id: string;
  staff_id: string;
  decision: 'APPROVE' | 'REJECT';
  remarks?: string;
  override_gate?: boolean;
}
