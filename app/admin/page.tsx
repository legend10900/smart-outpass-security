'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Users,
  CreditCard,
  GraduationCap,
  Save,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Server,
  Plus,
  Radio,
} from 'lucide-react';
import { SystemSettings, Student, Staff, DeviceStatus } from '@/lib/types';

export default function AdminPanelPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  // Form states
  const [allowedDuration, setAllowedDuration] = useState<number>(60);
  const [gatePolicy, setGatePolicy] = useState<'WAIT_FOR_APPROVAL' | 'ALLOW_ENTRY_AFTER_REASON'>('WAIT_FOR_APPROVAL');

  // New Student modal/form
  const [newStudent, setNewStudent] = useState({
    name: '',
    roll_no: '',
    class_section: 'Class 10-A',
    rfid_uid: '',
    parent_name: '',
    parent_contact: '',
  });

  // New Staff form
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'TEACHER' as const,
    keypad_code: '',
  });

  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data/overview');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setAllowedDuration(data.settings?.allowed_duration_sec || 60);
        setGatePolicy(data.settings?.gate_policy_on_overdue || 'WAIT_FOR_APPROVAL');
        setStudents(data.students || []);
        setStaffList(data.staff || []);
        setDeviceStatus(data.deviceStatus || null);
      }
    } catch (e) {
      console.error('Admin fetch error', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SETTINGS',
          allowed_duration_sec: allowedDuration,
          gate_policy_on_overdue: gatePolicy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback('✓ System settings updated successfully!');
        await fetchData();
      }
    } catch (e: any) {
      setFeedback(`Error: ${e.message}`);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT_STUDENT',
          student: newStudent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`✓ Registered student ${newStudent.name} with RFID ${newStudent.rfid_uid}`);
        setNewStudent({
          name: '',
          roll_no: '',
          class_section: 'Class 10-A',
          rfid_uid: '',
          parent_name: '',
          parent_contact: '',
        });
        await fetchData();
      }
    } catch (e: any) {
      setFeedback(`Error: ${e.message}`);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPSERT_STAFF',
          staff: newStaff,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`✓ Registered staff ${newStaff.name}`);
        setNewStaff({
          name: '',
          email: '',
          role: 'TEACHER',
          keypad_code: '',
        });
        await fetchData();
      }
    } catch (e: any) {
      setFeedback(`Error: ${e.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              System Administration & Config
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Global transition durations, overdue gate unlock policies, RFID mapping, and faculty accounts.
          </p>
        </div>

        {/* Node Telemetry Box */}
        {deviceStatus && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono space-y-0.5">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Node ID:</span>
              <span className="text-white font-bold">{deviceStatus.device_id}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">IP:</span>
              <span className="text-sky-400">{deviceStatus.ip_address}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Command Queue:</span>
              <span className="text-amber-400">{deviceStatus.pending_command}</span>
            </div>
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-blue-950/80 border border-blue-500/50 rounded-xl text-xs font-semibold text-blue-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Section 1: Global Timing & Gate Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Transition Time & Security Gate Policies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transition Duration */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Allowed Transition Duration (Seconds):
            </label>
            <p className="text-xs text-slate-400">
              Time allotted between door exit scan and classroom return scan before marking overdue.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="10"
                max="3600"
                value={allowedDuration}
                onChange={(e) => setAllowedDuration(parseInt(e.target.value, 10) || 60)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white w-32 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllowedDuration(60)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  60s (Demo)
                </button>
                <button
                  type="button"
                  onClick={() => setAllowedDuration(300)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  300s (5 Min)
                </button>
              </div>
            </div>
          </div>

          {/* Gate Policy on Overdue */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Gate Unlock Policy Upon Overdue Return:
            </label>
            <p className="text-xs text-slate-400">
              Behavior of the servo gate when an overdue student submits their keypad reason.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                <input
                  type="radio"
                  name="gatePolicy"
                  value="WAIT_FOR_APPROVAL"
                  checked={gatePolicy === 'WAIT_FOR_APPROVAL'}
                  onChange={() => setGatePolicy('WAIT_FOR_APPROVAL')}
                  className="text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">WAIT_FOR_APPROVAL (Default & Recommended)</div>
                  <div className="text-[11px] text-slate-400">Gate remains locked until a teacher or coordinator clicks Approve.</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                <input
                  type="radio"
                  name="gatePolicy"
                  value="ALLOW_ENTRY_AFTER_REASON"
                  checked={gatePolicy === 'ALLOW_ENTRY_AFTER_REASON'}
                  onChange={() => setGatePolicy('ALLOW_ENTRY_AFTER_REASON')}
                  className="text-blue-600 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">ALLOW_ENTRY_AFTER_REASON</div>
                  <div className="text-[11px] text-slate-400">Unlocks gate immediately once keypad reason is submitted; logs for review.</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save System Settings</span>
        </button>
      </div>

      {/* Section 2: Student RFID Registration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Student RFID Card Enrollment</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">{students.length} Registered</span>
        </div>

        {/* Enrollment Form */}
        <form onSubmit={handleAddStudent} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Enroll / Map Physical Card</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">Student Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Maya Chen"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Roll Number</label>
              <input
                type="text"
                required
                placeholder="e.g. 10-A-32"
                value={newStudent.roll_no}
                onChange={(e) => setNewStudent({ ...newStudent, roll_no: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">RFID Card UID (Hex)</label>
              <input
                type="text"
                required
                placeholder="e.g. 73C9FA12"
                value={newStudent.rfid_uid}
                onChange={(e) => setNewStudent({ ...newStudent, rfid_uid: e.target.value.toUpperCase() })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Class & Section</label>
              <input
                type="text"
                value={newStudent.class_section}
                onChange={(e) => setNewStudent({ ...newStudent, class_section: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Parent / Guardian Name</label>
              <input
                type="text"
                required
                placeholder="e.g. David Chen"
                value={newStudent.parent_name}
                onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Parent Contact / Telegram</label>
              <input
                type="text"
                required
                placeholder="e.g. +1 (555) 019-2834"
                value={newStudent.parent_contact}
                onChange={(e) => setNewStudent({ ...newStudent, parent_contact: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Register Student RFID</span>
          </button>
        </form>

        {/* Existing Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">RFID UID</th>
                <th className="py-2.5 px-3">Parent Info</th>
                <th className="py-2.5 px-3">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="py-2.5 px-3 font-bold text-white">{student.name}</td>
                  <td className="py-2.5 px-3 font-mono">{student.roll_no}</td>
                  <td className="py-2.5 px-3">{student.class_section}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{student.rfid_uid}</td>
                  <td className="py-2.5 px-3">
                    {student.parent_name} ({student.parent_contact})
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        student.current_status === 'INSIDE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {student.current_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Staff Keypad Shortcode Mapping */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Faculty & Coordinator Keypad Codes</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">{staffList.length} Accounts</span>
        </div>

        {/* Existing Staff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Keypad Shortcode</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Telegram Chat ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {staffList.map((staff) => (
                <tr key={staff.id}>
                  <td className="py-2.5 px-3 font-bold text-white">{staff.name}</td>
                  <td className="py-2.5 px-3 font-mono">{staff.role}</td>
                  <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">
                    #{staff.keypad_code || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3">{staff.email}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    {staff.notification_chat_id || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
