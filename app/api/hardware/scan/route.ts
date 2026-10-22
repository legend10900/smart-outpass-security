// ============================================================================
// API Route: POST /api/hardware/scan
// Processes RFID card taps at the door, executes the core state machine,
// distinguishes EXIT from RETURN, and returns precise hardware commands.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getStudentByRfid,
  getActiveMovementByStudent,
  createMovementLog,
  updateMovementLog,
  updateStudentStatus,
  getSystemSettings,
  updateDeviceHeartbeat,
} from '@/lib/db';
import { ScanRequest, ScanResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: ScanRequest = await req.json();
    const cardUid = body.card_uid?.trim().toUpperCase().replace(/[:\s-]/g, '');
    const deviceId = body.device_id || 'DOOR_NODE_01';
    const source = body.source || 'ESP32_PHYSICAL';

    if (!cardUid) {
      return NextResponse.json(
        {
          success: false,
          action: 'ACCESS_DENIED',
          message: 'Missing RFID card UID',
          lcd1: 'Card Read Error',
          lcd2: 'Try Tapping Again',
          beep_pattern: '2_SHORT',
          open_gate: false,
        } as ScanResponse,
        { status: 400 }
      );
    }

    // 1. Student Lookup
    const student = await getStudentByRfid(cardUid);
    if (!student) {
      return NextResponse.json({
        success: false,
        action: 'ACCESS_DENIED',
        message: `Unregistered RFID card: ${cardUid}`,
        lcd1: 'Unregistered Tag',
        lcd2: 'Access Denied',
        beep_pattern: '3_SHORT',
        open_gate: false,
      } as ScanResponse);
    }

    const settings = await getSystemSettings();
    const allowedDuration = settings.allowed_duration_sec || 60;
    const now = new Date();

    // 2. State Machine Transitions based on student.current_status
    // -------------------------------------------------------------
    // TRANSITION 1: INSIDE -> OUTSIDE_ACTIVE (Exit Scan)
    // -------------------------------------------------------------
    if (student.current_status === 'INSIDE') {
      const newLog = await createMovementLog({
        student_id: student.id,
        exit_time: now.toISOString(),
        allowed_duration_sec: allowedDuration,
        return_time: null,
        status: 'ACTIVE',
        overdue_reason: 'NONE',
        reason_notes: null,
        target_staff_id: null,
        verified_by_staff_id: null,
        verification_status: 'NOT_REQUIRED',
        verified_at: null,
        parent_notified: false,
        parent_notified_at: null,
        source: source,
      });

      await updateStudentStatus(student.id, 'OUTSIDE_ACTIVE');

      const studentShortName = student.name.split(' ')[0];
      return NextResponse.json({
        success: true,
        action: 'OPEN_EXIT',
        message: `Exit approved for ${student.name}`,
        student_name: student.name,
        roll_no: student.roll_no,
        lcd1: 'Exit Approved',
        lcd2: `Timer: ${allowedDuration}s [${studentShortName}]`,
        beep_pattern: '1_SHORT',
        open_gate: true,
        gate_hold_sec: 5,
        remaining_sec: allowedDuration,
      } as ScanResponse);
    }

    // -------------------------------------------------------------
    // TRANSITION 2: OUTSIDE_ACTIVE -> RETURNED_ON_TIME or OVERDUE
    // -------------------------------------------------------------
    if (student.current_status === 'OUTSIDE_ACTIVE') {
      const activeLog = await getActiveMovementByStudent(student.id);
      const exitTime = activeLog ? new Date(activeLog.exit_time).getTime() : now.getTime();
      const elapsedSec = Math.floor((now.getTime() - exitTime) / 1000);
      const logAllowedSec = activeLog?.allowed_duration_sec || allowedDuration;

      // On-Time Return
      if (elapsedSec <= logAllowedSec) {
        if (activeLog) {
          await updateMovementLog(activeLog.id, {
            return_time: now.toISOString(),
            status: 'RETURNED_ON_TIME',
            verification_status: 'NOT_REQUIRED',
          });
        }
        await updateStudentStatus(student.id, 'INSIDE');

        return NextResponse.json({
          success: true,
          action: 'OPEN_RETURN',
          message: `Welcome back, ${student.name}. Return completed on time (${elapsedSec}s / ${logAllowedSec}s).`,
          student_name: student.name,
          roll_no: student.roll_no,
          lcd1: 'Welcome Back',
          lcd2: student.name.length > 16 ? student.name.substring(0, 16) : student.name,
          beep_pattern: '2_SHORT',
          open_gate: true,
          gate_hold_sec: 5,
        } as ScanResponse);
      }

      // Overdue Return Scan: Prompt Keypad Reason
      if (activeLog) {
        await updateMovementLog(activeLog.id, {
          status: 'OVERDUE',
        });
      }
      await updateStudentStatus(student.id, 'OVERDUE');

      return NextResponse.json({
        success: true,
        action: 'REQUIRE_REASON',
        message: `Student ${student.name} is overdue (${elapsedSec}s elapsed). Keypad reason required.`,
        student_name: student.name,
        roll_no: student.roll_no,
        lcd1: 'Overdue! Reason:',
        lcd2: '1:Tch 2:Crd 3:Inf',
        beep_pattern: '3_SHORT',
        open_gate: false,
      } as ScanResponse);
    }

    // -------------------------------------------------------------
    // TRANSITION 3: OVERDUE -> Prompt Keypad Reason
    // -------------------------------------------------------------
    if (student.current_status === 'OVERDUE') {
      return NextResponse.json({
        success: true,
        action: 'REQUIRE_REASON',
        message: `Student ${student.name} is marked OVERDUE. Keypad explanation required.`,
        student_name: student.name,
        roll_no: student.roll_no,
        lcd1: 'Overdue! Reason:',
        lcd2: '1:Tch 2:Crd 3:Inf',
        beep_pattern: '3_SHORT',
        open_gate: false,
      } as ScanResponse);
    }

    // -------------------------------------------------------------
    // TRANSITION 4: PENDING_VERIFICATION -> Gate holds until approved
    // -------------------------------------------------------------
    if (student.current_status === 'PENDING_VERIFICATION') {
      return NextResponse.json({
        success: true,
        action: 'ALREADY_PENDING',
        message: `Verification already pending for ${student.name}. Please wait for staff approval.`,
        student_name: student.name,
        roll_no: student.roll_no,
        lcd1: 'Pending Approval',
        lcd2: 'Wait For Staff',
        beep_pattern: '2_SHORT',
        open_gate: false,
      } as ScanResponse);
    }

    return NextResponse.json({
      success: false,
      action: 'ACCESS_DENIED',
      message: 'Unknown student state',
      lcd1: 'System Error',
      lcd2: 'Contact Admin',
      beep_pattern: '3_SHORT',
      open_gate: false,
    } as ScanResponse);
  } catch (error: any) {
    console.error('[API /hardware/scan Error]', error);
    return NextResponse.json(
      {
        success: false,
        action: 'ACCESS_DENIED',
        message: error?.message || 'Internal Server Error',
        lcd1: 'Server Error',
        lcd2: 'Retry Shortly',
        beep_pattern: '3_SHORT',
        open_gate: false,
      } as ScanResponse,
      { status: 500 }
    );
  }
}
