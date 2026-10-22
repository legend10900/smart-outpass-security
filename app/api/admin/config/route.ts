// ============================================================================
// API Route: POST /api/admin/config
// Updates timer settings, gate policies, student RFID registrations, and staff profiles.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSystemSettings,
  updateSystemSettings,
  saveStudent,
  saveStaff,
  getAllStudents,
  getAllStaff,
} from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. Update Global System Settings (Allowed Duration & Gate Policy)
    if (action === 'UPDATE_SETTINGS' || body.allowed_duration_sec !== undefined || body.gate_policy_on_overdue) {
      const updates: any = {};
      if (body.allowed_duration_sec !== undefined) {
        updates.allowed_duration_sec = parseInt(body.allowed_duration_sec, 10);
      }
      if (body.gate_policy_on_overdue) {
        updates.gate_policy_on_overdue = body.gate_policy_on_overdue;
      }

      const updated = await updateSystemSettings(updates);
      return NextResponse.json({
        success: true,
        message: 'System settings updated successfully',
        settings: updated,
      });
    }

    // 2. Register or Update Student (RFID Mapping)
    if (action === 'UPSERT_STUDENT') {
      const { student } = body;
      if (!student || !student.name || !student.roll_no || !student.rfid_uid) {
        return NextResponse.json(
          { success: false, message: 'Student requires name, roll_no, and rfid_uid' },
          { status: 400 }
        );
      }

      const saved = await saveStudent(student);
      return NextResponse.json({
        success: true,
        message: `Student ${saved.name} registered with RFID [${saved.rfid_uid}]`,
        student: saved,
      });
    }

    // 3. Register or Update Staff (Keypad Shortcode Mapping)
    if (action === 'UPSERT_STAFF') {
      const { staff } = body;
      if (!staff || !staff.name || !staff.email || !staff.role) {
        return NextResponse.json(
          { success: false, message: 'Staff requires name, email, and role' },
          { status: 400 }
        );
      }

      const saved = await saveStaff(staff);
      return NextResponse.json({
        success: true,
        message: `Staff ${saved.name} saved with keypad code #${saved.keypad_code || 'N/A'}`,
        staff: saved,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Unknown configuration action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /admin/config Error]', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
