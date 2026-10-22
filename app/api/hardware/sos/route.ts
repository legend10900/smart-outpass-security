// ============================================================================
// API Route: POST /api/hardware/sos
// Logs critical emergency SOS alert triggered by hardware push button or simulator.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSosAlert } from '@/lib/db';
import { SosRequest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    let body: SosRequest = { device_id: 'DOOR_NODE_01' };
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const deviceId = body.device_id || 'DOOR_NODE_01';
    const source = body.source || 'ESP32_PHYSICAL';

    const alert = await createSosAlert({
      device_id: deviceId,
      status: 'ACTIVE',
      acknowledged_by: null,
      acknowledged_at: null,
      source: source,
    });

    console.warn(`[EMERGENCY SOS ALERT ACTIVATED] Device: ${deviceId}, Source: ${source}, ID: ${alert.id}`);

    return NextResponse.json({
      success: true,
      message: 'Emergency SOS alert registered. Active sirens dispatched to Coordinator & Admin consoles.',
      alert_id: alert.id,
      triggered_at: alert.triggered_at,
    });
  } catch (error: any) {
    console.error('[API /hardware/sos Error]', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Failed to process SOS alert',
      },
      { status: 500 }
    );
  }
}
