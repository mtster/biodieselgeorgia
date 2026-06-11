/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, UserRole, Venue, ActivityLog } from '../types';
import { updateUserRole, localDB } from '../lib/db';
import { Shield, Database, RotateCcw, Download, Clock, UserPlus, FileClock, ShieldAlert, BadgeCheck, MapPin } from 'lucide-react';

interface AdminPanelProps {
  adminUser: UserProfile;
  allUsers: UserProfile[];
  venues: Venue[];
  activityLogs: ActivityLog[];
  onRefreshData: () => void;
}

export default function AdminPanel({
  adminUser,
  allUsers,
  venues,
  activityLogs,
  onRefreshData
}: AdminPanelProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<UserRole>('driver');
  const [tempVenueId, setTempVenueId] = useState<string>('');
  const [tempBaseRegion, setTempBaseRegion] = useState<string>('');
  const [isSuccessMsg, setIsSuccessMsg] = useState<string | null>(null);

  const handleStartEditRole = (u: UserProfile) => {
    setEditingUserId(u.id);
    setTempRole(u.role);
    setTempVenueId(u.venue_id || '');
    setTempBaseRegion(u.base_region || '');
  };

  const handleSaveRole = async (userId: string) => {
    const success = await updateUserRole(
      userId,
      tempRole,
      tempRole === 'venue' ? tempVenueId : undefined,
      tempRole === 'manager' ? tempBaseRegion : undefined,
      adminUser.name
    );

    if (success) {
      showSuccess('მომხმარებლის უფლებები წარმატებით განახლდა!');
      setEditingUserId(null);
      onRefreshData();
    }
  };

  const showSuccess = (msg: string) => {
    setIsSuccessMsg(msg);
    setTimeout(() => {
      setIsSuccessMsg(null);
    }, 4000);
  };

  // PWA & Local Backup mechanism download function
  const handleBackupExport = () => {
    try {
      const dataBackup = {
        users: localDB.getUsers(),
        venues: localDB.getVenues(),
        tasks: localDB.getTasks(),
        logs: localDB.getLogs(),
        exportTime: new Date().toISOString(),
        backupType: "Biodiesel_Georgia_Backup"
      };

      const jsonStr = JSON.stringify(dataBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `biodiesel_georgia_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess('სისტემის სარეზერვო ასლი (JSON) წარმატებით ჩამოიტვირთა!');
    } catch (e) {
      alert('რეზერვირებისას შეცდომა მოხდა');
    }
  };

  // Factory Database Reset simulator
  const handleDatabaseReset = () => {
    if (confirm('ნამდვილად გსურთ მონაცემთა ბაზის პირვანდელ მდგომარეობაში დაბრუნება (ქარხნული გადატვირთვა)? ყველა თქვენი ცვლილება დაემატება ან წაიშლება.')) {
      localDB.reset();
      showSuccess('მონაცემთა ბაზა წარმატებით განახლდა საწყისი საიმედო მონაცემებით!');
      onRefreshData();
    }
  };

  return (
    <div id="admin-panel-container" className="space-y-8 animate-fade-in">
      {/* Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Shield className="text-emerald-700" size={26} />
            ადმინისტრატიული მართვა
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            სისტემის სრული კონტროლი, როლების გადანაწილება, უსაფრთხოების ლოგები და რეზერვირება
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            id="btn-backup-export"
            onClick={handleBackupExport}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-emerald-500 hover:text-emerald-700 text-gray-700 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download size={14} />
            სარეზერვო ასლის ჩამოტვირთვა (JSON)
          </button>
          <button
            id="btn-database-reset"
            onClick={handleDatabaseReset}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            ქარხნული გადატვირთვა
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {isSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/60 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 animate-bounce">
          <BadgeCheck size={16} className="text-emerald-600 shrink-0" />
          <span>{isSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Users list and structural roles definition */}
        <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-emerald-700" />
              <h2 className="text-sm font-bold text-gray-800">უფლებებისა და როლების მართვა</h2>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 font-mono">
              სულ: {allUsers.length} მომხმარებელი
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 tracking-wider">სახელი/ელ-ფოსტა</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 tracking-wider">აქტიური როლი</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 tracking-wider">კავშირი/ბაზა</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 tracking-wider text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allUsers.map((user) => {
                  const isEditing = editingUserId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-800">{user.name}</span>
                          <span className="text-[11px] text-gray-400 font-mono mt-0.5">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <select
                            id={`select-role-${user.id}`}
                            value={tempRole}
                            onChange={(e) => {
                              setTempRole(e.target.value as UserRole);
                              if (e.target.value !== 'venue') setTempVenueId('');
                              if (e.target.value !== 'manager') setTempBaseRegion('');
                            }}
                            className="bg-gray-50 border border-gray-200 text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-emerald-500"
                          >
                            <option value="admin">ადმინისტრატორი</option>
                            <option value="manager">მენეჯერი</option>
                            <option value="driver">მძღოლი</option>
                            <option value="venue">ობიექტი (რესტორანი)</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-tight inline-block ${
                            user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            user.role === 'manager' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                            user.role === 'driver' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {user.role === 'admin' ? 'ადმინისტრატორი' :
                             user.role === 'manager' ? 'მენეჯერი' :
                             user.role === 'driver' ? 'მძღოლი' :
                             'ობიექტი (რესტორანი)'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="space-y-1">
                            {tempRole === 'venue' && (
                              <select
                                id={`select-v-${user.id}`}
                                value={tempVenueId}
                                onChange={(e) => setTempVenueId(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-emerald-500"
                              >
                                <option value="">აირჩიეთ რესტორანი...</option>
                                {venues.map((v) => (
                                  <option key={v.id} value={v.id}>{v.trade_name}</option>
                                ))}
                              </select>
                            )}

                            {tempRole === 'manager' && (
                              <select
                                id={`select-r-${user.id}`}
                                value={tempBaseRegion}
                                onChange={(e) => setTempBaseRegion(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-emerald-500"
                              >
                                <option value="">მიანიჭეთ რეგიონი...</option>
                                <option value="თბილისი">თბილისი - სათაო ოფისი</option>
                                <option value="ქუთაისი">ქუთაისი - დასავლეთი</option>
                                <option value="ბათუმი">ბათუმი - აჭარა</option>
                              </select>
                            )}

                            {tempRole !== 'venue' && tempRole !== 'manager' && (
                              <span className="text-[11px] text-gray-400 italic">დამატებითი კავშირი არ სჭირდება</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs">
                            {user.role === 'venue' ? (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></span>
                                <span className="font-medium">
                                  {venues.find(v => v.id === user.venue_id)?.trade_name || 'დაუკავშირებელია'}
                                </span>
                              </div>
                            ) : user.role === 'manager' && user.base_region ? (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <MapPin size={12} className="text-teal-600" />
                                <span className="font-semibold">{user.base_region} ბაზა</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`role-save-${user.id}`}
                              onClick={() => handleSaveRole(user.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md shadow-xs transition-colors"
                            >
                              შენახვა
                            </button>
                            <button
                              id={`role-cancel-${user.id}`}
                              onClick={() => setEditingUserId(null)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors"
                            >
                              უარყოფა
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`role-edit-${user.id}`}
                            onClick={() => handleStartEditRole(user)}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 border border-emerald-100 hover:border-emerald-300 px-2.5 py-1 rounded-md bg-emerald-50/20"
                          >
                            რედაქტირება
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Log audits / tracking history ("Who changed what and when") */}
        <div className="lg:col-span-12 xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden flex flex-col max-h-[580px]">
          <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <FileClock size={18} className="text-emerald-700" />
            <h2 className="text-sm font-bold text-gray-800">ცვლილებების ისტორია (Audit History)</h2>
          </div>

          <div id="logs-timeline-list" className="p-5 overflow-y-auto space-y-4 flex-1">
            {activityLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs italic">
                აქტივობის ლოგი ცარიელია
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="relative pl-5 border-l-2 border-emerald-100 pb-1 last:pb-0">
                  {/* Timeline point */}
                  <span className="absolute left-[-5px] top-1.5 h-2 w-2 rounded-full bg-emerald-600"></span>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">{log.action_type}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                      <Clock size={10} />
                      {new Date(log.created_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}{' '}
                      ({new Date(log.created_at).toLocaleDateString('ka-GE', { month: '2-digit', day: '2-digit' })})
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-600 font-medium mt-1">{log.details}</p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400">ავტორი:</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-sm">
                      {log.user_name} ({log.user_role})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
