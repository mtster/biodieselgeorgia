import React, { useState, useEffect } from 'react';
import { Vehicle, User, City, Warehouse, Direction } from '../../types';
import { FormInput, FormSelect } from '../FormInput';
import FormModal from '../FormModal';
import { t } from '../../utils/lang';
import { findDeletedVehicle } from '../../services/vehicleService';
import VehicleRecoverModal from './VehicleRecoverModal';

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTruck: Vehicle | null;
  trucks?: Vehicle[];
  employees: User[];
  cities: City[];
  warehouses: Warehouse[];
  directions: Direction[];
  onSaveTruck: (t: Vehicle) => Promise<void> | void;
  onDeleteTruck: () => void;
}

export default function VehicleFormModal({
  isOpen,
  onClose,
  selectedTruck,
  trucks = [],
  employees,
  cities,
  warehouses,
  directions,
  onSaveTruck,
  onDeleteTruck
}: VehicleFormModalProps) {
  // Field values
  const [tPlate, setTPlate] = useState('');
  const [tPassword, setTPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [plateError, setPlateError] = useState('');
  const [tModel, setTModel] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tCompanion, setTCompanion] = useState('');
  const [tCity, setTCity] = useState('');
  const [tWarehouseId, setTWarehouseId] = useState('');
  const [tDirectionId, setTDirectionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Recovery modal state
  const [deletedVehicleFound, setDeletedVehicleFound] = useState<Vehicle | null>(null);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [isCheckingDeleted, setIsCheckingDeleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTPlate(selectedTruck ? selectedTruck.plate_number : '');
      setTPassword('');
      setPasswordError('');
      setPlateError('');
      setTModel(selectedTruck ? selectedTruck.model : '');
      setTDriver(selectedTruck ? selectedTruck.driver_id || '' : '');
      setTCompanion(selectedTruck ? selectedTruck.companion_id || '' : '');
      setTCity(selectedTruck ? selectedTruck.city || '' : '');
      setTWarehouseId(selectedTruck ? selectedTruck.warehouse_id || '' : '');
      setTDirectionId(selectedTruck ? selectedTruck.direction_id || '' : '');
      setDeletedVehicleFound(null);
      setIsRecoverModalOpen(false);
      setIsCheckingDeleted(false);
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

  const handleSave = async () => {
    const cleanPlate = tPlate.trim().toUpperCase();
    if (!cleanPlate || !tModel.trim()) {
      alert(t('Please enter license plate and model name.'));
      return;
    }

    if (!selectedTruck && !tPassword.trim()) {
      setPasswordError(t('Password is required (min. 6 symbols)'));
      return;
    }

    if (tPassword.trim() && tPassword.trim().length < 6) {
      setPasswordError(t('Password must be at least 6 characters'));
      return;
    }

    // 1. Check if plate is already in use by an active vehicle
    const activeDuplicate = trucks.find(
      tr => tr.plate_number.toUpperCase() === cleanPlate &&
            (!selectedTruck || tr.id !== selectedTruck.id) &&
            !tr.is_deleted
    );
    if (activeDuplicate) {
      setPlateError(t('Vehicle with this license plate already exists') || 'ავტომობილი ამ სახელმწიფო ნომრით უკვე არსებობს.');
      return;
    }

    // 2. Check if this plate belongs to a previously soft-deleted vehicle
    const isNewOrDifferentPlate = !selectedTruck || selectedTruck.plate_number.toUpperCase() !== cleanPlate;
    if (isNewOrDifferentPlate) {
      try {
        setIsCheckingDeleted(true);
        const deletedVehicle = await findDeletedVehicle(cleanPlate);
        setIsCheckingDeleted(false);

        if (deletedVehicle) {
          setDeletedVehicleFound(deletedVehicle);
          setIsRecoverModalOpen(true);
          return;
        }
      } catch (err) {
        setIsCheckingDeleted(false);
        console.warn('Error checking deleted vehicle:', err);
      }
    }

    // 3. Normal save
    const driverObj = employees.find(e => e.id === tDriver);
    const companionObj = employees.find(e => e.id === tCompanion);

    setIsSaving(true);
    setPasswordError('');
    try {
      await onSaveTruck({
        id: selectedTruck?.id,
        plate_number: cleanPlate,
        model: tModel.trim(),
        driver_id: tDriver ? tDriver : null,
        driver_name: driverObj?.name || '',
        companion_id: tCompanion ? tCompanion : null,
        companion_name: companionObj?.name || '',
        city: tCity || null,
        warehouse_id: tWarehouseId || null,
        direction_id: tDirectionId || null,
        created_by: selectedTruck?.created_by,
        auth_user_id: selectedTruck?.auth_user_id,
        password: tPassword.trim() || undefined,
        is_deleted: false,
        original_plate_number: selectedTruck?.plate_number
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setPasswordError(err?.message || 'ავტომობილის ან პაროლის შენახვა ვერ მოხერხდა.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRecover = async () => {
    if (!deletedVehicleFound) return;
    const cleanPlate = (tPlate || deletedVehicleFound.plate_number).trim().toUpperCase();
    const driverObj = employees.find(e => e.id === (tDriver || deletedVehicleFound.driver_id));
    const companionObj = employees.find(e => e.id === (tCompanion || deletedVehicleFound.companion_id));

    setIsSaving(true);
    setPasswordError('');
    try {
      await onSaveTruck({
        ...deletedVehicleFound,
        id: deletedVehicleFound.id,
        plate_number: cleanPlate,
        model: tModel.trim() || deletedVehicleFound.model,
        driver_id: tDriver || deletedVehicleFound.driver_id || '',
        driver_name: driverObj?.name || deletedVehicleFound.driver_name || '',
        companion_id: tCompanion || deletedVehicleFound.companion_id || '',
        companion_name: companionObj?.name || deletedVehicleFound.companion_name || '',
        city: tCity || deletedVehicleFound.city || '',
        warehouse_id: tWarehouseId || deletedVehicleFound.warehouse_id || '',
        direction_id: tDirectionId || deletedVehicleFound.direction_id || '',
        created_by: deletedVehicleFound.created_by,
        auth_user_id: deletedVehicleFound.auth_user_id,
        password: tPassword.trim() || undefined,
        is_deleted: false,
        original_plate_number: deletedVehicleFound.plate_number
      });
      setIsRecoverModalOpen(false);
      setDeletedVehicleFound(null);
      onClose();
    } catch (err: any) {
      console.error('Error recovering vehicle:', err);
      setPasswordError(err?.message || 'ავტომობილის აღდგენა ვერ მოხერხდა.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelRecover = () => {
    setIsRecoverModalOpen(false);
    setDeletedVehicleFound(null);
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        title={selectedTruck ? t('Vehicle Specifications') : t('Add Vehicle to Fleet')}
        maxWidthClass="max-w-md"
        onDelete={selectedTruck ? onDeleteTruck : undefined}
        deleteLabel={t("Delete")}
        hideCancel={true}
        onSave={handleSave}
        saveLabel={t("Save Changes")}
        isSaving={isSaving}
        saveDisabled={isSaving}
      >
        <div className="space-y-4">
          <FormInput
            label={`${t("License Plate Number")} *`}
            type="text"
            fontClass="font-mono"
            value={tPlate}
            onChange={(e) => {
              setTPlate(formatLicensePlate(e.target.value));
              if (plateError) setPlateError('');
            }}
            disabled={isCheckingDeleted}
            placeholder={t("e.g. AA-123-BB")}
            error={plateError}
            className="disabled:bg-slate-50 disabled:text-gray-500"
          />

          <FormInput
            label={selectedTruck ? "პაროლი(მინ. 6 სიმბოლო) (არასავალდებულო)" : "პაროლი(მინ. 6 სიმბოლო) *"}
            type="password"
            fontClass="font-mono"
            value={tPassword}
            autoComplete="new-password"
            onChange={(e) => {
              setTPassword(e.target.value);
              if (passwordError) setPasswordError('');
            }}
            placeholder=""
            error={passwordError}
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
            label={t("mimartuleba")}
            value={tDirectionId}
            onChange={(e) => setTDirectionId(e.target.value)}
          >
            <option value="">{t("Select a Direction")}</option>
            {directions.map(dir => (
              <option key={dir.id} value={dir.id}>{dir.name}</option>
            ))}
          </FormSelect>

          <FormSelect
            label={t("Assigned Default Driver")}
            value={tDriver}
            onChange={(e) => setTDriver(e.target.value)}
          >
            <option value="">{t("Select Driver")}</option>
            {employees.filter(e => e.role === 'driver').map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </FormSelect>

          <FormSelect
            label={t("Assigned Co-Driver / Companion")}
            value={tCompanion}
            onChange={(e) => setTCompanion(e.target.value)}
          >
            <option value="">{t("Select Companion")}</option>
            {employees.filter(e => !e.is_deleted && !e.is_blocked && (e.role === 'driver_assistant' || e.role === 'driver')).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({t(e.role)})</option>
            ))}
          </FormSelect>
        </div>
      </FormModal>

      <VehicleRecoverModal
        isOpen={isRecoverModalOpen}
        onClose={handleCancelRecover}
        onConfirm={handleConfirmRecover}
        plateNumber={tPlate.trim().toUpperCase()}
      />
    </>
  );
}
