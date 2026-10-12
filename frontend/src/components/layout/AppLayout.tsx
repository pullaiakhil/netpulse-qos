import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, X, Wifi, WifiOff } from 'lucide-react';
import { useHealth } from '@/hooks/useHealth';

export const AppLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: health, isError } = useHealth(10000);

  const isConnected = !!health && !isError;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-text-primary/30 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-white border-b border-border px-4 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-md text-text-secondary hover:bg-surface-secondary md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-xs font-medium text-text-secondary hidden sm:inline-block">
              Network Telemetry & Real-Time Performance Analytics
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Backend connection pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-success-bg text-success-text border-success/30'
                  : 'bg-critical-bg text-critical-text border-critical/30'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Backend Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Backend Disconnected</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
