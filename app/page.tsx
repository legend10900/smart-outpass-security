'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowRightLeft,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Bell,
  Cpu,
} from 'lucide-react';
import { MovementLog, Student, SystemSettings } from '@/lib/types';

export default function LiveMonitorPage() {
  const [movementLogs, setMovementLogs] = useState<MovementLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Poll overview data every 2 seconds
  const fetchData = async () => {
    try {
      const res = await fetch('/api/data/overview');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setMovementLogs(data.movementLogs || []);
        setStudents(data.students || []);
        setSettings(data.settings || null);
      }
    } catch (err) {
      console.error('Failed to load overview data', err);
    }
  };

  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, 2000);
    // Local 1-second ticker for smooth countdown timers
    const ticker = setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(ticker);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Metrics computation
  const activeStudents = students.filter((s) => s.current_status === 'OUTSIDE_ACTIVE');
  const overdueStudents = students.filter(
    (s) => s.current_status === 'OVERDUE' || s.current_status === 'PENDING_VERIFICATION'
  );
  const returnedOnTimeLogs = movementLogs.filter((m) => m.status === 'RETURNED_ON_TIME');
  const pendingVerifications = movementLogs.filter((m) => m.verification_status === 'PENDING');
  const resolvedCount = movementLogs.filter(
    (m) => m.status === 'RESOLVED_APPROVED' || m.status === 'RESOLVED_REJECTED'
  );

  // Filtered Logs
  const filteredLogs = movementLogs.filter((log) => {
    const student = log.student || students.find((s) => s.id === log.student_id);
    const matchesSearch =
      !searchTerm ||
      student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.overdue_reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      log.status === statusFilter ||
      (statusFilter === 'PENDING' && log.verification_status === 'PENDING');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Live Classroom & Corridor Monitor</span>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time RFID transit tracking, 60s countdown telemetry, and role-based outpass verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            className={`p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition ${
              isRefreshing ? 'animate-spin text-blue-400' : ''
            }`}
            title="Refresh Table"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400">
            System Clock: <span className="text-white font-bold">{new Date(currentTime).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Card 1: Currently Outside */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Currently Outside</span>
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-400 mt-2 font-mono">
            {activeStudents.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Active transit passes</div>
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Returned On Time */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Returned On Time</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-2 font-mono">
            {returnedOnTimeLogs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Within {settings?.allowed_duration_sec || 60}s limit</div>
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Overdue / Expired */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Overdue / Expired</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-400 mt-2 font-mono">
            {overdueStudents.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Exceeded duration timer</div>
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Pending Verifications */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Pending Review</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 mt-2 font-mono">
            {pendingVerifications.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting staff action</div>
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 5: Resolved */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 shadow-sm col-span-2 md:col-span-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Resolved</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-400 mt-2 font-mono">
            {resolvedCount.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Approve / Reject logs</div>
          <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* Active Students Live Countdown Radar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Live Active Movement Timers</h2>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
            Configured Limit: {settings?.allowed_duration_sec || 60}s
          </span>
        </div>

        {activeStudents.length === 0 && overdueStudents.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            All students are currently <span className="text-emerald-400 font-semibold">INSIDE</span> the classroom.
            No active corridor movement timers.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Show both actively outside students and overdue students */}
            {[...activeStudents, ...overdueStudents].map((student) => {
              const activeLog = movementLogs.find(
                (m) =>
                  m.student_id === student.id &&
                  (m.status === 'ACTIVE' || m.status === 'OVERDUE')
              );

              const allowedDuration = activeLog?.allowed_duration_sec || settings?.allowed_duration_sec || 60;
              const exitTime = activeLog ? new Date(activeLog.exit_time).getTime() : currentTime;
              const elapsedSec = Math.max(0, Math.floor((currentTime - exitTime) / 1000));
              const remainingSec = allowedDuration - elapsedSec;
              const isOverdue = remainingSec <= 0 || student.current_status === 'OVERDUE' || student.current_status === 'PENDING_VERIFICATION';
              const overtimeSec = isOverdue ? Math.abs(remainingSec) : 0;

              return (
                <div
                  key={student.id}
                  className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                    isOverdue
                      ? 'bg-rose-950/30 border-rose-600/60 shadow-lg shadow-rose-950/40'
                      : 'bg-slate-800/60 border-blue-500/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{student.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        {student.roll_no} • {student.class_section}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        isOverdue ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isOverdue ? 'OVERDUE' : 'ACTIVE'}
                    </span>
                  </div>

                  {/* Countdown Display */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">
                      {isOverdue ? 'Overdue By:' : 'Time Remaining:'}
                    </span>
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${
                        isOverdue ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {isOverdue ? `+${overtimeSec}s` : `${remainingSec}s`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-700/60 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        isOverdue ? 'bg-rose-500 w-full' : 'bg-blue-500'
                      }`}
                      style={{
                        width: isOverdue
                          ? '100%'
                          : `${Math.max(0, Math.min(100, (remainingSec / allowedDuration) * 100))}%`,
                      }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Exited: {activeLog ? new Date(activeLog.exit_time).toLocaleTimeString() : 'N/A'}</span>
                    <span className="text-slate-500">RFID: {student.rfid_uid}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Movement History Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {/* Table Control Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Classroom Movement Log & Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete records of door scans, gate unlocks, overdue triggers, and parent delivery receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search student, roll #, reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Outside</option>
              <option value="RETURNED_ON_TIME">Returned On Time</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PENDING">Pending Staff Review</option>
              <option value="RESOLVED_APPROVED">Approved</option>
              <option value="RESOLVED_REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Student & Roll No</th>
                <th className="py-3 px-4">Exit Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Overdue Reason</th>
                <th className="py-3 px-4">Staff Decision</th>
                <th className="py-3 px-4">Parent Notified (200 OK)</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No movement records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const student = log.student || students.find((s) => s.id === log.student_id);
                  const exitTime = new Date(log.exit_time);
                  const returnTime = log.return_time ? new Date(log.return_time) : null;
                  const durationSec = returnTime
                    ? Math.round((returnTime.getTime() - exitTime.getTime()) / 1000)
                    : Math.round((currentTime - exitTime.getTime()) / 1000);

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      {/* Student info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{student?.name || 'Unknown Student'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {student?.roll_no} • {student?.class_section}
                        </div>
                      </td>

                      {/* Exit Time */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {exitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={
                            durationSec > log.allowed_duration_sec
                              ? 'text-rose-400 font-bold'
                              : 'text-emerald-400'
                          }
                        >
                          {durationSec}s
                        </span>
                        <span className="text-slate-500 text-[10px]"> / {log.allowed_duration_sec}s</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            log.status === 'RETURNED_ON_TIME'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : log.status === 'ACTIVE'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : log.status === 'OVERDUE'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                              : log.status === 'RESOLVED_APPROVED'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>

                      {/* Overdue Reason */}
                      <td className="py-3 px-4">
                        {log.overdue_reason !== 'NONE' ? (
                          <div>
                            <span className="font-semibold text-amber-400 font-mono text-[11px]">
                              {log.overdue_reason}
                            </span>
                            {log.reason_notes && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={log.reason_notes}>
                                {log.reason_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">N/A</span>
                        )}
                      </td>

                      {/* Staff Decision */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold text-[11px] ${
                            log.verification_status === 'APPROVED'
                              ? 'text-emerald-400'
                              : log.verification_status === 'REJECTED'
                              ? 'text-rose-400'
                              : log.verification_status === 'PENDING'
                              ? 'text-amber-400 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {log.verification_status}
                        </span>
                        {log.verified_at && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Parent Notified */}
                      <td className="py-3 px-4">
                        {log.parent_notified ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="font-mono text-[10px] font-bold">200 OK</span>
                            {log.parent_notified_at && (
                              <span className="text-slate-400 text-[10px]">
                                ({new Date(log.parent_notified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Not Required / Pending</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 font-mono">
                        {log.source === 'SIMULATED' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            DEMO
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">
                            ESP32
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
