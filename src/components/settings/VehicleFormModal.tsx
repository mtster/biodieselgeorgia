import React, { useState, useEffect } from 'react';
import { Vehicle, User, City, Warehouse, Direction } from '../../types';
import { FormInput, FormSelect } from '../FormInput';
import FormModal from '../FormModal';
import { t } from '../../utils/lang';

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTruck: Vehicle | null;
  employees: User[];
  cities: City[];
  warehouses: Warehouse[];
  directions: Direction[];
  onSaveTruck: (t: Vehicle) => void;
  onDeleteTruck: () => void;
}

export default function VehicleFormModal({
  isOpen,
  onClose,
  selectedTruck,
  employees,
  cities,
  warehouses,
  directions,
  onSaveTruck,
  onDeleteTruck
}: VehicleFormModalProps) {
  // Field values
  const [tPlate, setTPlate] = useState('');
  const [tModel, setTModel] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tCompanion, setTCompanion] = useState('');
  const [tCity, setTCity] = useState('');
  const [tWarehouseId, setTWarehouseId] = useState('');
  const [tDirectionId, setTDirectionId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTPlate(selectedTruck ? selectedTruck.plate_number : '');
      setTModel(selectedTruck ? selectedTruck.model : '');
      setTDriver(selectedTruck ? selectedTruck.driver_id || '' : '');
      setTCompanion(selectedTruck ? selectedTruck.companion_id || '' : '');
      setTCity(selectedTruck ? selectedTruck.city || '' : '');
      setTWarehouseId(selectedTruck ? selectedTruck.warehouse_id || '' : '');
      setTDirectionId(selectedTruck ? selectedTruck.direction_id || '' : '');
    }
  }, [isOpen, selectedTruck]);

  // Georgian plate conversion helper
  const ge2en: Record<string, string> = { 
    'ა':'A', 'ბ':'B', 'გ':'G', 'დ':'D', 'ე':'E', 'ვ':'V', 'ზ':'Z', 
    'თ':'T', 'ი':'I', 'კ':'K', 'ლ':'L', 'მ':'M', 'ნ':'N', 'ო':'O', 
    'პ':'P', 'ჟ':'J', 'რ':'R', 'ს':'S', 'ტ':'T', 'უ':'U', 'ფ':'F', 
    'ქ':'Q', 'ღ':'R', 'ყ':'Y', 'შ':'S', 'ჩ':'C', 'ც':'C', 'ძ':'Z', 
    'წ':'W', 'ჭ':'C', 'ხ':'X', 'ჯ':'J', 'ჰ':'H' 
  };

  const formatLicensePlate = (val: string) => {
    let mapped = val.toUpperCase().split('').map(c => ge2en[c] || c).join('');
    let clean = mapped.replace(/[^A-Z0-9]/g, '');
    let res = '';
    let let1 = clean.substring(0, 2).replace(/[^A-Z]/g, '');
    let num = clean.substring(let1.length, let1.length + 3).replace(/[^0-9]/g, '');
    let let2 = clean.substring(let1.length + num.length, let1.length + num.length + 2).replace(/[^A-Z]/g, '');
    
    if (let1) res += let1;
    if (let1.length === 2 && (num || val.endsWith('-'))) res += '-';
    if (num) res += num;
    if (num.length === 3 && (let2 || (val.endsWith('-') && clean.length === 5))) res += '-';
    if (let2) res += let2;
    return res;
  };

  const handleSave = () => {
    if (!tPlate.trim() || !tModel.trim()) {
      alert(t('Please enter license plate and model name.'));
      return;
    }

    const driverObj = employees.find(e => e.id === tDriver);
    const companionObj = employees.find(e => e.id === tCompanion);

    onSaveTruck({
      plate_number: tPlate.trim(),
      model: tModel.trim(),
      driver_id: tDriver,
      driver_name: driverObj?.name || '',
      companion_id: tCompanion,
      companion_name: companionObj?.name || '',
      city: tCity,
      warehouse_id: tWarehouseId,
      direction_id: tDirectionId,
      is_deleted: false
    });

    onClose();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedTruck ? t('Vehicle Specifications') : t('Add Vehicle to Fleet')}
      maxWidthClass="max-w-md"
      onDelete={selectedTruck ? onDeleteTruck : undefined}
      deleteLabel={t("Delete")}
      onCancel={onClose}
      onSave={handleSave}
      saveLabel={t("Save Changes")}
    >
      <div className="space-y-4">
        <FormInput
          label={`${t("License Plate Number")} *`}
          type="text"
          fontClass="font-mono"
          value={tPlate}
          onChange={(e) => setTPlate(formatLicensePlate(e.target.value))}
          disabled={false}
          placeholder={t("e.g. AA-123-BB")}
          className="disabled:bg-slate-50 disabled:text-gray-500"
        />

        <FormInput
          label={`${t("Vehicle Brand / Model")} *`}
          type="text"
          value={tModel}
          onChange={(e) => setTModel(e.target.value)}
          placeholder={t("e.g. Mercedes Sprinter")}
        />

        <FormSelect
          label={t("City / Region")}
          value={tCity}
          onChange={(e) => setTCity(e.target.value)}
        >
          <option value="">{t("Select a City")}</option>
          {cities.map(city => (
            <option key={city.id} value={city.name}>{city.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label={t("Assigned Warehouse")}
          value={tWarehouseId}
          onChange={(e) => setTWarehouseId(e.target.value)}
        >
          <option value="">{t("Select a Warehouse")}</option>
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label={t("mimartulebebi")}
          value={tDirectionId}
          onChange={(e) => setTDirectionId(e.target.value)}
        >
          <option value="">{t("Select a Direction")}</option>
          {directions.map(dir => (
            <option key={dir.id} value={dir.id}>{dir.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label={`${t("Assigned Default Driver")} *`}
          value={tDriver}
          onChange={(e) => setTDriver(e.target.value)}
        >
          <option value="" hidden></option>
          {employees.filter(e => e.role === 'driver').map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </FormSelect>

        <FormSelect
          label={t("Assigned Co-Driver / Companion")}
          value={tCompanion}
          onChange={(e) => setTCompanion(e.target.value)}
        >
          <option value="" hidden></option>
          {employees.filter(e => e.role !== 'driver').map(e => (
            <option key={e.id} value={e.id}>{e.name} ({t(e.role)})</option>
          ))}
        </FormSelect>
      </div>
    </FormModal>
  );
}
