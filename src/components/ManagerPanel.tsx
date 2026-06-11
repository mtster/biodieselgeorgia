/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UserProfile, Venue, LogisticsTask } from '../types';
import { saveVenue, deleteVenue, saveTask, getOverdueVenues, sendNotificationSim, getNotificationsSim } from '../lib/db';
import { 
  Plus, Search, FileSpreadsheet, Upload, Edit, Trash2, Calendar, 
  MapPin, Phone, User, Users, Compass, CheckCircle2, AlertTriangle, 
  Percent, Mail, MessageSquare, PhoneCall, Disc, ClipboardList, CheckSquare 
} from 'lucide-react';

interface ManagerPanelProps {
  currentUser: UserProfile;
  venues: Venue[];
  tasks: LogisticsTask[];
  allDrivers: UserProfile[];
  onRefreshData: () => void;
}

export default function ManagerPanel({
  currentUser,
  venues,
  tasks,
  allDrivers,
  onRefreshData
}: ManagerPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'database' | 'logistics' | 'analytics' | 'notifications'>('database');
  
  // Search and Filtering states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // New Venue / Edit Venue Modal form state
  const [isVenueModalOpen, setIsVenueModalOpen] = useState<boolean>(false);
  const [editingVenue, setEditingVenue] = useState<Partial<Venue> | null>(null);

  // New Task modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskVenueId, setTaskVenueId] = useState<string>('');
  const [taskTanksToRemove, setTaskTanksToRemove] = useState<number>(2);
  const [taskTanksToLeave, setTaskTanksToLeave] = useState<number>(2);
  const [taskNotes, setTaskNotes] = useState<string>('');
  const [taskWorkingHours, setTaskWorkingHours] = useState<string>('11:00 - 23:00');

  // Excel Upload states
  const [excelUploadError, setExcelUploadError] = useState<string | null>(null);
  const [excelUploadSuccess, setExcelUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Notification State
  const [notifRecipient, setNotifRecipient] = useState<string>('ობიექტები');
  const [notifContent, setNotifContent] = useState<string>('');
  const [notifTriggerMsg, setNotifTriggerMsg] = useState<string | null>(null);

  // Overdue status calculation
  const overdueVenues = getOverdueVenues(venues);

  // Multi-parameter search filter logic
  const filteredVenues = venues.filter(v => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      v.trade_name.toLowerCase().includes(query) ||
      v.legal_name.toLowerCase().includes(query) ||
      v.id_code.includes(query) ||
      v.address.toLowerCase().includes(query) ||
      v.district.toLowerCase().includes(query) ||
      v.company_code.toLowerCase().includes(query) ||
      v.contact_person.toLowerCase().includes(query) ||
      v.contact_phones.toLowerCase().includes(query) ||
      v.contract_manager.toLowerCase().includes(query);

    const matchesRegion = regionFilter === 'all' || v.city === regionFilter;
    const matchesOverdue = !overdueOnly || overdueVenues.some(ov => ov.id === v.id);

    return matchesSearch && matchesRegion && matchesOverdue;
  });

  // Handle excel parser selection
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelUploadError(null);
    setExcelUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Parse rows to raw JSON objects
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        if (rows.length === 0) {
          throw new Error('ფაილი ცარიელია ან არასწორი ფორმატის');
        }

        let importedCount = 0;
        // Map excel values directly into db
        for (const row of rows) {
          const matchedVenue: Venue = {
            id: '', // new id generated
            trade_name: row['სავაჭრო სახელი'] || row['Trade Name'] || row['trade_name'] || 'ობიექტი',
            legal_name: row['იურიდიული სახელი'] || row['Legal Name'] || row['legal_name'] || 'შპს',
            id_code: String(row['საიდენტიფიკაციო კოდი'] || row['ID Code'] || row['id_code'] || ''),
            bank_account: row['საბანკო ანგარიში'] || row['Bank Account'] || row['bank_account'] || '',
            price_per_liter: parseFloat(row['ფასი ლიტრზე'] || row['Price'] || row['price'] || '1.5'),
            city: row['ქალაქი'] || row['City'] || row['city'] || 'თბილისი',
            address: row['მისამართი'] || row['Physical Address'] || row['address'] || '',
            district: row['რაიონი'] || row['District'] || row['district'] || '',
            company_code: row['კომპანიის კოდი'] || row['Code'] || row['company_code'] || '',
            contact_person: row['საკონტაქტო პირი'] || row['Contact Person'] || row['contact_person'] || 'მენეჯერი',
            contact_phones: row['ტელეფონი'] || row['Phones'] || row['contact_phones'] || '',
            contract_manager: row['გამფორმებელი მენეჯერი'] || row['Manager'] || row['contract_manager'] || currentUser.name,
            operator: row['ოპერატორი'] || row['Operator'] || row['operator'] || 'ნათია',
            created_at: new Date().toISOString()
          };

          await saveVenue(matchedVenue, currentUser.name, 'მენეჯერი');
          importedCount++;
        }

        setExcelUploadSuccess(`წარმატებით იმპორტირდა ${importedCount} ახალი ობიექტი ბაზაში!`);
        onRefreshData();
      } catch (err: any) {
        setExcelUploadError(`იმპორტი ჩაიშალა: შეამოწმეთ ფაილის ველები. ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Bulk Seed Demo generator for managers
  const handleBulkMockImport = async () => {
    setExcelUploadError(null);
    setExcelUploadSuccess(null);
    try {
      const mockImports = [
        { trade_name: 'გეორგიან ბისტრო (ცენტრი)', legal_name: 'შპს ბისტრო გრუპ', id_code: '404391283', bank_account: 'GE04TB82716252919', price_per_liter: 1.45, city: 'თბილისი', address: 'აღმაშენებლის გამზ. 89', district: 'ჩუღურეთი', company_code: 'TBS-CH-004', contact_person: 'ნიკოლოზი', contact_phones: '599-23-45-67', contract_manager: currentUser.name, operator: 'ნათია' },
        { trade_name: 'რესტორანი მაჭახელა (საბურთალო)', legal_name: 'შპს მაჭახელა გაერთიანება', id_code: '204128373', bank_account: 'GE93BG81039481920', price_per_liter: 1.50, city: 'თბილისი', address: 'პეკინის გამზ. 22', district: 'საბურთალო', company_code: 'TBS-SAB-045', contact_person: 'გურამი', contact_phones: '551-77-88-99', contract_manager: currentUser.name, operator: 'ნათია' },
        { trade_name: 'ბათუმის ხინკლის სახლი', legal_name: 'შპს ხინკალი ბაგები', id_code: '445210291', bank_account: 'GE25TB10293029102', price_per_liter: 1.35, city: 'ბათუმი', address: 'მელიქიშვილის ქ. 12', district: 'ძველი ბათუმი', company_code: 'BAT-OLD-012', contact_person: 'ლაშა', contact_phones: '593-12-12-12', contract_manager: currentUser.name, operator: 'ხატია' }
      ];

      for (const item of mockImports) {
        await saveVenue(item as Venue, currentUser.name, 'მენეჯერი');
      }

      setExcelUploadSuccess('სადემონსტრაციო Excel ფაილის იმიტაცია წარმატებულია: 3 ობიექტი დაემატა!');
      onRefreshData();
    } catch (e) {
      setExcelUploadError('იმიტაცია ვერ მოხერხდა');
    }
  };

  // Save changes to venue from modal
  const handleSaveVenueModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue || !editingVenue.trade_name) return;

    await saveVenue(editingVenue as Venue, currentUser.name, 'მენეჯერი');
    setIsVenueModalOpen(false);
    onRefreshData();
  };

  const handleOpenNewVenueModal = () => {
    setEditingVenue({
      id: '',
      trade_name: '',
      legal_name: '',
      id_code: '',
      bank_account: '',
      price_per_liter: 1.50,
      city: 'თბილისი',
      address: '',
      district: '',
      company_code: '',
      contact_person: '',
      contact_phones: '',
      contract_manager: currentUser.name,
      operator: 'ნათია'
    });
    setIsVenueModalOpen(true);
  };

  const handleOpenEditVenue = (v: Venue) => {
    setEditingVenue(v);
    setIsVenueModalOpen(true);
  };

  const handleDeleteVenueClick = async (venueId: string, tradeName: string) => {
    if (confirm(`ნამდვილად გსურთ ობიექტის წაშლა: ${tradeName}?`)) {
      await deleteVenue(venueId, tradeName, currentUser.name, 'მენეჯერი');
      onRefreshData();
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const destVenue = venues.find(v => v.id === taskVenueId);
    if (!destVenue) return;

    const newTask: LogisticsTask = {
      id: '',
      venue_id: destVenue.id,
      venue_name: destVenue.trade_name,
      venue_address: destVenue.address,
      venue_district: destVenue.district,
      status: 'pending',
      tanks_to_remove: taskTanksToRemove,
      tanks_to_leave: taskTanksToLeave,
      notes: taskNotes,
      working_hours: taskWorkingHours,
      created_at: new Date().toISOString(),
      created_by_name: currentUser.name
    };

    await saveTask(newTask, currentUser.name, 'მენეჯერი');
    setIsTaskModalOpen(false);
    onRefreshData();
  };

  const handleAssignDriver = async (taskId: string, driverId: string) => {
    const activeTask = tasks.find(t => t.id === taskId);
    const drv = allDrivers.find(d => d.id === driverId);
    if (!activeTask || !drv) return;

    const updatedTask: LogisticsTask = {
      ...activeTask,
      driver_id: drv.id,
      driver_name: drv.name,
      status: 'assigned'
    };

    await saveTask(updatedTask, currentUser.name, 'მენეჯერი');
    onRefreshData();

    // Trigger push FCM simulation
    sendNotificationSim(
      currentUser.name,
      drv.name,
      `დაგეწერათ რეისი ობიექტზე: ${activeTask.venue_name}. წასაღებია ${activeTask.tanks_to_remove} ავზი.`
    );
  };

  const handleSendNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifContent) return;

    sendNotificationSim(
      currentUser.name,
      notifRecipient,
      notifContent
    );

    setNotifContent('');
    setNotifTriggerMsg('შეტყობინება/განცხადება წარმატებით დაიგზავნა!');
    setTimeout(() => {
      setNotifTriggerMsg(null);
    }, 4000);
  };

  return (
    <div id="manager-panel-container" className="space-y-6 animate-fade-in">
      
      {/* Upper Manager Banner Card */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">მენეჯერის მართვის კონსოლი</span>
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight mt-1">
            მოგესალმებით, {currentUser.name}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            ბაზის რეგიონალური კომპეტენცია: <span className="font-bold text-gray-600">{currentUser.base_region || 'საქართველო'}</span>
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 min-w-max scrollbar-none overflow-x-auto">
          <button
            id="tab-mgr-db"
            onClick={() => setActiveSubTab('database')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'database' ? 'bg-white text-gray-800 shadow-xs font-extrabold' : 'text-gray-500'
            }`}
          >
            ობიექტების ბაზა
          </button>
          <button
            id="tab-mgr-logistics"
            onClick={() => setActiveSubTab('logistics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'logistics' ? 'bg-white text-gray-800 shadow-xs font-extrabold' : 'text-gray-500'
            }`}
          >
            ლოგისტიკა & დავალებები
          </button>
          <button
            id="tab-mgr-analytics"
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'analytics' ? 'bg-white text-gray-800 shadow-xs font-extrabold' : 'text-gray-500'
            }`}
          >
            ანალიტიკა (ინტერვალები)
          </button>
          <button
            id="tab-mgr-notifs"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'notifications' ? 'bg-white text-gray-800 shadow-xs font-extrabold' : 'text-gray-500'
            }`}
          >
            საკომუნიკაციო ჰაბი
          </button>
        </div>
      </div>

      {/* ==================== SUB-TAB 1: DATABASE ==================== */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          
          {/* Filtering and Upload Tools Row */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
            
            {/* Search Box */}
            <div className="xl:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                id="search-input-venue"
                type="text"
                placeholder="ძებნა სავაჭრო სახელით, LLC-ით, ტელეფონით, კოდით..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-emerald-500"
              />
            </div>

            {/* Region dropdown filter */}
            <div className="xl:col-span-3">
              <select
                id="select-region-filter"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-emerald-500"
              >
                <option value="all">ყველა რეგიონი / ქალაქი</option>
                <option value="თბილისი">თბილისი</option>
                <option value="ბათუმი">ბათუმი</option>
                <option value="ქუთაისი">ქუთაისი</option>
              </select>
            </div>

            {/* Overdue Checkbox Alert style */}
            <div className="xl:col-span-2 flex items-center gap-2 px-1">
              <input
                id="checkbox-overdue-only"
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="h-4 w-4 bg-white border-gray-300 rounded-md text-emerald-700 accent-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="checkbox-overdue-only" className="text-xs font-bold text-gray-700 flex items-center gap-1 cursor-pointer">
                <AlertTriangle size={13} className="text-rose-600" />
                გადაცილებული ობიექტები ({overdueVenues.length})
              </label>
            </div>

            {/* Create Venue Button */}
            <div className="xl:col-span-2 text-right">
              <button
                id="btn-add-venue-modal"
                onClick={handleOpenNewVenueModal}
                className="w-full xl:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                ობიექტის დამატება
              </button>
            </div>

          </div>

          {/* Excel Upload Card (Drag-&-Drop / click compatible) */}
          <div className="bg-emerald-50/10 border border-emerald-100 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet size={16} className="text-emerald-700" />
                Excel მონაცემთა ბაზის იმპორტი
              </h3>
              <p className="text-[11px] text-gray-500">
                ატვირთეთ Excel ფაილები შევსებული სვეტებით: <span className="font-semibold text-gray-700">სავაჭრო სახელი, იურიდიული სახელი, საიდენტიფიკაციო კოდი, საბანკო ანგარიში, ფასი ლიტრზე, მისამართი</span> და ა.შ.
              </p>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBulkMockImport}
                  className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  📥 სადემონსტრაციო Excel იმპორტის სიმულაცია
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-white rounded-xl p-4 transition-all relative">
              <Upload size={22} className="text-emerald-600 animate-bounce" />
              <p className="text-[11px] text-gray-500 font-medium mt-1.5 text-center">
                ჩააგდეთ ფაილი აქ ან დააჭირეთ ასატვირთად
              </p>
              <input
                ref={fileInputRef}
                id="excel-file-uploader"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {excelUploadError && (
              <div className="md:col-span-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {excelUploadError}
              </div>
            )}

            {excelUploadSuccess && (
              <div className="md:col-span-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold">
                {excelUploadSuccess}
              </div>
            )}
          </div>

          {/* Venues Grid Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">ობიექტი & კოდი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">მისამართი / ქალაქი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">კონტაქტი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">ხელშეკრულება & ტარიფი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400 text-right">მოქმედება</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVenues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-450 text-xs italic">
                        მითითებული პარამეტრებით მონაცემები არ მოიძებნა
                      </td>
                    </tr>
                  ) : (
                    filteredVenues.map((v) => {
                      const isOverdue = overdueVenues.some(ov => ov.id === v.id);
                      return (
                        <tr key={v.id} className="hover:bg-gray-50/20 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-800">{v.trade_name}</span>
                                {isOverdue && (
                                  <span className="bg-rose-50 hover:bg-rose-100 border border-rose-150 text-[9px] font-black text-rose-700 px-1.5 py-0.2 rounded shrink-0">
                                    ⚠️ გადაცილებული
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                კოდი: {v.company_code || 'T-B-S'} | ID: {v.id_code}
                              </span>
                              <span className="text-[10px] text-gray-400 mt-0.5 italic">
                                იურ: {v.legal_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col text-xs font-semibold text-gray-700">
                              <span>{v.address}</span>
                              <span className="text-[10px] text-gray-450 mt-0.5 font-bold flex items-center gap-1">
                                <MapPin size={10} className="text-emerald-700" />
                                {v.city} ({v.district || 'სათაო'})
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                <User size={10} className="text-teal-600" />
                                {v.contact_person}
                              </span>
                              <span className="text-[10px] text-gray-500 font-semibold font-mono mt-0.5 whitespace-nowrap">
                                📞 {v.contact_phones}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-emerald-800 font-mono">
                                {v.price_per_liter} ლარი/ლ
                              </span>
                              <span className="text-[10px] text-gray-400 mt-1">
                                მენეჯერი: {v.contract_manager}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                id={`venue-edit-${v.id}`}
                                onClick={() => handleOpenEditVenue(v)}
                                className="p-1 px-2.5 rounded-lg border border-gray-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/20 text-gray-500 text-xs font-semibold transition-all cursor-pointer"
                              >
                                რედაქტირება
                              </button>
                              <button
                                id={`venue-delete-${v.id}`}
                                onClick={() => handleDeleteVenueClick(v.id, v.trade_name)}
                                className="p-1 px-2.5 rounded-lg border border-red-150 hover:bg-red-50 text-red-600 text-xs font-semibold transition-all cursor-pointer"
                              >
                                წაშლა
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: LOGISTICS ==================== */}
      {activeSubTab === 'logistics' && (
        <div className="space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-md font-bold text-gray-800 flex items-center gap-1.5">
                <Disc size={18} className="text-emerald-700 shrink-0" />
                სისტემური ლოგისტიკის მართვა
              </h2>
              <p className="text-xs text-gray-400">
                შეაფასეთ მოთხოვნები რესტორნებიდან, დაუნიშნეთ დავალებები მძღოლებს და აკონტროლეთ რეისები
              </p>
            </div>
            
            <button
              id="btn-create-task-modal"
              onClick={() => { setTaskVenueId(venues[0]?.id || ''); setIsTaskModalOpen(true); }}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              დავალების შექმნა ხელით
            </button>
          </div>

          {/* Active Logistics Task lists */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-gray-50/40 border-b border-gray-105 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <ClipboardList size={14} className="text-emerald-700" />
                დავალებების საერთო კონსოლიდირებული სივრცე
              </span>
              <span className="text-[10px] font-bold text-gray-400 font-mono">სულ: {tasks.length} დავალება</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">ობიექტი & მისამართი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">მოთხოვნილი ავზები</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">შენიშვნა / საათები</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400">მძღოლი / სტატუსი</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400 text-right font-bold">აღებული</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-xs italic">
                        დავალებები არ არის რეგისტრირებული
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-800">{task.venue_name}</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-medium">
                              <MapPin size={10} className="text-emerald-700" />
                              {task.venue_address} ({task.venue_district})
                            </span>
                            <span className="text-[9px] text-gray-400 mt-0.5">შეკვეთა #{task.id}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-700">
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded mr-1">
                            გასატანი: {task.tanks_to_remove}ც
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            დასატოვებელი: {task.tanks_to_leave}ც
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col space-y-1">
                            {task.working_hours && (
                              <span className="text-[10px] text-gray-600 font-medium">🕒 საათები: {task.working_hours}</span>
                            )}
                            {task.notes && (
                              <span className="bg-amber-50 rounded text-[10px] text-amber-900 border border-amber-100 px-1.5 py-0.5 italic max-w-xs truncate">
                                ⚠️ {task.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            {task.status === 'pending' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 font-bold">
                                  მოსამზადებელი
                                </span>
                                <select
                                  id={`select-drv-${task.id}`}
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) handleAssignDriver(task.id, e.target.value);
                                  }}
                                  className="bg-white border border-gray-200 text-[10px] font-bold rounded px-1.5 py-1 focus:outline-emerald-500"
                                >
                                  <option value="">მძღოლის არჩევა...</option>
                                  {allDrivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                              </div>
                            ) : task.status === 'assigned' ? (
                              <div className="flex flex-col text-xs">
                                <span className="text-[10px] text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 font-bold self-start mb-1">
                                  ტრანსპორტირება 🚚
                                </span>
                                <span className="font-bold text-gray-700 text-[11px]">მძღოლი: {task.driver_name}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col text-xs">
                                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 font-bold self-start">
                                  ✔ შესრულებული
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1">მძღოლი: {task.driver_name}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {task.status === 'completed' && task.actual_liters ? (
                            <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded font-mono">
                              {task.actual_liters} ლიტრი ✅
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 italic">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: ANALYTICS ==================== */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Bento-grid stats components */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">სულ ბაზაში</span>
              <span className="text-3xl font-black text-emerald-700 font-mono block">{venues.length}</span>
              <span className="text-[11px] text-gray-500 block font-medium">რეგისტრირებული ობიექტი-რესტორანი</span>
            </div>

            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">გადაცილებული ობიექტები</span>
              <span className="text-3xl font-black text-rose-600 font-mono block">{overdueVenues.length}</span>
              <span className="text-[11px] text-gray-500 block font-medium">სასწრაფოდ დასაკავშირებელი (15 დღეზე მეტი)</span>
            </div>

            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">ჯამური აღებული ზეთი</span>
              <span className="text-3xl font-black text-emerald-800 font-mono block">
                {tasks.reduce((sum, t) => sum + (t.actual_liters || 0), 0)} ლტ
              </span>
              <span className="text-[11px] text-gray-500 block font-medium">რეალიზებული დავალებებიდან მიღებული ზეთები</span>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Pick-up interval calculations */}
            <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-xs p-5">
              <h2 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-1.5">
                <Percent size={16} className="text-emerald-700" />
                ამოღების ავტომატური ინტერვალები და პროგნოზები
              </h2>

              <p className="text-xs text-gray-500 mt-2.5">
                მანქანური გამოთვლებით ნაპოვნი საშუალო ინტერვალები (დღეებში) ობიექტებიდან ზეთების გატანის სიხშირეს შორის.
              </p>

              <div className="space-y-3.5 mt-4">
                {venues.map(v => {
                  const avg = v.average_interval_days || 12;
                  const isOverdue = overdueVenues.some(ov => ov.id === v.id);
                  return (
                    <div key={v.id} className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-800">{v.trade_name}</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">ბოლო გატანა: {v.last_pickup_date ? new Date(v.last_pickup_date).toLocaleDateString('ka-GE') : 'არ ფიქსირდება'}</p>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs font-bold text-gray-700">საშუალო ციკლი: <span className="font-extrabold text-emerald-800 font-mono">{avg} დღე</span></span>
                        <div className="w-24 bg-gray-250 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${isOverdue ? 'bg-rose-500' : 'bg-emerald-600'}`}
                            style={{ width: `${Math.min(100, (avg / 25) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overdue alert and call guide reminder */}
            <div className="lg:col-span-12 xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-1.5">
                  <PhoneCall size={16} className="text-rose-600" />
                  დასარეკი ზარების სია (REMINDER)
                </h2>

                <p className="text-[11px] text-rose-800 bg-rose-50 px-2.5 py-2 mt-3 rounded-md font-medium">
                  ობიექტები, რომელთა ამოღების საშუალო ინტერვალი თითქმის ორჯერ გაიზარდა ან 15 დღეზე მეტია ზეთი არ გაუღიათ:
                </p>

                <div className="space-y-3 mt-4">
                  {overdueVenues.length === 0 ? (
                    <div className="text-center py-6 text-emerald-800 text-xs italic">
                      საბედნიეროდ, პრობლემური/გადაცილებული ობიექტები არ ფიქსირდება!
                    </div>
                  ) : (
                    overdueVenues.map(ov => (
                      <div key={ov.id} className="p-2.5 bg-rose-50/20 border border-rose-100 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-gray-800">{ov.trade_name}</span>
                          <span className="text-[10px] text-rose-700 bg-rose-50 font-bold px-1.5 py-0.2 rounded font-mono">
                            {ov.average_interval_days || 15} დღე
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1 font-semibold">
                          <Phone size={10} className="text-gray-400" /> {ov.contact_person}: {ov.contact_phones}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-[10px] text-gray-500 font-medium mt-4">
                💡 ყოველდღიურად დაურეკეთ ამ სიას და შესთავაზეთ ახალი გამოსატანი რეისი რესტორნებთან ურთიერთობის გასამყარებლად.
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: NOTIFICATIONS ==================== */}
      {activeSubTab === 'notifications' && (
        <div id="communications-tab" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-12 xl:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-xs p-5">
            <h2 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-1.5">
              <Mail size={16} className="text-emerald-700" />
              სისტემური დაგზავნა და განცხადებები
            </h2>

            <p className="text-xs text-gray-500 mt-2.5">
              აქედან შეგიძლიათ გაგზავნოთ შეტყობინებები რესტორნების, მძღოლების ან სხვა მენეჯერების მისამართით, მაგალითად: დღესასწაულების, ტარიფის ცვლილების ან სხვა სიახლეების შესახებ:
            </p>

            {notifTriggerMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl mt-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{notifTriggerMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendNotificationSubmit} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ადრესატი (მიმღები):</label>
                  <select
                    id="select-notif-recipient"
                    value={notifRecipient}
                    onChange={(e) => setNotifRecipient(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 font-semibold focus:outline-emerald-500"
                  >
                    <option value="ყველა მომხმარებელი">ყველა (ობიექტები, მძღოლები, მენეჯერები)</option>
                    <option value="მძღოლები">ყველა მძღოლი 🚚</option>
                    <option value="ობიექტები">ყველა რესტორანი ობიექტი 🏠</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ტიპი:</label>
                  <span className="w-full bg-gray-100 border border-gray-200 text-xs rounded-lg px-2.5 py-2 text-gray-500 flex items-center gap-1.5 font-semibold">
                    📩 SMS / Email და Push FCM შეტყობინება
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">შეტყობინების შინაარსი:</label>
                <textarea
                  id="textarea-notif-content"
                  rows={4}
                  value={notifContent}
                  onChange={(e) => setNotifContent(e.target.value)}
                  placeholder="მაგ: გილოცავთ შობას! გაცნობებთ, რომ ხვალ 7 იანვარს კომპანია არ იმუშავებს. ნარჩენების გატანა განახლდება 8 იანვრიდან ჩვეულ რეჟიმში..."
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-semibold rounded-lg p-3 focus:outline-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                შეტყობინების გაშვება (FCM Push / SMS)
              </button>
            </form>
          </div>

          {/* List of Sent Notifications */}
          <div className="lg:col-span-12 xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col max-h-[460px]">
            <h2 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3 flex items-center gap-1.5">
              <MessageSquare size={16} className="text-emerald-750" />
              გაგზავნილი შეტყობინებების ჟურნალი
            </h2>

            <div className="space-y-3 mt-4 overflow-y-auto pr-1 flex-1">
              {getNotificationsSim().length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs italic">
                  დაგზავნების ისტორია ცარიელია
                </div>
              ) : (
                getNotificationsSim().map((n) => (
                  <div key={n.id} className="p-3 border border-gray-150 bg-gray-50/50 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold font-mono">
                      <span>მიმღები: <span className="text-emerald-800">{n.recipient}</span></span>
                      <span>{new Date(n.sent_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-gray-700 font-medium leading-relaxed bg-white border border-gray-100 p-2 rounded-md">
                      {n.text}
                    </p>
                    <div className="text-[10px] text-gray-450 text-right">
                      ავტორი: <span className="font-bold">{n.sender}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* 1. EDIT/ADD VENUE MODAL */}
      {/* ========================================== */}
      {isVenueModalOpen && editingVenue && (
        <div id="modal-edit-venue" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg w-full max-w-lg p-6 space-y-4 animate-scale-up my-8">
            <h2 className="text-md font-bold text-gray-800 border-b border-gray-100 pb-2.5">
              {editingVenue.id ? 'ობიექტის რედაქტირება' : 'ახალი ობიექტის დამატება'}
            </h2>

            <form onSubmit={handleSaveVenueModal} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">სავაჭრო სახელი:*</label>
                <input
                  id="modal-input-trade_name"
                  type="text"
                  required
                  value={editingVenue.trade_name || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, trade_name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">იურიდიული სახელი LLC:*</label>
                <input
                  id="modal-input-legal_name"
                  type="text"
                  required
                  value={editingVenue.legal_name || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, legal_name: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">საიდენტიფიკაციო კოდი (9 ნიშნა):*</label>
                <input
                  id="modal-input-id_code"
                  type="text"
                  required
                  value={editingVenue.id_code || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, id_code: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">საბანკო ანგარიში (GE...):</label>
                <input
                  id="modal-input-bank_account"
                  type="text"
                  value={editingVenue.bank_account || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, bank_account: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">ქალაქი:*</label>
                <select
                  id="modal-select-city"
                  value={editingVenue.city || 'თბილისი'}
                  onChange={(e) => setEditingVenue({ ...editingVenue, city: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                >
                  <option value="თბილისი">თბილისი</option>
                  <option value="ბათუმი">ბათუმი</option>
                  <option value="ქუთაისი">ქუთაისი</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">საიდენტიფიკაციო რაიონი:*</label>
                <input
                  id="modal-input-district"
                  type="text"
                  required
                  placeholder="მაგ: საბურთალო, ძველი ბათუმი"
                  value={editingVenue.district || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, district: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500">ფიზიკური მისამართი:*</label>
                <input
                  id="modal-input-address"
                  type="text"
                  required
                  value={editingVenue.address || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, address: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">სისტემის კოდი (თბილისი/ბათუმი):</label>
                <input
                  id="modal-input-company_code"
                  type="text"
                  placeholder="TBS-SOL-099"
                  value={editingVenue.company_code || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, company_code: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">ფასი 1 ლიტრზე (ლარი):*</label>
                <input
                  id="modal-input-price_per_liter"
                  type="number"
                  step="0.05"
                  required
                  value={editingVenue.price_per_liter || 1.50}
                  onChange={(e) => setEditingVenue({ ...editingVenue, price_per_liter: parseFloat(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">მთავარი საკონტაქტო პირი:*</label>
                <input
                  id="modal-input-contact_person"
                  type="text"
                  required
                  value={editingVenue.contact_person || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, contact_person: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">დამატებითი ტელეფონები / პოზიციით:*</label>
                <input
                  id="modal-input-contact_phones"
                  type="text"
                  required
                  placeholder="მაგ: 599-11-22-33 (შეფ მზარეული)"
                  value={editingVenue.contact_phones || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, contact_phones: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">ხელშემკვრელი მენეჯერი:</label>
                <input
                  id="modal-input-contract_manager"
                  type="text"
                  value={editingVenue.contract_manager || currentUser.name}
                  onChange={(e) => setEditingVenue({ ...editingVenue, contract_manager: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500">ოპერატორი (ჩვენი კომპანიიდან):</label>
                <input
                  id="modal-input-operator"
                  type="text"
                  value={editingVenue.operator || 'ნათია'}
                  onChange={(e) => setEditingVenue({ ...editingVenue, operator: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs rounded-lg px-2.5 py-2 focus:outline-emerald-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-xl font-bold transition-all"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-all"
                >
                  შენახვა 📂
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. CREATE LOGISTICS TASK MODAL MANUAL */}
      {/* ========================================== */}
      {isTaskModalOpen && (
        <div id="modal-create-task" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg w-full max-w-md p-6 space-y-4 animate-scale-up">
            <h2 className="text-md font-bold text-gray-800 border-b border-gray-100 pb-2.5">
              ახალი ლოგისტიკური დავალების შექმნა
            </h2>

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">აირჩიეთ ობიექტი-რესტორანი:</label>
                <select
                  id="task-select-venue"
                  value={taskVenueId}
                  onChange={(e) => setTaskVenueId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-emerald-500"
                  required
                >
                  <option value="">აირჩიეთ...</option>
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.trade_name} ({v.address})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">გასატანი ავზი (ცალი):</label>
                  <input
                    id="task-input-tanks_to_remove"
                    type="number"
                    min="1"
                    value={taskTanksToRemove}
                    onChange={(e) => setTaskTanksToRemove(parseInt(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-emerald-500"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">დასატოვებელი ავზი:</label>
                  <input
                    id="task-input-tanks_to_leave"
                    type="number"
                    min="1"
                    value={taskTanksToLeave}
                    onChange={(e) => setTaskTanksToLeave(parseInt(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">სამუშაო საათები:</label>
                <input
                  id="task-input-working-hours"
                  type="text"
                  value={taskWorkingHours}
                  onChange={(e) => setTaskWorkingHours(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">კომენტარი / შენიშვნა მძღოლს:</label>
                <textarea
                  id="task-textarea-notes"
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="მაგ: პარკინგისთვის დაურეკეთ მზარეულს..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-xl font-bold transition-all"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-all"
                >
                  დავალების შექმნა
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
