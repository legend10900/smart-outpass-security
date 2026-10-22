'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HeartPulse,
  Send,
  MessageSquare,
  Users,
  Search,
  Bell,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { MovementLog, Student, Staff } from '@/lib/types';

export default function CoordinatorPortalPage() {
  const [movementLogs, setMovementLogs] = useState<MovementLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [coordinator, setCoordinator] = useState<Staff | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL_OVERDUE' | 'COORDINATOR' | 'INFIRMARY' | 'OTHER' | 'REJECTED_BY_TEACHER'>('ALL_OVERDUE');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data/overview');
      const data = await res.json();
      if (data.success) {
        setMovementLogs(data.movementLogs || []);
        setStudents(data.students || []);
        const coord = (data.staff || []).find((s: Staff) => s.role === 'COORDINATOR') || null;
        setCoordinator(coord);
      }
    } catch (e) {
      console.error('Coordinator fetch error', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Filter queues
  const allOverdueLogs = movementLogs.filter((m) => m.status === 'OVERDUE' || m.verification_status === 'PENDING');
  const coordinatorQueue = movementLogs.filter((m) => m.overdue_reason === 'COORDINATOR' && m.verification_status === 'PENDING');
  const infirmaryQueue = movementLogs.filter((m) => m.overdue_reason === 'INFIRMARY' && m.verification_status === 'PENDING');
  const otherQueue = movementLogs.filter((m) => m.overdue_reason === 'OTHER');
  const rejectedByTeacherQueue = movementLogs.filter((m) => m.overdue_reason === 'TEACHER' && m.verification_status === 'REJECTED');

  const getFilteredList = () => {
    switch (activeTab) {
      case 'COORDINATOR':
        return coordinatorQueue;
      case 'INFIRMARY':
        return infirmaryQueue;
      case 'OTHER':
        return otherQueue;
      case 'REJECTED_BY_TEACHER':
        return rejectedByTeacherQueue;
      case 'ALL_OVERDUE':
      default:
        return allOverdueLogs;
    }
  };

  const currentList = getFilteredList();

  const handleVerify = async (movementId: string, decision: 'APPROVE' | 'REJECT') => {
    if (!coordinator) return;
    setProcessingId(movementId);
    setFeedback(null);

    try {
      const res = await fetch('/api/staff/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement_id: movementId,
          staff_id: coordinator.id,
          decision: decision,
          remarks: remarks[movementId] || '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback(
          decision === 'APPROVE'
            ? '✓ Outpass approved! Gate open command sent to ESP32.'
            : '✕ Outpass rejected. Retained in overdue ledger.'
        );
        await fetchData();
      } else {
        setFeedback(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setFeedback(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Coordinator Security Command
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Centralized triage for overdue transition violations, infirmary visits, and parent notifications.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs">
          <span className="text-slate-400">Coordinator:</span>
          <span className="font-bold text-white">{coordinator?.name || 'Head Coordinator'}</span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className="p-3 bg-blue-950/80 border border-blue-500/50 rounded-xl text-xs text-blue-200 font-semibold flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('ALL_OVERDUE')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'ALL_OVERDUE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <span>All Overdue / Pending</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
            {allOverdueLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('COORDINATOR')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'COORDINATOR'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <span>Keypad #2 (Coordinator)</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
            {coordinatorQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('INFIRMARY')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'INFIRMARY'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" />
          <span>Infirmary / Medical (Keypad #3)</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
            {infirmaryQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('OTHER')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'OTHER'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <span>Keypad #4 (Other & Notified)</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
            {otherQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REJECTED_BY_TEACHER')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'REJECTED_BY_TEACHER'
              ? 'bg-red-700 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Rejected Teacher Visits</span>
          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
            {rejectedByTeacherQueue.length}
          </span>
        </button>
      </div>

      {/* Card Grid of Current Queue */}
      {currentList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
          No records currently pending in the selected queue.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((log) => {
            const student = log.student || students.find((s) => s.id === log.student_id);
            const exitTime = new Date(log.exit_time);
            const elapsedSec = Math.round((Date.now() - exitTime.getTime()) / 1000);

            return (
              <div
                key={log.id}
                className={`bg-slate-900 rounded-2xl p-5 border-2 shadow-xl space-y-4 ${
                  log.overdue_reason === 'INFIRMARY'
                    ? 'border-rose-500/60'
                    : log.verification_status === 'REJECTED'
                    ? 'border-red-600/80'
                    : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                        log.overdue_reason === 'INFIRMARY'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {log.overdue_reason}
                    </span>
                    <h3 className="font-bold text-white text-base mt-2">{student?.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {student?.roll_no} • {student?.class_section}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-rose-400">
                      {elapsedSec}s elapsed
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Exited: {exitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Parent Contact & Notification Status */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Parent:</span>
                    <span className="text-slate-200 font-medium">
                      {student?.parent_name} ({student?.parent_contact})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Parent Notified:</span>
                    <span
                      className={`font-mono font-semibold ${
                        log.parent_notified ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {log.parent_notified
                        ? `✓ 200 OK (${log.parent_notified_at ? new Date(log.parent_notified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'})`
                        : 'No'}
                    </span>
                  </div>
                  {log.reason_notes && (
                    <div className="pt-1 text-slate-300 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-500">Notes:</span> {log.reason_notes}
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <input
                    type="text"
                    placeholder="Coordinator notes / verification remarks..."
                    value={remarks[log.id] || ''}
                    onChange={(e) =>
                      setRemarks((prev) => ({ ...prev, [log.id]: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Coordinator Actions */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => handleVerify(log.id, 'APPROVE')}
                    disabled={processingId === log.id}
                    className="py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Open</span>
                  </button>

                  <button
                    onClick={() => handleVerify(log.id, 'REJECT')}
                    disabled={processingId === log.id}
                    className="py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject / Flag</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
