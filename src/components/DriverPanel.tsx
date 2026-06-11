/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, LogisticsTask } from '../types';
import { completeTask } from '../lib/db';
import { Truck, MapPin, Phone, MessageSquare, CheckSquare, ListTodo, Award, Landmark, Disc, ArrowRight, Gauge } from 'lucide-react';

interface DriverPanelProps {
  currentUser: UserProfile;
  tasks: LogisticsTask[];
  onRefreshData: () => void;
}

export default function DriverPanel({
  currentUser,
  tasks,
  onRefreshData
}: DriverPanelProps) {
  const [activeTab, setActiveTab] = useState<'assigned' | 'completed'>('assigned');
  
  // Pickup Input Controls
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [actualLiters, setActualLiters] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter tasks for this driver
  // (In simulation, we also fallback to letting driver see tasks assigned to any driver,
  // or specifically 'usr-drv1' Dato, to guarantee they can see realistic content)
  const driverId = currentUser.role === 'driver' ? currentUser.id : 'usr-drv1';
  
  const assignedTasks = tasks.filter(t => t.driver_id === driverId && t.status === 'assigned');
  const completedTasks = tasks.filter(t => t.driver_id === driverId && t.status === 'completed');

  const handleStartPickup = (task: LogisticsTask) => {
    setCompletingTaskId(task.id);
    setActualLiters(task.tanks_to_remove * 40); // guess 40L per tank initially
  };

  const handleCompletePickupSubmit = async () => {
    if (!completingTaskId) return;
    setIsSubmitting(true);
    
    try {
      await completeTask(completingTaskId, actualLiters, currentUser.name);
      setCompletingTaskId(null);
      onRefreshData();
    } catch (e) {
      alert('დავალების დასრულებისას დაფიქსირდა შეცდომა');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="driver-panel-container" className="space-y-6 animate-fade-in max-w-md mx-auto">
      
      {/* Driver Badge Summary Card */}
      <div className="bg-white border border-gray-150 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-orange-100/80 rounded-full flex items-center justify-center text-orange-600">
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-xs text-gray-400 font-bold">მძღოლის სესია</h2>
            <h1 className="text-sm font-bold text-gray-800 tracking-tight">{currentUser.name}</h1>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100 font-bold font-mono">
            {assignedTasks.length} აქტიური რეისი
          </span>
        </div>
      </div>

      {/* iOS Segmented Navigation Tab bar */}
      <div className="flex bg-gray-150/70 p-1 rounded-xl border border-gray-200">
        <button
          id="driver-tab-assigned"
          onClick={() => { setActiveTab('assigned'); setCompletingTaskId(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'assigned'
              ? 'bg-white text-gray-800 shadow-sm font-black'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <ListTodo size={14} />
          შესასრულებელი ({assignedTasks.length})
        </button>
        <button
          id="driver-tab-completed"
          onClick={() => { setActiveTab('completed'); setCompletingTaskId(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'completed'
              ? 'bg-white text-gray-800 shadow-sm font-black'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Award size={14} />
          დასრულებული ({completedTasks.length})
        </button>
      </div>

      {/* Active Work Panel */}
      {completingTaskId ? (
        // Pickup liters input form
        <div id="driver-pickup-form" className="bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Gauge size={18} className="text-emerald-700" />
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest">ზეთის აღების ფორმა</h3>
          </div>

          <p className="text-xs text-gray-500">
            მიუთითეთ ფაქტობრივად აღებული ბიოდიზელის ნედლეულის რაოდენობა:
          </p>

          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between bg-emerald-50/50 p-4 rounded-xl border border-emerald-150/50">
              <span className="text-xs font-bold text-gray-650">ფაქტობრივი ლიტრაჟი:</span>
              <span className="text-2xl font-black text-emerald-800 font-mono">{actualLiters} ლიტრი</span>
            </div>

            {/* iOS range slider */}
            <input
              id="liters-range-slider"
              type="range"
              min="10"
              max="500"
              step="5"
              value={actualLiters}
              onChange={(e) => setActualLiters(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-150 rounded-lg appearance-none cursor-pointer accent-emerald-700"
            />

            {/* Quick offset buttons for volume increments */}
            <div className="flex gap-1.5 font-mono">
              {[50, 100, 150, 200, 300].map((liters) => (
                <button
                  key={liters}
                  type="button"
                  onClick={() => setActualLiters(liters)}
                  className={`flex-1 py-1.5 border rounded-lg text-xs font-bold transition-all ${
                    actualLiters === liters
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {liters}ლ
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              id="btn-driver-pickup-submit"
              onClick={handleCompletePickupSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 font-bold text-xs text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? 'ინახება...' : 'მონაცემების შენახვა 📂'}
            </button>
            <button
              id="btn-driver-pickup-cancel"
              onClick={() => setCompletingTaskId(null)}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              უკან
            </button>
          </div>
        </div>
      ) : (
        // Tasks List Display
        <div id="driver-tasks-list" className="space-y-4">
          {activeTab === 'assigned' ? (
            assignedTasks.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
                <p className="text-xs text-gray-400 italic">თქვენთვის დანიშნული დავალებები არ იძებნება</p>
                <p className="text-[11px] text-gray-400/80 mt-1">მენეჯერი გამოგიყოფთ მარშრუტს უახლოეს პერიოდში</p>
              </div>
            ) : (
              assignedTasks.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm hover:border-emerald-300 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-black border border-indigo-150/40 px-2 py-0.5 rounded-md">
                      დავალება #{t.id}
                    </span>
                    <span className="text-[11px] font-bold text-gray-400">
                      {t.venue_district || 'თბილისის ბაზა'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[13px] font-black text-gray-800">{t.venue_name}</h3>
                    <p className="text-xs text-gray-500 font-medium flex items-center mt-1 gap-1">
                      <MapPin size={12} className="text-emerald-700" />
                      {t.venue_address}
                    </p>
                  </div>

                  {/* Operational instructions */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-gray-100 py-2.5">
                    <div>
                      <span className="text-gray-400">წასაღები ცარიელი:</span> <span className="font-extrabold text-gray-850">{t.tanks_to_remove} ცალი</span>
                    </div>
                    <div>
                      <span className="text-gray-400">დასატოვებელი:</span> <span className="font-extrabold text-gray-850">{t.tanks_to_leave} ცალი</span>
                    </div>
                  </div>

                  {t.working_hours && (
                    <div className="text-[11px] text-gray-500 font-medium">
                      🕒 მუშაობის საათები: <span className="font-bold text-gray-700">{t.working_hours}</span>
                    </div>
                  )}

                  {t.notes && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/40 text-[10px] text-amber-900 font-semibold space-y-1">
                      <p className="flex items-center gap-1">
                        <MessageSquare size={11} className="text-amber-700" />
                        მენეჯერის შენიშვნა:
                      </p>
                      <p className="text-[10px] pl-3.5 italic text-amber-800">{t.notes}</p>
                    </div>
                  )}

                  {/* Simulator Navigator Guide panel */}
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase block">ნავიგაციის გზამკვლევი</span>
                    <p className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                      <Disc size={10} className="text-emerald-600 animate-spin" />
                      შესაბამისი მარშრუტი დაგეგმილია
                    </p>
                  </div>

                  {/* Action completion button */}
                  <button
                    id={`btn-pickup-start-${t.id}`}
                    onClick={() => handleStartPickup(t)}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>ნარჩენი ზეთის გატანის დადასტურება</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ))
            )
          ) : (
            // Completed Tasks List
            completedTasks.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-100 rounded-2xl text-gray-400 text-xs italic">
                შესრულებული რეისები არ ფიქსირდება
              </div>
            ) : (
              completedTasks.map((t) => (
                <div key={t.id} className="bg-emerald-50/20 border border-emerald-200 rounded-2xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-md">
                      რეისი #{t.id} (დასრულებული)
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {new Date(t.completed_at || '').toLocaleDateString('ka-GE')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-gray-800">{t.venue_name}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{t.venue_address}</p>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-500">სულ აღებული ზეთი:</span>
                    <span className="text-emerald-700 font-mono text-sm">{t.actual_liters} ლიტრი ✅</span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
