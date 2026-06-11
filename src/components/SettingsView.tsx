import React from 'react';
import { isSupabaseConfigured } from '../lib/db';
import { Database, RefreshCw } from 'lucide-react';

interface Props {
  onResetDatabase: () => void;
}

export default function SettingsView({ onResetDatabase }: Props) {
  const handleReset = () => {
    if (confirm('Are you sure you want to completely clear the database? All records will be deleted!')) {
      onResetDatabase();
      alert('Database cleared! The application will restart.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Settings & System</h2>
        <p className="text-xs text-gray-500 mt-1 font-sans">Full database management and system settings.</p>
      </div>

      <div className="max-w-xl">
        
        {/* Status indicator database */}
        <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-850 flex items-center gap-1.5 border-b pb-2">
            <Database size={16} className="text-emerald-700" />
            Database Status
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

            <div className="pt-2 border-t space-y-2.5">
              <p className="font-bold text-gray-800">Clear/Reset Database:</p>
              <button 
                onClick={handleReset}
                className="w-full py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className="animate-spin" />
                Completely Clear Database (Wipe DB)
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
