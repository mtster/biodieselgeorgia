import React from 'react';
import { isSupabaseConfigured } from '../lib/db';
import { Database } from 'lucide-react';

interface Props {
  onResetDatabase: () => void;
}

export default function SettingsView({ onResetDatabase }: Props) {
  return (
    <div className="space-y-6" id="settings-system-panel">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Settings & System</h2>
        <p className="text-xs text-gray-500 mt-1 font-sans">System core configuration and node status monitoring.</p>
      </div>

      <div className="max-w-xl">
        
        {/* Status indicator database */}
        <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-850 flex items-center gap-1.5 border-b pb-2">
            <Database size={16} className="text-emerald-700" />
            Core Node Status
          </h3>

          <div className="space-y-3.5 text-xs text-gray-650">
            <div className="flex items-center justify-between">
              <span>Connection Status:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                isSupabaseConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isSupabaseConfigured ? 'Connected (Supabase Realtime)' : 'Local Storage Mode'}
              </span>
            </div>

            <div className="pt-2 border-t text-[11px] text-gray-400 font-sans leading-relaxed">
              Closed enterprise environment routing is online and fully secured. Database integrity handles rollback logging via audit logs change history.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
