// ============================================================================
// API Route: POST /api/staff/verify
// Handles Teacher & Coordinator Approve/Reject actions, updates database states,
// enqueues gate opening/rejection buzzer on ESP32, and delivers parent/coordinator notices.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getMovementLogById,
  updateMovementLog,
  updateStudentStatus,
  getStudentById,
  getStaffById,
  setDevicePendingCommand,
  logNotification,
  getAllStaff,
} from '@/lib/db';
import {
  sendParentOverdueNotification,
  sendCoordinatorAlert,
} from '@/lib/notifications';
import { VerifyRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: VerifyRequest = await req.json();
    const { movement_id, staff_id, decision, remarks } = body;

    if (!movement_id || !staff_id || !decision) {
      return NextResponse.json(
        { success: false, message: 'Missing movement_id, staff_id, or decision' },
        { status: 400 }
      );
    }

    const movementLog = await getMovementLogById(movement_id);
    if (!movementLog) {
      return NextResponse.json(
        { success: false, message: 'Movement log record not found' },
        { status: 404 }
      );
    }

    const staffMember = await getStaffById(staff_id);
    const student = await getStudentById(movementLog.student_id);
    const nowIso = new Date().toISOString();

    if (!student) {
      return NextResponse.json(
        { success: false, message: 'Associated student record not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // DECISION: APPROVE
    // ========================================================================
    if (decision === 'APPROVE') {
      await updateMovementLog(movementLog.id, {
        status: 'RESOLVED_APPROVED',
        verification_status: 'APPROVED',
        verified_by_staff_id: staff_id,
        verified_at: nowIso,
        return_time: nowIso,
        reason_notes: remarks
          ? `${movementLog.reason_notes ? `${movementLog.reason_notes} | ` : ''}Approved by ${staffMember?.name || 'Staff'}: ${remarks}`
          : movementLog.reason_notes,
      });

      // Update Student Status back to INSIDE
      await updateStudentStatus(student.id, 'INSIDE');

      // Enqueue remote gate opening command on ESP32
      await setDevicePendingCommand('DOOR_NODE_01', 'OPEN_GATE');

      console.log(`[APPROVAL GRANTED] Movement ${movementLog.id} approved by ${staffMember?.name}. Gate open queued.`);

      return NextResponse.json({
        success: true,
        message: `Visit approved by ${staffMember?.name || 'Staff'}. Servo gate open command queued for hardware node.`,
        movement_status: 'RESOLVED_APPROVED',
        student_status: 'INSIDE',
        gate_command_queued: 'OPEN_GATE',
      });
    }

    // ========================================================================
    // DECISION: REJECT
    // ========================================================================
    if (decision === 'REJECT') {
      await updateMovementLog(movementLog.id, {
        status: 'RESOLVED_REJECTED',
        verification_status: 'REJECTED',
        verified_by_staff_id: staff_id,
        verified_at: nowIso,
        reason_notes: remarks
          ? `${movementLog.reason_notes ? `${movementLog.reason_notes} | ` : ''}REJECTED by ${staffMember?.name || 'Staff'}: ${remarks}`
          : movementLog.reason_notes,
      });

      // Student remains in OVERDUE state for coordinator intervention
      await updateStudentStatus(student.id, 'OVERDUE');

      // Enqueue buzzer reject pattern on door hardware
      await setDevicePendingCommand('DOOR_NODE_01', 'REJECT_BUZZER');

      // If rejected by a teacher, alert the Coordinator
      if (staffMember?.role === 'TEACHER') {
        const allStaff = await getAllStaff();
        const coordinator = allStaff.find((s) => s.role === 'COORDINATOR');
        await sendCoordinatorAlert({
          studentName: student.name,
          rollNo: student.roll_no,
          reason: `Teacher Visit Rejected by ${staffMember.name}`,
          notes: remarks || 'Student requested verification with teacher but was rejected.',
          exitTime: movementLog.exit_time,
          coordinatorEmail: coordinator?.email,
          coordinatorChatId: coordinator?.notification_chat_id || undefined,
        });
      }

      // Trigger Parent Notification
      const exitMillis = new Date(movementLog.exit_time).getTime();
      const elapsedSec = Math.floor((Date.now() - exitMillis) / 1000);

      const parentNotifResult = await sendParentOverdueNotification({
        studentName: student.name,
        rollNo: student.roll_no,
        exitTime: movementLog.exit_time,
        elapsedSec: elapsedSec,
        parentName: student.parent_name,
        parentContact: student.parent_contact,
        parentChatId: student.parent_chat_id,
        reasonText: `Visit rejected by ${staffMember?.name || 'Faculty'}. Remarks: ${remarks || 'None'}`,
      });

      if (parentNotifResult.statusCode === 200 && parentNotifResult.confirmedAt) {
        await updateMovementLog(movementLog.id, {
          parent_notified: true,
          parent_notified_at: parentNotifResult.confirmedAt,
        });

        await logNotification({
          movement_log_id: movementLog.id,
          recipient_type: 'PARENT',
          recipient_identifier: student.parent_contact,
          channel: parentNotifResult.channel,
          message_content: parentNotifResult.message,
          status_code: 200,
          status_response: JSON.stringify(parentNotifResult.responsePayload || {}),
          confirmed_at: parentNotifResult.confirmedAt,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Visit rejected by ${staffMember?.name || 'Staff'}. Parent and coordinator notified. Reject buzzer queued.`,
        movement_status: 'RESOLVED_REJECTED',
        student_status: 'OVERDUE',
        gate_command_queued: 'REJECT_BUZZER',
        parent_notified: Boolean(parentNotifResult.confirmedAt),
      });
    }

    return NextResponse.json(
      { success: false, message: `Invalid decision: ${decision}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /staff/verify Error]', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
