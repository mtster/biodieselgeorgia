import React from 'react';
import { Vehicle, User, Warehouse } from '../../types';
import { Truck as TruckIcon } from 'lucide-react';
import { t } from '../../utils/lang';

interface VehicleCardProps {
  truck: Vehicle;
  employees: User[];
  warehouses: Warehouse[];
  onOpen: (truck: Vehicle) => void;
}

export default function VehicleCard({ truck, employees, warehouses, onOpen }: VehicleCardProps) {
  const assignedDriver = employees.find(e => e.id === truck.driver_id || e.personal_id === truck.driver_id)?.name || truck.driver_name || t('None');
  const assignedCompanion = employees.find(e => e.id === truck.companion_id || e.personal_id === truck.companion_id)?.name || truck.companion_name || t('None');
  const assignedWarehouse = warehouses.find(w => w.id === truck.warehouse_id)?.name || t('Unassigned');

  return (
    <button
      onClick={() => onOpen(truck)}
      type="button"
      className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-200 text-left cursor-pointer flex flex-col justify-between min-h-[160px]"
    >
      <div className="space-y-2.5 w-full">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center border border-gray-400 bg-white rounded px-2 py-0.5 font-mono font-extrabold text-[11px] shadow-2xs">
            <div className="w-1.5 h-3 bg-blue-700 mr-1 rounded-xs"></div>
            <span className="text-gray-900 tracking-wider font-extrabold">{truck.plate_number}</span>
          </div>
          <div className="text-gray-400 group-hover:text-amber-800 transition-colors">
            <TruckIcon size={16} />
          </div>
        </div>

        <div>
          <h4 className="font-extrabold text-sm text-gray-855 font-sans truncate">
            {truck.model}
          </h4>
          <div className="text-[10px] text-gray-405 font-sans mt-1.5 space-y-0.5">
            <p className="truncate">{t("City")}: <strong className="text-gray-700">{truck.city || t('Unassigned')}</strong></p>
            <p className="truncate">{t("Warehouse")}: <strong className="text-emerald-800 font-bold">{assignedWarehouse}</strong></p>
            <p className="truncate">{t("Driver")}: <strong className="text-gray-700">{assignedDriver}</strong></p>
            <p className="truncate">{t("Companion")}: <strong className="text-gray-655">{assignedCompanion}</strong></p>
          </div>
        </div>
      </div>

      <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity mt-2 block">
        {t("Manage Asset")} &rarr;
      </span>
    </button>
  );
}
