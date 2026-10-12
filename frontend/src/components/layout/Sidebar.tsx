import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Target,
  ArrowUpDown,
  Shield,
  Bell,
  FileText,
  Settings,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Overview', to: '/', icon: LayoutDashboard },
  { name: 'Live Monitoring', to: '/monitoring', icon: Activity },
  { name: 'Targets', to: '/targets', icon: Target },
  { name: 'Throughput', to: '/throughput', icon: ArrowUpDown },
  { name: 'QoS Assessment', to: '/qos', icon: Shield },
  { name: 'Alerts', to: '/alerts', icon: Bell },
  { name: 'Reports', to: '/reports', icon: FileText },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  return (
    <aside className="w-60 bg-white border-r border-border h-full flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-border gap-2.5">
        <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center text-white shadow-xs">
          <Radio className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight text-text-primary flex items-center gap-1.5">
            NetPulse <span className="text-[10px] uppercase font-bold text-accent bg-accent-light px-1.5 py-0.2 rounded">QoS</span>
          </span>
          <span className="text-[11px] text-text-muted">Enterprise Monitor</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors border-l-2',
                  isActive
                    ? 'bg-accent/10 text-accent border-accent font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary border-transparent'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-border bg-surface-secondary/40">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success"></span>
          <span className="text-xs text-text-secondary font-medium">Engine v1.0.0 Active</span>
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          IEEE 802.1Q QoS Architecture
        </div>
      </div>
    </aside>
  );
};
