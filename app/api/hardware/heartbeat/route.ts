// ============================================================================
// API Route: POST /api/hardware/heartbeat
// Heartbeat endpoint polled by ESP32 every 3s. Sweeps overdue students,
// computes live LCD2 counts, and dispatches pending gate/buzzer commands.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  updateDeviceHeartbeat,
  checkAndExpireOverdueMovements,
  consumeDevicePendingCommand,
  getAllStudents,
  getAllMovementLogs,
} from '@/lib/db';
import { HeartbeatRequest, HeartbeatResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    let body: HeartbeatRequest = { device_id: 'DOOR_NODE_01' };
    try {
      body = await req.json();
    } catch {
      // Body may be empty in simple curl / healthchecks
    }

    const deviceId = body.device_id || 'DOOR_NODE_01';
    const ipAddress = body.ip_address || '192.168.1.100';
    const uptime = body.uptime !== undefined ? body.uptime : 0;

    // 1. Run automatic overdue sweeper for any expired timers
    await checkAndExpireOverdueMovements();

    // 2. Fetch live metrics
    const students = await getAllStudents();
    const activeOutsideCount = students.filter((s) => s.current_status === 'OUTSIDE_ACTIVE').length;
    const overdueCount = students.filter((s) => s.current_status === 'OVERDUE' || s.current_status === 'PENDING_VERIFICATION').length;

    const lcd2Summary = `Out: ${activeOutsideCount} | Late: ${overdueCount}`;

    // 3. Update device status timestamp
    await updateDeviceHeartbeat({
      deviceId,
      ipAddress,
      uptime,
      lcd2Summary,
    });

    // 4. Check & consume any pending command queued by teachers/coordinators
    const pendingCommand = await consumeDevicePendingCommand(deviceId);

    return NextResponse.json({
      success: true,
      pending_command: pendingCommand,
      lcd2_summary: lcd2Summary,
      active_count: activeOutsideCount,
      overdue_count: overdueCount,
      system_time: new Date().toISOString(),
    } as HeartbeatResponse);
  } catch (error: any) {
    console.error('[API /hardware/heartbeat Error]', error);
    return NextResponse.json(
      {
        success: false,
        pending_command: 'NONE',
        lcd2_summary: 'Out: -- | Late: --',
        active_count: 0,
        overdue_count: 0,
        system_time: new Date().toISOString(),
      } as HeartbeatResponse,
      { status: 500 }
    );
  }
}
