/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserProfile, UserRole } from '../types';
import { isSupabaseConfigured, translateRole } from '../lib/db';
import { Shield, Sparkles, User, Users, Store, Disc, Layers } from 'lucide-react';

interface RoleSelectorProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onUserChange: (user: UserProfile) => void;
}

export default function RoleSelector({ currentUser, allUsers, onUserChange }: RoleSelectorProps) {
  return (
    <div id="role-selector-container" className="bg-white border-b border-gray-100 px-4 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Connection status and app identity */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-xs font-medium text-gray-500 font-mono">
              {isSupabaseConfigured ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                  <Layers size={11} /> Cloud Supabase აქტიურია
                </span>
              ) : (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1">
                  <Disc size={11} className="animate-spin" /> ლოკალური რეჟიმი (Sandbox)
                </span>
              )}
            </span>
          </div>

          <div className="text-xs font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-100/50 px-2.5 py-0.5 rounded-md flex items-center gap-1">
            <Sparkles size={11} /> GA
          </div>
        </div>

        {/* User profile selection tabs inside a clean iOS-like segmented control */}
        <div id="user-selection-segmented" className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full md:w-auto">
          <span className="text-xs font-semibold text-gray-400 whitespace-nowrap mr-1 flex items-center gap-1">
            <User size={12} /> როლის სიმულაცია:
          </span>
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50 w-full md:w-auto overflow-x-auto scrollbar-none min-w-max">
            {allUsers.map((user) => {
              const isActive = currentUser.id === user.id;
              return (
                <button
                  key={user.id}
                  id={`role-btn-${user.id}`}
                  onClick={() => onUserChange(user)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-emerald-800 shadow-sm font-bold scale-[1.02]'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {getIconForRole(user.role)}
                  <span>{user.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-200/60 text-gray-600 rounded-md font-normal scale-[0.9]">
                    {translateRole(user.role)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getIconForRole(role: UserRole) {
  switch (role) {
    case 'admin':
      return <Shield size={12} className="text-indigo-500" />;
    case 'manager':
      return <Users size={12} className="text-teal-500" />;
    case 'driver':
      return <Disc size={12} className="text-orange-500" />;
    case 'venue':
      return <Store size={12} className="text-emerald-500" />;
    default:
      return <User size={12} />;
  }
}
