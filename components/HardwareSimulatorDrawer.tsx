'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CreditCard,
  Grid,
  AlertOctagon,
  RefreshCw,
  Power,
  Volume2,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Student, Staff } from '@/lib/types';

interface HardwareSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStateChanged?: () => void;
}

export default function HardwareSimulatorDrawer({
  isOpen,
  onClose,
  onStateChanged,
}: HardwareSimulatorDrawerProps) {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStudentRfid, setSelectedStudentRfid] = useState<string>('E2806894');
  const [customRfid, setCustomRfid] = useState<string>('');

  // Keypad State
  const [keypadInput, setKeypadInput] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<'1' | '2' | '3' | '4'>('1');
  const [selectedTeacherCode, setSelectedTeacherCode] = useState<string>('01');

  // Virtual Hardware Displays & Actuators
  const [lcd1Text, setLcd1Text] = useState<{ line1: string; line2: string }>({
    line1: 'SMART OUTPASS',
    line2: 'TAP RFID CARD',
  });
  const [lcd2Text, setLcd2Text] = useState<{ line1: string; line2: string }>({
    line1: 'CLASSROOM NODE',
    line2: 'Out: 0 | Late: 0',
  });
  const [greenLed, setGreenLed] = useState<boolean>(false);
  const [redLed, setRedLed] = useState<boolean>(false);
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [gateAngle, setGateAngle] = useState<number>(0); // 0 = Closed, 90 = Open
  const [gateCountdown, setGateCountdown] = useState<number>(0);
  const [lastActionMessage, setLastActionMessage] = useState<string>('System Idle');

  // Simulated Heartbeat Generator
  const [autoHeartbeat, setAutoHeartbeat] = useState<boolean>(true);
  const heartbeatTimerRef = useRef<any>(null);

  // Fetch initial student & staff list
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data/overview');
        const data = await res.json();
        if (data.success) {
          setStudents(data.students || []);
          setStaffList(data.staff || []);
          if (data.deviceStatus?.lcd2_summary_text) {
            setLcd2Text({
              line1: 'DOOR_NODE_01',
              line2: data.deviceStatus.lcd2_summary_text,
            });
          }
        }
      } catch (e) {
        console.error('Simulator init fetch failed', e);
      }
    };
    fetchData();
  }, [isOpen]);

  // Simulated ESP32 Heartbeat Loop (every 3000ms)
  useEffect(() => {
    if (autoHeartbeat) {
      heartbeatTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/hardware/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: 'DOOR_NODE_01',
              ip_address: '192.168.1.188 (SIMULATED)',
              uptime: 300,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setLcd2Text({
              line1: 'DOOR_NODE_01',
              line2: data.lcd2_summary || 'Out: 0 | Late: 0',
            });

            // Handle pending commands (e.g. Teacher approved from remote portal)
            if (data.pending_command === 'OPEN_GATE') {
              triggerGateOpen(5, 'Approved by Teacher');
            } else if (data.pending_command === 'REJECT_BUZZER') {
              triggerBuzzer('3_SHORT');
              setRedLed(true);
              setTimeout(() => setRedLed(false), 2000);
            }
          }
        } catch (e) {
          // Heartbeat failed
        }
      }, 3000);
    } else {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    }

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [autoHeartbeat]);

  // Gate animation timer
  useEffect(() => {
    let timer: any;
    if (gateCountdown > 0) {
      timer = setTimeout(() => {
        setGateCountdown((prev) => prev - 1);
      }, 1000);
    } else if (gateCountdown === 0 && gateAngle === 90) {
      setGateAngle(0);
      setGreenLed(false);
      setLcd1Text({ line1: 'SMART OUTPASS', line2: 'TAP RFID CARD' });
    }
    return () => clearTimeout(timer);
  }, [gateCountdown, gateAngle]);

  const triggerGateOpen = (seconds: number = 5, reason: string = '') => {
    setGateAngle(90);
    setGateCountdown(seconds);
    setGreenLed(true);
    setRedLed(false);
    triggerBuzzer('1_SHORT');
    if (reason) setLastActionMessage(`Gate opened: ${reason}`);
  };

  const triggerBuzzer = (pattern: string) => {
    setBuzzerActive(true);
    // Beep sound simulation
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 2400;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}

    setTimeout(() => {
      setBuzzerActive(false);
    }, 400);
  };

  // 1. Simulate RFID Scan
  const handleSimulateScan = async (uidToScan?: string) => {
    const cardUid = uidToScan || customRfid || selectedStudentRfid;
    try {
      const res = await fetch('/api/hardware/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_uid: cardUid,
          device_id: 'DOOR_NODE_01',
          source: 'SIMULATED',
        }),
      });

      const data = await res.json();

      setLcd1Text({
        line1: data.lcd1 || 'Card Scanned',
        line2: data.lcd2 || '',
      });
      setLastActionMessage(data.message || data.action);

      if (data.beep_pattern) {
        triggerBuzzer(data.beep_pattern);
      }

      if (data.open_gate) {
        triggerGateOpen(data.gate_hold_sec || 5, data.message);
      } else {
        if (data.action === 'REQUIRE_REASON') {
          setRedLed(true);
          setGreenLed(false);
        } else if (data.action === 'ACCESS_DENIED') {
          setRedLed(true);
          setTimeout(() => setRedLed(false), 1500);
        }
      }

      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      setLastActionMessage(`Error: ${err.message}`);
    }
  };

  // 2. Simulate Keypad Reason Submission
  const handleSimulateReason = async () => {
    const student = students.find((s) => s.rfid_uid === selectedStudentRfid);
    try {
      const res = await fetch('/api/hardware/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_uid: selectedStudentRfid,
          student_id: student?.id,
          reason_key: selectedReason,
          teacher_code: selectedReason === '1' ? selectedTeacherCode : undefined,
          notes: `Simulated via hardware drawer Keypad #${selectedReason}`,
          device_id: 'DOOR_NODE_01',
          source: 'SIMULATED',
        }),
      });

      const data = await res.json();
      setLcd1Text({
        line1: data.lcd1 || 'Reason Submitted',
        line2: data.lcd2 || '',
      });
      setLastActionMessage(data.message);

      if (data.beep_pattern) triggerBuzzer(data.beep_pattern);
      if (data.open_gate) {
        triggerGateOpen(5, 'Entry Granted by Policy');
      }

      setKeypadInput('');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      setLastActionMessage(`Reason error: ${err.message}`);
    }
  };

  // 3. Simulate SOS Button Click
  const handleSimulateSos = async () => {
    try {
      const res = await fetch('/api/hardware/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: 'DOOR_NODE_01',
          source: 'SIMULATED',
        }),
      });
      const data = await res.json();
      setLcd1Text({ line1: 'EMERGENCY SOS!', line2: 'ALARM ACTIVE' });
      triggerBuzzer('3_ALERT');
      setRedLed(true);
      setLastActionMessage('Emergency SOS Triggered! Alert dispatched to Coordinator.');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      setLastActionMessage(`SOS Error: ${err.message}`);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === '#') {
      handleSimulateReason();
    } else if (val === '*') {
      setKeypadInput('');
    } else {
      setKeypadInput((prev) => (prev.length < 6 ? prev + val : prev));
      if (['1', '2', '3', '4'].includes(val) && keypadInput.length === 0) {
        setSelectedReason(val as any);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col h-full overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">HARDWARE SIMULATOR</h3>
                <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                  DEMO MODE
                </span>
              </div>
              <p className="text-xs text-slate-400">Virtual ESP32 DevKit V1 & Door Peripherals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 space-y-6 flex-1 text-slate-200">
          {/* Heartbeat Status & Toggle */}
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power className={`w-4 h-4 ${autoHeartbeat ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-semibold text-white">Simulated ESP32 Heartbeat</div>
                <div className="text-[11px] text-slate-400">
                  {autoHeartbeat ? 'Sending /api/hardware/heartbeat every 3s' : 'Heartbeat paused (Simulates device offline)'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setAutoHeartbeat(!autoHeartbeat)}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                autoHeartbeat ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {autoHeartbeat ? 'Active (Online)' : 'Paused (Offline)'}
            </button>
          </div>

          {/* Section 1: Virtual Hardware Actuators (LCDs, LEDs, Buzzer, Gate) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Door Hardware Actuators & Displays</span>
            </h4>

            {/* Virtual LCD Displays */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* LCD 1: Door Status Prompt (0x27) */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-700">
                <div className="text-[10px] text-slate-400 font-mono mb-1 flex justify-between">
                  <span>LCD 1 (0x27 - Door Prompt)</span>
                  <span className="text-amber-400">16x2 I2C</span>
                </div>
                <div className="lcd-screen p-2 rounded text-xs font-mono h-14 flex flex-col justify-center">
                  <div className="truncate">{lcd1Text.line1.padEnd(16, ' ')}</div>
                  <div className="truncate">{lcd1Text.line2.padEnd(16, ' ')}</div>
                </div>
              </div>

              {/* LCD 2: Classroom Monitor (0x26) */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-700">
                <div className="text-[10px] text-slate-400 font-mono mb-1 flex justify-between">
                  <span>LCD 2 (0x26 - Classroom Count)</span>
                  <span className="text-sky-400">16x2 I2C</span>
                </div>
                <div className="lcd-screen-blue p-2 rounded text-xs font-mono h-14 flex flex-col justify-center">
                  <div className="truncate">{lcd2Text.line1.padEnd(16, ' ')}</div>
                  <div className="truncate">{lcd2Text.line2.padEnd(16, ' ')}</div>
                </div>
              </div>
            </div>

            {/* Actuators: LEDs, Buzzer, Servo Gate Angle */}
            <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-700 text-center">
              {/* Green LED */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-mono mb-1">Green (GPIO 2)</span>
                <div
                  className={`w-6 h-6 rounded-full border transition-all ${
                    greenLed
                      ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_12px_#34d399]'
                      : 'bg-emerald-950 border-emerald-900 opacity-40'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1">{greenLed ? 'ON' : 'OFF'}</span>
              </div>

              {/* Red LED */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-mono mb-1">Red (GPIO 16)</span>
                <div
                  className={`w-6 h-6 rounded-full border transition-all ${
                    redLed
                      ? 'bg-rose-500 border-rose-300 shadow-[0_0_12px_#f43f5e]'
                      : 'bg-rose-950 border-rose-900 opacity-40'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1">{redLed ? 'ON' : 'OFF'}</span>
              </div>

              {/* Buzzer */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-mono mb-1">Buzzer (GPIO 17)</span>
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    buzzerActive
                      ? 'bg-amber-400 border-amber-300 text-slate-900 shadow-[0_0_12px_#fbbf24] animate-bounce'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-50'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1">{buzzerActive ? 'BEEP' : 'QUIET'}</span>
              </div>

              {/* Servo Gate */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-mono mb-1">Gate (GPIO 15)</span>
                <div
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                    gateAngle === 90
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {gateAngle}° {gateAngle === 90 ? `(${gateCountdown}s)` : 'LOCK'}
                </div>
                <span className="text-[10px] text-slate-400 mt-1">
                  {gateAngle === 90 ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Simulate RFID Card Scan */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>1. RFID Door Tap (RC522 SPI)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">GPIO 5,18,23,19</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Select Registered Student Card:</label>
              <div className="grid grid-cols-2 gap-2">
                {students.map((student) => {
                  const isSelected = selectedStudentRfid === student.rfid_uid;
                  return (
                    <button
                      key={student.id}
                      onClick={() => {
                        setSelectedStudentRfid(student.rfid_uid);
                        setCustomRfid('');
                      }}
                      className={`text-left p-2 rounded-lg border transition text-xs ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold truncate">{student.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 flex justify-between mt-0.5">
                        <span>{student.roll_no}</span>
                        <span className="text-blue-400 font-bold">{student.rfid_uid}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Status:{' '}
                        <span
                          className={`font-semibold ${
                            student.current_status === 'INSIDE'
                              ? 'text-emerald-400'
                              : student.current_status === 'OUTSIDE_ACTIVE'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {student.current_status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom RFID input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Or enter custom RFID UID (e.g. E2806894)"
                value={customRfid}
                onChange={(e) => setCustomRfid(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono"
              />
            </div>

            {/* Tap Button */}
            <button
              onClick={() => handleSimulateScan()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Tap RFID Card at Door</span>
            </button>
          </div>

          {/* Section 3: 4x4 Keypad Simulation (Overdue Reason Submission) */}
          <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Grid className="w-4 h-4" />
                <span>2. 4x4 Matrix Keypad (Overdue Reasons)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Rows 13,12,14,27 | Cols 26,25,33,32</span>
            </div>

            {/* Reason selector quick radio pills */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Select Overdue Reason Key:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setSelectedReason('1')}
                  className={`p-2 rounded-lg border text-left transition ${
                    selectedReason === '1'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold">Key 1: Teacher Visit</div>
                  <div className="text-[10px] text-slate-400">Requires Teacher Approval</div>
                </button>

                <button
                  onClick={() => setSelectedReason('2')}
                  className={`p-2 rounded-lg border text-left transition ${
                    selectedReason === '2'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold">Key 2: Coordinator</div>
                  <div className="text-[10px] text-slate-400">Admin/Coord Review</div>
                </button>

                <button
                  onClick={() => setSelectedReason('3')}
                  className={`p-2 rounded-lg border text-left transition ${
                    selectedReason === '3'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold">Key 3: Infirmary</div>
                  <div className="text-[10px] text-slate-400">Medical Room Visit</div>
                </button>

                <button
                  onClick={() => setSelectedReason('4')}
                  className={`p-2 rounded-lg border text-left transition ${
                    selectedReason === '4'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-bold">Key 4: Other</div>
                  <div className="text-[10px] text-slate-400">Immediate Parent Alert</div>
                </button>
              </div>
            </div>

            {/* Teacher Code Selector (if Reason 1 selected) */}
            {selectedReason === '1' && (
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 space-y-1">
                <label className="text-[11px] text-slate-300">Teacher 2-Digit Shortcode:</label>
                <select
                  value={selectedTeacherCode}
                  onChange={(e) => setSelectedTeacherCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                >
                  {staffList
                    .filter((s) => s.role === 'TEACHER')
                    .map((t) => (
                      <option key={t.id} value={t.keypad_code || '01'}>
                        #{t.keypad_code} - {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* 4x4 Keypad Grid */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 font-mono">Keypad Input Buffer:</span>
                <span className="font-mono text-amber-400 text-sm font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 min-w-[60px] text-right">
                  {keypadInput || '_'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 font-mono">
                {['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'].map(
                  (key) => (
                    <button
                      key={key}
                      onClick={() => handleKeypadPress(key)}
                      className={`p-2 rounded text-xs font-bold transition ${
                        key === '#'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : key === '*'
                          ? 'bg-rose-700 hover:bg-rose-600 text-white'
                          : ['1', '2', '3', '4'].includes(key)
                          ? 'bg-slate-800 hover:bg-amber-600 text-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {key}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Submit Reason Button */}
            <button
              onClick={handleSimulateReason}
              className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Submit Reason via Keypad (#)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Section 4: Emergency SOS Push Button */}
          <div className="bg-rose-950/40 p-4 rounded-xl border border-rose-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                <span>3. Physical SOS Emergency Button</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">GPIO 34 / Pull-up</span>
            </div>

            <p className="text-xs text-rose-200/80">
              Pressing the emergency switch logs an immediate alert and broadcasts audio-visual sirens across
              the Coordinator & Admin consoles.
            </p>

            <button
              onClick={handleSimulateSos}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold tracking-wider rounded-lg text-sm shadow-lg shadow-red-600/40 border-2 border-red-400 active:scale-98 transition flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>TRIGGER PHYSICAL SOS BUTTON</span>
            </button>
          </div>

          {/* Action Log Status Box */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
            <div className="text-[10px] text-slate-400 mb-1">Last Simulator Response:</div>
            <div className="text-emerald-400 break-all">{lastActionMessage}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
