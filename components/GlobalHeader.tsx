'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Cpu,
  Radio,
  Sliders,
  Users,
  GraduationCap,
  Bell,
  Volume2,
  VolumeX,
  Wrench,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { SosAlert } from '@/lib/types';

interface GlobalHeaderProps {
  onToggleSimulator: () => void;
  isSimulatorOpen: boolean;
}

export default function GlobalHeader({ onToggleSimulator, isSimulatorOpen }: GlobalHeaderProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string>('');
  const [activeSosList, setActiveSosList] = useState<SosAlert[]>([]);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // Poll overview data for hardware online status and active SOS
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/data/overview');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success) {
          setIsOnline(data.isHardwareOnline);
          setLastHeartbeat(data.deviceStatus?.last_heartbeat || '');
          setActiveSosList(data.activeSos || []);
        }
      } catch (err) {
        if (isMounted) setIsOnline(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Web Audio SOS Alarm Siren
  useEffect(() => {
    if (activeSosList.length > 0 && !audioMuted) {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }

      if (audioContextRef.current) {
        if (!sirenIntervalRef.current) {
          sirenIntervalRef.current = setInterval(() => {
            try {
              if (audioContextRef.current && audioContextRef.current.state === 'running') {
                const osc = audioContextRef.current.createOscillator();
                const gain = audioContextRef.current.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, audioContextRef.current.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, audioContextRef.current.currentTime + 0.35);
                gain.gain.setValueAtTime(0.15, audioContextRef.current.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(audioContextRef.current.destination);
                osc.start();
                osc.stop(audioContextRef.current.currentTime + 0.35);
              }
            } catch (e) {
              // Ignore browser audio gesture blocks
            }
          }, 900);
        }
      }
    } else {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
    }

    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
    };
  }, [activeSosList.length, audioMuted]);

  const handleAcknowledgeSos = async (sosId: string) => {
    try {
      await fetch('/api/sos/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sosId, acknowledged_by: 'Staff Console' }),
      });
      setActiveSosList((prev) => prev.filter((s) => s.id !== sosId));
    } catch (e) {
      console.error('Failed to acknowledge SOS', e);
    }
  };

  const navLinks = [
    { href: '/', label: 'Live Monitor', icon: Radio },
    { href: '/teacher', label: 'Teacher Portal', icon: GraduationCap },
    { href: '/coordinator', label: 'Coordinator Portal', icon: ShieldAlert },
    { href: '/parent', label: 'Parent Portal', icon: Users },
    { href: '/admin', label: 'Admin Panel', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-lg">
      {/* 1. High-Priority Emergency SOS Alert Banner */}
      {activeSosList.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 animate-pulse-fast border-b-2 border-red-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
            <span className="font-bold tracking-wide text-sm md:text-base">
              CRITICAL EMERGENCY SOS: Hardware Push Button Activated at Classroom Door!
            </span>
            <span className="text-xs bg-red-800 px-2 py-0.5 rounded font-mono">
              Node: {activeSosList[0].device_id} ({activeSosList[0].source})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="px-2 py-1 bg-red-700 hover:bg-red-800 rounded text-xs flex items-center gap-1"
              title={audioMuted ? 'Unmute Siren' : 'Mute Siren'}
            >
              {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {audioMuted ? 'Muted' : 'Sound On'}
            </button>
            <button
              onClick={() => handleAcknowledgeSos(activeSosList[0].id)}
              className="px-3 py-1 bg-white text-red-700 font-semibold text-xs rounded hover:bg-slate-100 transition shadow"
            >
              Acknowledge & Silence Siren
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white tracking-tight">Smart Outpass</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    IoT System
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">ESP32 + RFID Movement & Overdue Gatekeeper</p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Hardware Status Indicator & Simulator Drawer Toggle */}
          <div className="flex items-center gap-3">
            {/* Hardware Status Badge (10-second rule) */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isOnline
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/20'
                  : 'bg-rose-950/70 border-rose-500/50 text-rose-400 shadow-sm shadow-rose-500/20'
              }`}
              title={
                isOnline
                  ? `ESP32 Heartbeat active (last seen ${lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : 'now'})`
                  : 'No heartbeat received in >10 seconds from physical ESP32'
              }
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">
                {isOnline ? 'HARDWARE ONLINE (ESP32)' : 'HARDWARE OFFLINE'}
              </span>
              <span className="sm:hidden">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Hardware Simulator Drawer Button */}
            <button
              onClick={onToggleSimulator}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isSimulatorOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-amber-400 border-amber-500/40 hover:bg-slate-700 hover:border-amber-400'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="font-mono tracking-tight font-bold">[DEMO SIMULATOR]</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 overflow-x-auto text-xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-1 px-2 py-1 rounded ${
                  isActive ? 'text-blue-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] whitespace-nowrap">{link.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
