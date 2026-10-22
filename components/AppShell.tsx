'use client';

import React, { useState } from 'react';
import GlobalHeader from './GlobalHeader';
import HardwareSimulatorDrawer from './HardwareSimulatorDrawer';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <GlobalHeader
        onToggleSimulator={() => setIsSimulatorOpen((prev) => !prev)}
        isSimulatorOpen={isSimulatorOpen}
      />
      <main className="flex-1 pb-16">{children}</main>
      <HardwareSimulatorDrawer
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}
