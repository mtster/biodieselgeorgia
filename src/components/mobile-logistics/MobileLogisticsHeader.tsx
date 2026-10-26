import React from 'react';
import { User } from '../../types';
import { Leaf, LogOut, Truck, User as UserIcon, Users } from 'lucide-react';

export interface MobileLogisticsHeaderProps {
  currentUser: User;
  vehiclePlateText: string;
  assignedDriverName: string;
  assignedCompanionName: string;
  onLogOut: () => void;
}

export function MobileLogisticsHeader({
  vehiclePlateText,
  assignedDriverName,
  assignedCompanionName,
  onLogOut
}: MobileLogisticsHeaderProps) {
  return (
    <header className="bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-800 text-white pt-[max(0.75rem,env(safe-area-inset-top,0px))] px-4 pb-4 shadow-lg border-b border-emerald-700/50">
      <div className="max-w-md mx-auto space-y-3">
        {/* Brand & Action Bar - Seamless at top */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xs">
              <Leaf size={18} className="text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-white leading-tight">
                ბიოდიზელი ჯორჯია
              </span>
              <span className="text-[10px] text-emerald-200/80 font-medium leading-tight">
                ლოჯისტიკის პორტალი
              </span>
            </div>
          </div>

          <button
            onClick={onLogOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/15 text-white text-xs font-semibold backdrop-blur-md transition cursor-pointer select-none"
            title="სისტემიდან გამოსვლა"
          >
            <LogOut size={13} className="text-emerald-300" />
            <span>გამოსვლა</span>
          </button>
        </div>

        {/* Top-most Info (Vehicle Plate, Driver, Companion) */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-inner space-y-2.5">
          {/* Plate Number */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={15} className="text-emerald-300" />
              <span className="text-xs font-medium text-emerald-200/90">ავტომობილი:</span>
            </div>
            <div className="inline-flex items-center bg-white border border-slate-300 rounded-md px-2.5 py-0.5 shadow-xs">
              <span className="text-[9px] font-black text-blue-700 mr-1.5 tracking-tighter border-r border-slate-300 pr-1">
                GE
              </span>
              <span className="text-xs font-black tracking-wider text-slate-900 font-mono">
                {vehiclePlateText || 'არ არის მინიჭებული'}
              </span>
            </div>
          </div>

          {/* Assigned Crew (Driver and Companion) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
            <div className="flex items-start gap-1.5 min-w-0">
              <UserIcon size={14} className="text-emerald-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-emerald-200/80 leading-none">მძღოლი</p>
                <p className="text-xs font-bold text-white truncate mt-0.5">{assignedDriverName}</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5 min-w-0">
              <Users size={14} className="text-emerald-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-emerald-200/80 leading-none">თანმხლები</p>
                <p className="text-xs font-bold text-white truncate mt-0.5">{assignedCompanionName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
