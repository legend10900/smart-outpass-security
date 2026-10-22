// ============================================================================
// API Route: GET /api/data/overview
// Consolidated real-time snapshot endpoint powering the Live Monitor,
// Teacher/Coordinator Portals, Parent View, and Hardware Status indicators.
// ============================================================================

import { NextResponse } from 'next/server';
import {
  getDeviceStatus,
  getAllStudents,
  getAllMovementLogs,
  getAllStaff,
  getSystemSettings,
  getActiveSosAlerts,
  getNotificationLogs,
  checkAndExpireOverdueMovements,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Run automatic expiration check on active movements
    await checkAndExpireOverdueMovements();

    // 2. Fetch all components in parallel
    const [deviceStatus, students, movementLogs, staff, settings, activeSos, notificationLogs] =
      await Promise.all([
        getDeviceStatus('DOOR_NODE_01'),
        getAllStudents(),
        getAllMovementLogs(),
        getAllStaff(),
        getSystemSettings(),
        getActiveSosAlerts(),
        getNotificationLogs(),
      ]);

    // 3. Strict 10-second Hardware Heartbeat Rule:
    // "If NOW() - last_heartbeat > 10 seconds, the Web UI must prominently display HARDWARE OFFLINE in red.
    // When active, display HARDWARE ONLINE (ESP32) in green."
    const lastHeartbeatMillis = new Date(deviceStatus.last_heartbeat).getTime();
    const millisSinceHeartbeat = Date.now() - lastHeartbeatMillis;
    const isHardwareOnline = millisSinceHeartbeat <= 10000;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      isHardwareOnline,
      millisSinceHeartbeat,
      deviceStatus: {
        ...deviceStatus,
        isOnline: isHardwareOnline,
      },
      students,
      movementLogs,
      staff,
      settings,
      activeSos,
      notificationLogs,
    });
  } catch (error: any) {
    console.error('[API /data/overview Error]', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to fetch overview data' },
      { status: 500 }
    );
  }
}
