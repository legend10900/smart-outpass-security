'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { MovementLog, Staff, Student } from '@/lib/types';

export default function TeacherPortalPage() {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [movementLogs, setMovementLogs] = useState<MovementLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/data/overview');
      const data = await res.json();
      if (data.success) {
        const staffList: Staff[] = data.staff || [];
        const teacherList = staffList.filter((s) => s.role === 'TEACHER');
        setTeachers(teacherList);
        if (!selectedTeacherId && teacherList.length > 0) {
          setSelectedTeacherId(teacherList[0].id);
        }
        setMovementLogs(data.movementLogs || []);
        setStudents(data.students || []);
      }
    } catch (e) {
      console.error('Error fetching teacher data', e);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 2000);
    return () => clearInterval(interval);
  }, [selectedTeacherId]);

  const activeTeacher = teachers.find((t) => t.id === selectedTeacherId);

  // Filter logs targeting this teacher or reason TEACHER awaiting verification
  const pendingRequests = movementLogs.filter((log) => {
    const isTeacherReason = log.overdue_reason === 'TEACHER';
    const isPending = log.verification_status === 'PENDING';
    const isMyTeacher = !log.target_staff_id || log.target_staff_id === selectedTeacherId;
    return isTeacherReason && isPending && isMyTeacher;
  });

  const verifiedLogs = movementLogs.filter((log) => {
    return (
      log.overdue_reason === 'TEACHER' &&
      (log.verified_by_staff_id === selectedTeacherId || log.target_staff_id === selectedTeacherId) &&
      (log.verification_status === 'APPROVED' || log.verification_status === 'REJECTED')
    );
  });

  const handleVerify = async (movementId: string, decision: 'APPROVE' | 'REJECT') => {
    if (!selectedTeacherId) return;
    setProcessingId(movementId);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/staff/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement_id: movementId,
          staff_id: selectedTeacherId,
          decision: decision,
          remarks: remarks[movementId] || '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMessage(
          decision === 'APPROVE'
            ? '✓ Visit approved! Gate unlock command sent to ESP32 door reader.'
            : '✕ Visit rejected. Alert dispatched to Coordinator and Parent notified.'
        );
        await fetchOverview();
      } else {
        setFeedbackMessage(`Verification error: ${data.message}`);
      }
    } catch (err: any) {
      setFeedbackMessage(`Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Teacher Account Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <GraduationCap className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Teacher Verification Console
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Review incoming student admission requests when overdue students cite visiting your classroom.
          </p>
        </div>

        {/* Teacher Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">Logged-in Faculty:</label>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} (Keypad Code: #{teacher.keypad_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Action Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedbackMessage.startsWith('✓')
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedbackMessage}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Verification Requests Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Incoming Door Verification Requests</span>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-bold font-mono animate-pulse">
                  {pendingRequests.length} PENDING
                </span>
              )}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Keypad Code #{activeTeacher?.keypad_code || '01'}
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="font-bold text-white text-sm">No Pending Requests</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              There are no overdue students currently waiting at the door citing your classroom (#
              {activeTeacher?.keypad_code}). Any incoming requests will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pendingRequests.map((log) => {
              const student = log.student || students.find((s) => s.id === log.student_id);
              const exitTime = new Date(log.exit_time);
              const elapsedSec = Math.round((Date.now() - exitTime.getTime()) / 1000);

              return (
                <div
                  key={log.id}
                  className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                        Awaiting Your Approval
                      </span>
                      <h3 className="font-bold text-white text-base mt-2">{student?.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {student?.roll_no} • {student?.class_section}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-rose-400">
                        {elapsedSec}s elapsed
                      </div>
                      <div className="text-[10px] text-slate-500">Allowed: {log.allowed_duration_sec}s</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Exited Door:</span>
                      <span className="font-mono text-slate-200">{exitTime.toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Reported Reason:</span>
                      <span className="font-mono text-amber-300 font-semibold">{log.overdue_reason}</span>
                    </div>
                    {log.reason_notes && (
                      <div className="pt-1 text-[11px] text-slate-300 border-t border-slate-800/80">
                        <span className="text-slate-500">Note: </span>
                        {log.reason_notes}
                      </div>
                    )}
                  </div>

                  {/* Remarks Input */}
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>Optional Faculty Remarks:</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Student submitted math assignment"
                      value={remarks[log.id] || ''}
                      onChange={(e) =>
                        setRemarks((prev) => ({ ...prev, [log.id]: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Approve / Reject Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleVerify(log.id, 'APPROVE')}
                      disabled={processingId === log.id}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Visit</span>
                    </button>

                    <button
                      onClick={() => handleVerify(log.id, 'REJECT')}
                      disabled={processingId === log.id}
                      className="py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Visit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Teacher's Historical Verifications */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-white text-base">Your Verified Visit History</h3>
        {verifiedLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No previous decisions recorded under your account.</p>
        ) : (
          <div className="divide-y divide-slate-800 text-xs">
            {verifiedLogs.map((log) => {
              const student = log.student || students.find((s) => s.id === log.student_id);
              const isApproved = log.verification_status === 'APPROVED';

              return (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{student?.name}</span>
                    <span className="text-slate-400 font-mono ml-2">({student?.roll_no})</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">{log.reason_notes || 'No remarks'}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        isApproved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {log.verification_status}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {log.verified_at ? new Date(log.verified_at).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
