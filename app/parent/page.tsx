'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  Bell,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Send,
  Calendar,
} from 'lucide-react';
import { Student, MovementLog, NotificationLog } from '@/lib/types';

export default function ParentPortalPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [movementLogs, setMovementLogs] = useState<MovementLog[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data/overview');
      const data = await res.json();
      if (data.success) {
        const studentList: Student[] = data.students || [];
        setStudents(studentList);
        if (!selectedStudentId && studentList.length > 0) {
          setSelectedStudentId(studentList[0].id);
        }
        setMovementLogs(data.movementLogs || []);
        setNotificationLogs(data.notificationLogs || []);
      }
    } catch (e) {
      console.error('Parent portal fetch error', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedStudentId]);

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  // Strictly isolate data to selected student
  const studentLogs = movementLogs.filter((m) => m.student_id === selectedStudentId);
  const studentMovementIds = studentLogs.map((m) => m.id);

  const studentNotifications = notificationLogs.filter(
    (n) =>
      (n.recipient_type === 'PARENT' &&
        (n.recipient_identifier === currentStudent?.parent_contact ||
          n.recipient_identifier === currentStudent?.parent_chat_id ||
          studentMovementIds.includes(n.movement_log_id || ''))) ||
      (n.message_content && currentStudent && n.message_content.includes(currentStudent.name))
  );

  const activeMovement = studentLogs.find((m) => m.status === 'ACTIVE' || m.status === 'OVERDUE');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Student Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Users className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Parent Guardian Portal
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time classroom presence updates, audited notifications, and outpass telemetry for your child.
          </p>
        </div>

        {/* Student Selector (Simulating logged in parent session) */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <label className="text-xs text-slate-400 font-medium">Child:</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.roll_no})
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentStudent && (
        <>
          {/* Real-time Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                  Child Profile
                </span>
                <h2 className="text-xl font-bold text-white">{currentStudent.name}</h2>
                <p className="text-xs text-slate-400 font-mono">
                  Roll No: {currentStudent.roll_no} • {currentStudent.class_section} • RFID:{' '}
                  {currentStudent.rfid_uid}
                </p>
                <p className="text-xs text-slate-400 pt-1">
                  Registered Guardian: <span className="text-white font-medium">{currentStudent.parent_name}</span> (
                  {currentStudent.parent_contact})
                </p>
              </div>

              {/* Status Badge */}
              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-500 block mb-1">Current Presence Status</span>
                <span
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold font-mono uppercase tracking-wide border ${
                    currentStudent.current_status === 'INSIDE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : currentStudent.current_status === 'OUTSIDE_ACTIVE'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentStudent.current_status === 'INSIDE'
                        ? 'bg-emerald-400'
                        : currentStudent.current_status === 'OUTSIDE_ACTIVE'
                        ? 'bg-blue-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  {currentStudent.current_status === 'INSIDE'
                    ? 'Inside Classroom'
                    : currentStudent.current_status === 'OUTSIDE_ACTIVE'
                    ? 'Outside - Active Outpass'
                    : 'Overdue - Under Review'}
                </span>
              </div>
            </div>

            {/* Active Outpass Banner */}
            {activeMovement && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Active Classroom Exit Recorded</h4>
                    <p className="text-[11px] text-slate-400">
                      Exited door at {new Date(activeMovement.exit_time).toLocaleTimeString()} (Allowed Limit:{' '}
                      {activeMovement.allowed_duration_sec}s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {Math.round((Date.now() - new Date(activeMovement.exit_time).getTime()) / 1000)}s Elapsed
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Official Parent Notification Delivery Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Official Notification Log (200 OK Audited)</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Channel: Telegram / SMS / Automated Dispatch
              </span>
            </div>

            {studentNotifications.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No automated alert messages sent to your contact. All transitions have been on-time or non-urgent.
              </p>
            ) : (
              <div className="space-y-3">
                {studentNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>HTTP {notif.status_code} OK</span>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Channel: {notif.channel}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {notif.confirmed_at
                          ? new Date(notif.confirmed_at).toLocaleString()
                          : new Date(notif.sent_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 font-sans leading-relaxed">
                      {notif.message_content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Movement History for this Student */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Historical Movement Passes</h3>
              <span className="text-xs text-slate-400 font-mono">{studentLogs.length} Records</span>
            </div>

            {studentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No movement logs recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 text-xs">
                {studentLogs.map((log) => {
                  const exitTime = new Date(log.exit_time);
                  const returnTime = log.return_time ? new Date(log.return_time) : null;
                  const durationSec = returnTime
                    ? Math.round((returnTime.getTime() - exitTime.getTime()) / 1000)
                    : null;

                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-slate-300 font-medium">
                          Outpass Exit: <span className="font-mono text-white">{exitTime.toLocaleTimeString()}</span>
                          {returnTime && (
                            <span className="text-slate-400 ml-2">
                              • Return: <span className="font-mono text-white">{returnTime.toLocaleTimeString()}</span>
                            </span>
                          )}
                        </div>
                        {log.reason_notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Note: {log.reason_notes}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            log.status === 'RETURNED_ON_TIME'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : log.status === 'RESOLVED_APPROVED'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                        {durationSec !== null && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Duration: {durationSec}s
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
