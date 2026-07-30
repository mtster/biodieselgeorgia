import React, { useState } from 'react';
import { Vehicle, User, City, Warehouse, Direction } from '../../types';
import { Plus } from 'lucide-react';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import VehicleCard from './VehicleCard';
import VehicleFormModal from './VehicleFormModal';
import { t } from '../../utils/lang';

import { checkVehicleDeletion } from '../../utils/deletionValidation';

interface Props {
  currentUser?: User;
  trucks: Vehicle[];
  employees: User[];
  cities: City[];
  warehouses: Warehouse[];
  directions: Direction[];
  orders?: any[];
  onSaveTruck: (t: Vehicle) => void;
  onDeleteTruck: (plate: string) => void;
  setDeleteAlertMessage?: (msg: string | null) => void;
  onBack: () => void;
}

export default function VehiclesSettingView({
  trucks,
  employees,
  cities = [],
  warehouses = [],
  directions = [],
  orders = [],
  onSaveTruck,
  onDeleteTruck,
  setDeleteAlertMessage,
  onBack,
  currentUser
}: Props) {
  const canAddVehicle = currentUser?.role === 'admin' || currentUser?.permissions?.['vehicles']?.includes('add');
  const canDeleteVehicle = currentUser?.role === 'admin' || currentUser?.permissions?.['vehicles']?.includes('delete');

  const [selectedTruck, setSelectedTruck] = useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [truckToDelete, setTruckToDelete] = useState<string | null>(null);

  const activeTrucks = trucks.filter(t => !t.is_deleted);

  const handleOpenTruck = (truck: Vehicle | null) => {
    setSelectedTruck(truck);
    setIsModalOpen(true);
  };

  const triggerDeleteTruck = () => {
    if (selectedTruck) {
      const errorMsg = checkVehicleDeletion(selectedTruck.plate_number, orders);
      if (errorMsg) {
        if (setDeleteAlertMessage) setDeleteAlertMessage(errorMsg);
        return;
      }
      setTruckToDelete(selectedTruck.plate_number);
      setShowConfirmDelete(true);
    }
  };

  const handleConfirmDeleteTruck = () => {
    if (truckToDelete) {
      onDeleteTruck(truckToDelete);
      setIsModalOpen(false);
      setSelectedTruck(null);
      setTruckToDelete(null);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader title={t("Vehicles")} />

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
        {activeTrucks.map((truck) => (
          <VehicleCard
            key={truck.plate_number}
            truck={truck}
            employees={employees}
            warehouses={warehouses}
            onOpen={handleOpenTruck}
          />
        ))}

        {/* Plus card */}
        {canAddVehicle && (
          <button
            onClick={() => handleOpenTruck(null)}
            type="button"
            className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[160px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
              <Plus size={20} />
            </div>
            <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
              {t("Add New Vehicle")}
            </span>
          </button>
        )}
      </div>

      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTruck(null);
        }}
        selectedTruck={selectedTruck}
        employees={employees}
        cities={cities}
        warehouses={warehouses}
        directions={directions}
        onSaveTruck={onSaveTruck}
        onDeleteTruck={canDeleteVehicle ? triggerDeleteTruck : undefined}
      />

      {/* Decommission Modal confirmation overlays */}
      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={handleConfirmDeleteTruck}
        title={t("Decommission vehicle?")}
        message={
          <span>
            {t("Are you sure you want to delete vehicle license plate")} <strong>"{truckToDelete}"</strong>? {t("This will mark it as soft-deleted and prevent active log assignments.")}
          </span>
        }
      />
    </div>
  );
}
