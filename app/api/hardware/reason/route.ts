// ============================================================================
// API Route: POST /api/hardware/reason
// Handles 4x4 keypad overdue reason submissions (1: Teacher, 2: Coordinator,
// 3: Infirmary, 4: Other) and executes the notification & verification workflow.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getStudentByRfid,
  getStudentById,
  getActiveMovementByStudent,
  updateMovementLog,
  updateStudentStatus,
  getStaffByCode,
  getAllStaff,
  getSystemSettings,
  logNotification,
  setDevicePendingCommand,
} from '@/lib/db';
import {
  sendParentOverdueNotification,
  sendCoordinatorAlert,
  sendTeacherVerificationRequest,
} from '@/lib/notifications';
import { ReasonRequest, ReasonResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: ReasonRequest = await req.json();
    const { card_uid, student_id, reason_key, teacher_code, notes, device_id = 'DOOR_NODE_01' } = body;

    // 1. Resolve Student
    let student = null;
    if (student_id) {
      student = await getStudentById(student_id);
    } else if (card_uid) {
      student = await getStudentByRfid(card_uid);
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          message: 'Student not found for reason submission',
          action: 'OTHER_NOTIFIED',
          lcd1: 'Student Not Found',
          lcd2: 'Scan Card First',
          open_gate: false,
          beep_pattern: '3_SHORT',
          parent_notified: false,
        } as ReasonResponse,
        { status: 404 }
      );
    }

    // 2. Resolve Active/Overdue Movement Log
    let movementLog = await getActiveMovementByStudent(student.id);
    const settings = await getSystemSettings();
    const now = new Date();

    const exitTimeMillis = movementLog ? new Date(movementLog.exit_time).getTime() : now.getTime();
    const elapsedSec = Math.floor((now.getTime() - exitTimeMillis) / 1000);

    // ========================================================================
    // OPTION 1: TEACHER VERIFICATION
    // ========================================================================
    if (reason_key === '1') {
      let targetTeacher = null;
      if (teacher_code) {
        targetTeacher = await getStaffByCode(teacher_code);
      }
      if (!targetTeacher) {
        // Fallback to first available teacher
        const allStaff = await getAllStaff();
        targetTeacher = allStaff.find((s) => s.role === 'TEACHER') || null;
      }

      if (movementLog) {
        await updateMovementLog(movementLog.id, {
          overdue_reason: 'TEACHER',
          target_staff_id: targetTeacher?.id || null,
          verification_status: 'PENDING',
          reason_notes: notes || (teacher_code ? `Teacher shortcode #${teacher_code}` : 'Teacher classroom visit'),
          status: 'OVERDUE',
        });
      }

      await updateStudentStatus(student.id, 'PENDING_VERIFICATION');

      // Dispatch Teacher Verification Alert
      if (targetTeacher) {
        const notifResult = await sendTeacherVerificationRequest({
          studentName: student.name,
          rollNo: student.roll_no,
          teacherName: targetTeacher.name,
          teacherEmail: targetTeacher.email,
          teacherChatId: targetTeacher.notification_chat_id || undefined,
        });

        if (notifResult.confirmedAt) {
          await logNotification({
            movement_log_id: movementLog?.id || null,
            recipient_type: 'TEACHER',
            recipient_identifier: targetTeacher.email,
            channel: notifResult.channel,
            message_content: notifResult.message,
            status_code: notifResult.statusCode,
            status_response: JSON.stringify(notifResult.responsePayload || {}),
            confirmed_at: notifResult.confirmedAt,
          });
        }
      }

      const teacherDisplayName = targetTeacher ? targetTeacher.name.split(' ')[1] || targetTeacher.name : 'Teacher';
      return NextResponse.json({
        success: true,
        action: 'QUEUED_FOR_TEACHER',
        message: `Reason recorded: Visiting ${targetTeacher?.name || 'Teacher'}. Verification pending.`,
        lcd1: 'Sent to Teacher',
        lcd2: `Wait [${teacherDisplayName.substring(0, 10)}]`,
        open_gate: false,
        beep_pattern: '1_SHORT',
        parent_notified: false,
      } as ReasonResponse);
    }

    // ========================================================================
    // OPTION 2: COORDINATOR REVIEW
    // ========================================================================
    if (reason_key === '2') {
      const allStaff = await getAllStaff();
      const coordinator = allStaff.find((s) => s.role === 'COORDINATOR');

      if (movementLog) {
        await updateMovementLog(movementLog.id, {
          overdue_reason: 'COORDINATOR',
          target_staff_id: coordinator?.id || null,
          verification_status: 'PENDING',
          reason_notes: notes || 'Coordinator review requested via Keypad #2',
          status: 'OVERDUE',
        });
      }

      await updateStudentStatus(student.id, 'PENDING_VERIFICATION');

      const coordAlert = await sendCoordinatorAlert({
        studentName: student.name,
        rollNo: student.roll_no,
        reason: 'Coordinator Review Requested (Keypad #2)',
        notes: notes,
        exitTime: movementLog?.exit_time || now.toISOString(),
        coordinatorEmail: coordinator?.email,
        coordinatorChatId: coordinator?.notification_chat_id || undefined,
      });

      if (coordAlert.confirmedAt) {
        await logNotification({
          movement_log_id: movementLog?.id || null,
          recipient_type: 'COORDINATOR',
          recipient_identifier: coordinator?.email || 'coordinator',
          channel: coordAlert.channel,
          message_content: coordAlert.message,
          status_code: coordAlert.statusCode,
          status_response: JSON.stringify(coordAlert.responsePayload || {}),
          confirmed_at: coordAlert.confirmedAt,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'QUEUED_FOR_COORDINATOR',
        message: `Coordinator review queued for ${student.name}.`,
        lcd1: 'Coordinator Req',
        lcd2: 'Wait For Review',
        open_gate: false,
        beep_pattern: '1_SHORT',
        parent_notified: false,
      } as ReasonResponse);
    }

    // ========================================================================
    // OPTION 3: INFIRMARY / MEDICAL
    // ========================================================================
    if (reason_key === '3') {
      const allStaff = await getAllStaff();
      const coordinator = allStaff.find((s) => s.role === 'COORDINATOR');

      if (movementLog) {
        await updateMovementLog(movementLog.id, {
          overdue_reason: 'INFIRMARY',
          target_staff_id: coordinator?.id || null,
          verification_status: 'PENDING',
          reason_notes: notes || 'Medical clinic / Infirmary visit',
          status: 'OVERDUE',
        });
      }

      await updateStudentStatus(student.id, 'PENDING_VERIFICATION');

      const infirmaryAlert = await sendCoordinatorAlert({
        studentName: student.name,
        rollNo: student.roll_no,
        reason: 'Medical / Infirmary Visit',
        notes: 'Dedicated review required.',
        exitTime: movementLog?.exit_time || now.toISOString(),
        coordinatorEmail: coordinator?.email,
        coordinatorChatId: coordinator?.notification_chat_id || undefined,
      });

      if (infirmaryAlert.confirmedAt) {
        await logNotification({
          movement_log_id: movementLog?.id || null,
          recipient_type: 'COORDINATOR',
          recipient_identifier: coordinator?.email || 'coordinator',
          channel: infirmaryAlert.channel,
          message_content: infirmaryAlert.message,
          status_code: infirmaryAlert.statusCode,
          status_response: JSON.stringify(infirmaryAlert.responsePayload || {}),
          confirmed_at: infirmaryAlert.confirmedAt,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'INFIRMARY_LOGGED',
        message: `Medical outpass logged for ${student.name}. Coordinator notified.`,
        lcd1: 'Infirmary Logged',
        lcd2: 'Coord Notified',
        open_gate: false,
        beep_pattern: '1_SHORT',
        parent_notified: false,
      } as ReasonResponse);
    }

    // ========================================================================
    // OPTION 4: OTHER (Immediate Parent + Coordinator Notification)
    // ========================================================================
    if (reason_key === '4') {
      const allStaff = await getAllStaff();
      const coordinator = allStaff.find((s) => s.role === 'COORDINATOR');

      // 1. Send Parent Notification strictly requiring 200 OK confirmation
      const parentNotifResult = await sendParentOverdueNotification({
        studentName: student.name,
        rollNo: student.roll_no,
        exitTime: movementLog?.exit_time || now.toISOString(),
        elapsedSec: elapsedSec,
        parentName: student.parent_name,
        parentContact: student.parent_contact,
        parentChatId: student.parent_chat_id,
        reasonText: notes || 'Other (General Delay)',
      });

      const confirmed200 = parentNotifResult.statusCode === 200 && Boolean(parentNotifResult.confirmedAt);

      if (movementLog) {
        await updateMovementLog(movementLog.id, {
          overdue_reason: 'OTHER',
          target_staff_id: coordinator?.id || null,
          verification_status: 'PENDING',
          reason_notes: notes || 'Other unspecified reason selected on keypad',
          status: 'OVERDUE',
          parent_notified: confirmed200,
          parent_notified_at: confirmed200 ? parentNotifResult.confirmedAt : null,
        });
      }

      await updateStudentStatus(student.id, 'PENDING_VERIFICATION');

      // Audit Notification in Table
      if (confirmed200) {
        await logNotification({
          movement_log_id: movementLog?.id || null,
          recipient_type: 'PARENT',
          recipient_identifier: student.parent_contact,
          channel: parentNotifResult.channel,
          message_content: parentNotifResult.message,
          status_code: parentNotifResult.statusCode,
          status_response: JSON.stringify(parentNotifResult.responsePayload || {}),
          confirmed_at: parentNotifResult.confirmedAt,
        });
      }

      // Notify Coordinator
      await sendCoordinatorAlert({
        studentName: student.name,
        rollNo: student.roll_no,
        reason: 'Other Explanation (Keypad #4)',
        notes: notes || `Elapsed time: ${elapsedSec}s. Parent notification triggered.`,
        exitTime: movementLog?.exit_time || now.toISOString(),
        coordinatorEmail: coordinator?.email,
      });

      // Check Gate Policy
      const allowEntry = settings.gate_policy_on_overdue === 'ALLOW_ENTRY_AFTER_REASON';
      if (allowEntry) {
        await updateStudentStatus(student.id, 'INSIDE');
        if (movementLog) {
          await updateMovementLog(movementLog.id, {
            return_time: now.toISOString(),
            status: 'RESOLVED_APPROVED',
            verification_status: 'APPROVED',
          });
        }
      }

      return NextResponse.json({
        success: true,
        action: allowEntry ? 'OPEN_ENTRY' : 'OTHER_NOTIFIED',
        message: `Other reason registered. Parent notification ${confirmed200 ? 'confirmed (200 OK)' : 'queued'}.`,
        lcd1: allowEntry ? 'Entry Granted' : 'Parent Notified',
        lcd2: allowEntry ? 'Report to Coord' : 'Under Review',
        open_gate: allowEntry,
        beep_pattern: allowEntry ? '1_SHORT' : '2_SHORT',
        parent_notified: confirmed200,
        notification_confirmed_at: parentNotifResult.confirmedAt || undefined,
      } as ReasonResponse);
    }

    return NextResponse.json(
      {
        success: false,
        message: `Invalid reason key: ${reason_key}`,
        action: 'OTHER_NOTIFIED',
        lcd1: 'Invalid Option',
        lcd2: 'Press 1, 2, 3 or 4',
        open_gate: false,
        beep_pattern: '3_SHORT',
        parent_notified: false,
      } as ReasonResponse,
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /hardware/reason Error]', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Internal Server Error',
        action: 'OTHER_NOTIFIED',
        lcd1: 'Server Error',
        lcd2: 'Retry Shortly',
        open_gate: false,
        beep_pattern: '3_SHORT',
        parent_notified: false,
      } as ReasonResponse,
      { status: 500 }
    );
  }
}
