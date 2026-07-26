import React from 'react';
import { User, Truck } from '../../types';
import { LogOut, Leaf, Truck as TruckIcon, UserCheck, Users } from 'lucide-react';

interface Props {
  currentUser: User;
  vehiclePlateText: string;
  assignedDriverName: string;
  assignedCompanionName: string;
  onLogOut: () => void;
}

export function MobileLogisticsHeader({
  currentUser,
  vehiclePlateText,
  assignedDriverName,
  assignedCompanionName,
  onLogOut,
}: Props) {
  return (
    <header className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white px-5 py-4 shadow-xl sticky top-0 z-30 border-b border-emerald-800/40 backdrop-blur-md">
      <div className="max-w-md mx-auto w-full space-y-3.5">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30 shadow-inner flex items-center justify-center">
              <Leaf size={20} className="drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider leading-none text-white uppercase font-sans">
                ბიოდიზელი ჯორჯია
              </h1>
            </div>
          </div>

          <button 
            onClick={onLogOut}
            title="გასვლა"
            className="p-2 bg-white/10 hover:bg-red-600/90 text-slate-200 hover:text-white rounded-xl transition border border-white/15 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Sleek Tiles (Number Plate, Driver, Companion) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* Number Plate Tile */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 flex items-center justify-between shadow-xs relative overflow-hidden group">
            <div className="flex items-center gap-2">
              <div className="w-2 h-5 bg-blue-600 rounded-2xs flex-shrink-0 shadow-xs"></div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">ავტომანქანა</span>
                <span className="font-mono font-extrabold text-sm tracking-wider text-amber-300 uppercase block leading-none pt-0.5">
                  {vehiclePlateText || 'N/A'}
                </span>
              </div>
            </div>
            <TruckIcon size={16} className="text-slate-500 group-hover:text-amber-400 transition" />
          </div>

          {/* Driver Tile */}
          <div className="bg-emerald-950/70 border border-emerald-800/60 rounded-xl px-3 py-2 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-emerald-800/60 text-emerald-300 rounded-lg flex-shrink-0">
                <UserCheck size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/80 block leading-tight">მძღოლი</span>
                <span className="text-xs font-extrabold text-white truncate block leading-none pt-0.5" title={assignedDriverName}>
                  {assignedDriverName}
                </span>
              </div>
            </div>
          </div>

          {/* Companion Tile */}
          <div className="bg-emerald-950/70 border border-emerald-800/60 rounded-xl px-3 py-2 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-amber-800/50 text-amber-300 rounded-lg flex-shrink-0">
                <Users size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80 block leading-tight">დამხმარე</span>
                <span className="text-xs font-extrabold text-white truncate block leading-none pt-0.5" title={assignedCompanionName}>
                  {assignedCompanionName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
