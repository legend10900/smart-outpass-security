// ============================================================================
// API Route: POST /api/sos/acknowledge
// Acknowledges and silences active SOS alerts from Coordinator/Admin dashboards.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeSosAlert } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, acknowledged_by } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing SOS alert ID' }, { status: 400 });
    }

    const updated = await acknowledgeSosAlert(id, acknowledged_by || 'School Coordinator');
    return NextResponse.json({
      success: true,
      message: 'SOS alert acknowledged and silenced',
      alert: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
