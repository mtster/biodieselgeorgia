import React, { useState } from 'react';
import { 
  Users, MapPin, Truck, History, Database, ArrowLeft, ShieldAlert 
} from 'lucide-react';
import { 
  User, City, District, Vehicle as TruckType, ChangeHistory, Warehouse, Direction
} from '../../types';

import UsersView from './UsersView';
import HistoryView from './HistoryView';
import CitiesSettingView from '../settings/CitiesSettingView';
import VehiclesSettingView from '../settings/VehiclesSettingView';

interface SettingsProps {
  onResetDatabase: () => void | Promise<void>;
  users: User[];
  currentUser: User;
  onSaveUser: (u: User) => void;
  onDeleteUser: (id: string, name: string) => void;
  cities: City[];
  districts: District[];
  onSaveCity: (c: City) => void;
  onDeleteCity: (id: string, name: string) => void;
  onSaveDistrict: (d: District) => void;
  onDeleteDistrict: (id: string, name: string) => void;
  trucks: TruckType[];
  onSaveTruck: (t: TruckType) => void;
  onDeleteTruck: (plate: string) => void;
  warehouses: Warehouse[];
  directions: Direction[];
  changeHistory: ChangeHistory[];
  onRevertChange: (log: ChangeHistory) => Promise<boolean>;
  loadMore: () => Promise<void>;
  isLoadingMore: boolean;
}

export default function SettingsView({
  onResetDatabase,
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
  cities,
  districts,
  onSaveCity,
  onDeleteCity,
  onSaveDistrict,
  onDeleteDistrict,
  trucks,
  onSaveTruck,
  onDeleteTruck,
  warehouses,
  directions,
  changeHistory,
  onRevertChange,
  loadMore,
  isLoadingMore
}: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'cities' | 'vehicles' | 'history' | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (confirm('⚠️ WARNING: This will clear custom cache and restore the database to seed values. Continue?')) {
      setResetting(true);
      try {
        await onResetDatabase();
        alert('Database has been recovered successfully.');
        window.location.reload();
      } catch (e) {
        console.error(e);
      } finally {
        setResetting(false);
      }
    }
  };

  // Switch to sub tabs
  if (activeSubTab === 'users') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveSubTab(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer select-none"
        >
          <ArrowLeft size={14} />
          Back to Settings
        </button>
        <UsersView 
          users={users}
          currentUser={currentUser}
          warehouses={warehouses}
          onSave={onSaveUser}
          onDelete={onDeleteUser}
        />
      </div>
    );
  }

  if (activeSubTab === 'history') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveSubTab(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer select-none"
        >
          <ArrowLeft size={14} />
          Back to Settings
        </button>
        <HistoryView 
          history={changeHistory}
          loadMore={loadMore}
          isLoadingMore={isLoadingMore}
        />
      </div>
    );
  }

  if (activeSubTab === 'cities') {
    return (
      <CitiesSettingView 
        cities={cities}
        districts={districts}
        onSaveCity={onSaveCity}
        onDeleteCity={onDeleteCity}
        onSaveDistrict={onSaveDistrict}
        onDeleteDistrict={onDeleteDistrict}
        onBack={() => setActiveSubTab(null)}
      />
    );
  }

  if (activeSubTab === 'vehicles') {
    return (
      <VehiclesSettingView 
        trucks={trucks}
        employees={users}
        cities={cities}
        warehouses={warehouses}
        directions={directions}
        onSaveTruck={onSaveTruck}
        onDeleteTruck={onDeleteTruck}
        onBack={() => setActiveSubTab(null)}
      />
    );
  }

  return (
    <div className="space-y-8 pt-4 md:pt-6 text-left font-sans animate-in fade-in duration-200" id="settings-view-deck">
      {/* Settings Section Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Control Panel & System Settings</h2>
      </div>

      {/* 4 Windows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 select-none">
        {/* Card 1: Users */}
        <button
          onClick={() => setActiveSubTab('users')}
          type="button"
          className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-250 text-left flex gap-5 items-start cursor-pointer group"
        >
          <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-2xl shrink-0 group-hover:bg-emerald-800 group-hover:text-white transition-all duration-200">
            <Users size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">Users Management</h3>
          </div>
        </button>

        {/* Card 2: Cities */}
        <button
          onClick={() => setActiveSubTab('cities')}
          type="button"
          className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-250 text-left flex gap-5 items-start cursor-pointer group"
        >
          <div className="bg-amber-50 text-amber-700 p-3.5 rounded-2xl shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-all duration-200">
            <MapPin size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">Cities & Territories</h3>
          </div>
        </button>

        {/* Card 3: Vehicles */}
        <button
          onClick={() => setActiveSubTab('vehicles')}
          type="button"
          className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-250 text-left flex gap-5 items-start cursor-pointer group"
        >
          <div className="bg-indigo-50 text-indigo-700 p-3.5 rounded-2xl shrink-0 group-hover:bg-indigo-650 group-hover:text-white transition-all duration-200">
            <Truck size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">Vehicles Fleet</h3>
          </div>
        </button>

        {/* Card 4: Change History */}
        <button
          onClick={() => setActiveSubTab('history')}
          type="button"
          className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-250 text-left flex gap-5 items-start cursor-pointer group"
        >
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-all duration-200">
            <History size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">Change Audit History</h3>
          </div>
        </button>
      </div>

      {/* Recovery Section */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
        <div className="flex gap-4 items-start">
          <div className="bg-orange-100 rounded-xl p-2.5 text-orange-750 shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div className="space-y-0.5 text-left">
            <h4 className="text-xs font-black uppercase text-gray-650 tracking-wider">Database recovery operations</h4>
          </div>
        </div>
        <button
          type="button"
          disabled={resetting}
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4.5 py-3.5 bg-white border border-gray-200 text-slate-800 font-extrabold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Database size={15} />
          {resetting ? 'Recovering...' : 'Restore Seed Database'}
        </button>
      </div>
    </div>
  );
}
