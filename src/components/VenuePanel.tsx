/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, Venue, LogisticsTask } from '../types';
import { saveTask, sendNotificationSim } from '../lib/db';
import { Plus, Minus, Send, ClipboardList, CheckCircle2, Clock, MapPin, Store, AlertTriangle, HelpCircle } from 'lucide-react';

interface VenuePanelProps {
  currentUser: UserProfile;
  venues: Venue[];
  tasks: LogisticsTask[];
  onRefreshData: () => void;
}

export default function VenuePanel({
  currentUser,
  venues,
  tasks,
  onRefreshData
}: VenuePanelProps) {
  // Bind to currentUser's venue or allow mock switching if user is manager/admin
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  
  // Input Form States
  const [tanksToRemove, setTanksToRemove] = useState<number>(2);
  const [tanksToLeave, setTanksToLeave] = useState<number>(2);
  const [notes, setNotes] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<string>('11:00 - 23:00');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successResponse, setSuccessResponse] = useState<string | null>(null);

  // Auto-bind on load
  useEffect(() => {
    if (currentUser.role === 'venue' && currentUser.venue_id) {
      setSelectedVenueId(currentUser.venue_id);
    } else if (venues.length > 0 && !selectedVenueId) {
      // Default to first venue for preview and demonstration
      setSelectedVenueId(venues[0].id);
    }
  }, [currentUser, venues]);

  const activeVenue = venues.find(v => v.id === selectedVenueId);

  // Filter tasks specific to this venue
  const venueTasks = tasks.filter(t => t.venue_id === selectedVenueId);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVenue) return;

    setIsSubmitting(true);
    setSuccessResponse(null);

    const newTask: LogisticsTask = {
      id: '', // generated server-side or by saveTask
      venue_id: activeVenue.id,
      venue_name: activeVenue.trade_name,
      venue_address: activeVenue.address,
      venue_district: activeVenue.district,
      status: 'pending',
      tanks_to_remove: tanksToRemove,
      tanks_to_leave: tanksToLeave,
      notes: notes,
      working_hours: workingHours,
      created_at: new Date().toISOString(),
      created_by_name: activeVenue.trade_name
    };

    try {
      await saveTask(newTask, activeVenue.trade_name, 'ობიექტი (რესტორანი)');
      
      // Send a simulated notification to active managers
      sendNotificationSim(
        activeVenue.trade_name,
        'მენეჯერები',
        `ახალი შეკვეთაა შემოსული ობიექტიდან "${activeVenue.trade_name}": წასაღებია ${tanksToRemove} ავზი.`
      );

      // Reset Form fields
      setTanksToRemove(2);
      setTanksToLeave(2);
      setNotes('');
      setSuccessResponse('მოთხოვნა წარმატებით გაიგზავნა! მენეჯერი მალე დაგინიშნავთ მძღოლს.');
      onRefreshData();

      // Clear success notification after delay
      setTimeout(() => {
        setSuccessResponse(null);
      }, 5000);
    } catch (e) {
      alert('შეკვეთის გაფორმება ვერ მოხერხდა');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickNote = (noteText: string) => {
    setNotes(prev => prev ? `${prev}, ${noteText}` : noteText);
  };

  return (
    <div id="venue-panel-container" className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Simulation Selector Bar if user is NOT a venue role */}
      {currentUser.role !== 'venue' && (
        <div id="demo-venue-notice" className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>სადემონსტრაციო პანელი: თქვენ ხართ სისტემის ობიექტი (რესტორანი). აირჩიეთ ობიექტი ტესტირებისთვის:</span>
          </div>
          <select
            id="simulate-venue-dropdown"
            value={selectedVenueId}
            onChange={(e) => setSelectedVenueId(e.target.value)}
            className="bg-white border border-amber-300 text-xs rounded-md px-2.5 py-1 text-amber-950 font-bold focus:outline-none"
          >
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.trade_name} ({v.city})</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Brand Header Cards */}
      {activeVenue && (
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-20px] opacity-10 text-white select-none">
            <Store size={180} />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Store size={22} className="text-emerald-400" />
              <span className="text-xs font-bold tracking-widest text-emerald-300 uppercase">რესტორნის პორტალი</span>
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight">{activeVenue.trade_name}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-emerald-100/90 pt-2 border-t border-emerald-700/50">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-emerald-300" />
                <span>{activeVenue.city}, {activeVenue.address} ({activeVenue.district})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ClipboardList size={13} className="text-emerald-300" />
                <span>კოდი: {activeVenue.company_code} | საიდენ: {activeVenue.id_code}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-300" />
                <span>საწყისი ფასი: <span className="font-bold text-white">{activeVenue.price_per_liter} ლარი/ლ</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main split: Input order forms & past requests */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Form: New collection Request */}
        <div className="md:col-span-12 lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-5">
          <h2 className="text-md font-bold text-gray-800 border-b border-gray-100 pb-2.5 flex items-center gap-2">
            <Send size={16} className="text-emerald-700 font-bold" />
            ნარჩენი ზეთის გატანის მოთხოვნა
          </h2>

          {successResponse && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successResponse}</span>
            </div>
          )}

          <form onSubmit={handleSubmitOrder} className="space-y-5">
            {/* iOS Styled Stepper component grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Stepper 1: Tanks to take */}
              <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-bold text-gray-700">წასაღები ავზი (ცარიელი/სავსე)</label>
                  <p className="text-[10px] text-gray-400 mt-0.5">ავზების რაოდენობა, რომელიც მძღოლმა უნდა წაიღოს</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    type="button"
                    onClick={() => setTanksToRemove(Math.max(0, tanksToRemove - 1))}
                    className="p-2 bg-white rounded-lg border border-gray-200 active:bg-gray-100 transition-colors shadow-xs"
                  >
                    <Minus size={16} className="text-gray-500" />
                  </button>
                  <span className="text-xl font-extrabold text-gray-800 font-mono">{tanksToRemove}</span>
                  <button
                    type="button"
                    onClick={() => setTanksToRemove(tanksToRemove + 1)}
                    className="p-2 bg-white rounded-lg border border-gray-200 active:bg-gray-100 transition-colors shadow-xs"
                  >
                    <Plus size={16} className="text-emerald-700" />
                  </button>
                </div>
              </div>

              {/* Stepper 2: Tanks to leave */}
              <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-bold text-gray-700">დასატოვებელი ავზი</label>
                  <p className="text-[10px] text-gray-400 mt-0.5">ახალი, სუფთა ავზების სასურველი რაოდენობა</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    type="button"
                    onClick={() => setTanksToLeave(Math.max(0, tanksToLeave - 1))}
                    className="p-2 bg-white rounded-lg border border-gray-200 active:bg-gray-100 transition-colors shadow-xs"
                  >
                    <Minus size={16} className="text-gray-500" />
                  </button>
                  <span className="text-xl font-extrabold text-gray-800 font-mono">{tanksToLeave}</span>
                  <button
                    type="button"
                    onClick={() => setTanksToLeave(tanksToLeave + 1)}
                    className="p-2 bg-white rounded-lg border border-gray-200 active:bg-gray-100 transition-colors shadow-xs"
                  >
                    <Plus size={16} className="text-emerald-700" />
                  </button>
                </div>
              </div>

            </div>

            {/* Input 3: Working hours */}
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Clock size={12} className="text-emerald-700" />
                სამუშაო საათები (მუშაობის რეჟიმი)
              </label>
              <input
                type="text"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder="მაგ: 11:00 - 23:00, შაბათ-კვირას: 12:00"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-emerald-500"
                required
              />
            </div>

            {/* Input 4: Notes / Damages */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">დამატებითი შენიშვნა / ხარვეზი</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="მიუთითეთ ხარვეზი (მაგ: დაზიანებული თავსახური, ავზის დეფექტი, პარკინგის პრობლემა)"
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-semibold focus:outline-emerald-500"
              />
              
              {/* Quick Preset Buttons for easy mobile clicking */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickNote('თავსახური დაზიანებულია')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600 rounded-md transition-all border border-gray-150"
                >
                  ⚠️ თავსახური დაზიანებულია
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickNote('ავზს აქვს ბზარი')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600 rounded-md transition-all border border-gray-150"
                >
                  📦 ავზს აქვს ბზარი
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickNote('ავზები მთლიანად სავსეა')}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600 rounded-md transition-all border border-gray-150"
                >
                  ⛽ მთლიანად სავსეა
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || tanksToRemove === 0}
              className={`w-full py-3 text-xs font-bold rounded-xl text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tanksToRemove === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isSubmitting ? 'იგზავნება...' : 'აქტიური მოთხოვნის გაგზავნა'}
              <Send size={12} />
            </button>
          </form>
        </div>

        {/* List: Past requests and historical trace */}
        <div className="md:col-span-12 lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between max-h-[580px]">
          <div>
            <h2 className="text-md font-bold text-gray-800 border-b border-gray-100 pb-2.5 flex items-center gap-2">
              <ClipboardList size={16} className="text-emerald-700" />
              გაგზავნილი შეკვეთების ისტორია
            </h2>

            <div className="space-y-3.5 mt-4 overflow-y-auto max-h-[460px] scrollbar-none pr-1">
              {venueTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs italic">
                  აქტიური მოთხოვნები ჯერ არ გაგიგზავნიათ
                </div>
              ) : (
                venueTasks.map((t) => {
                  return (
                    <div key={t.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-mono font-bold">შეკვეთა #{t.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-center tracking-tight ${
                          t.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          t.status === 'assigned' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {t.status === 'pending' ? 'დადასტურების მოლოდინში' :
                           t.status === 'assigned' ? 'მძღოლი დანიშნულია' :
                           'შესრულებული✅'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 font-medium">
                        <div>
                          <span className="text-gray-400">წასაღები:</span> <span className="font-bold text-gray-800">{t.tanks_to_remove} ცალი</span>
                        </div>
                        <div>
                          <span className="text-gray-400">დასატოვებელი:</span> <span className="font-bold text-gray-800">{t.tanks_to_leave} ცალი</span>
                        </div>
                      </div>

                      {t.working_hours && (
                        <div className="text-[10px] text-gray-500">
                          🕒 სამუშაო საათები: <span className="font-bold">{t.working_hours}</span>
                        </div>
                      )}

                      {t.notes && (
                        <div className="bg-white px-2 py-1.5 rounded-md border border-gray-100 text-[10px] text-amber-800 flex items-center gap-1 font-medium">
                          <span className="shrink-0 font-bold inline-block bg-amber-50 rounded">⚠️</span>
                          <span>{t.notes}</span>
                        </div>
                      )}

                      {/* Driver Assign details */}
                      {t.driver_name && (
                        <div className="text-[10px] text-gray-600 pt-1.5 border-t border-gray-1 py-1.5 flex items-center justify-between">
                          <span>მძღოლი: <span className="font-bold text-emerald-800">{t.driver_name}</span></span>
                          {t.actual_liters && (
                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold">
                              წაიღო: {t.actual_liters} ლ
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-[9px] text-gray-450 pt-1 flex items-center justify-end font-mono">
                        {new Date(t.created_at).toLocaleString('ka-GE')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
