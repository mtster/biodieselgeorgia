import React from 'react';

export default function SettingsView() {
  return (
    <div className="space-y-6" id="settings-system-panel">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Settings</h2>
      </div>
      
      {/* Empty space for future configuration */}
      <div className="min-h-[400px] flex items-center justify-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/30">
        <p className="text-xs text-gray-405 font-mono italic">Settings page is currently empty. Custom parameters will be declared here.</p>
      </div>
    </div>
  );
}
