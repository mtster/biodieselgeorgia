import React from 'react';

interface Props {
  onResetDatabase: () => void;
}

export default function SettingsView({ onResetDatabase }: Props) {
  return (
    <div className="space-y-6" id="settings-system-panel">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Settings & System</h2>
        <p className="text-xs text-gray-500 mt-1 font-sans">System core configuration options.</p>
      </div>

      <div className="max-w-xl pb-10">
        <div className="bg-white border p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">
            Reset System Database
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            Warning: Resetting the database will delete all local storage records (users, suppliers, orders, history, and lookups) and reset them to system defaults. This action cannot be undone.
          </p>
          <button
            onClick={() => {
              if (confirm("Are you absolutely sure you want to reset the system database? All local mock modifications will be lost.")) {
                onResetDatabase();
                alert("Database reset successfully! Reloading...");
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition cursor-pointer"
          >
            Reset Database & Recalibrate
          </button>
        </div>
      </div>

    </div>
  );
}
