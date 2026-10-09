import { Order, Vendor } from '../../types';

export interface OrderSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  suppliers: Vendor[];
  vehiclePlateText?: string;
  vehicleId?: string;
  driverId?: string;
  dateStr?: string;
  onOrdersReordered: (newOrders: Order[]) => void;
}

export interface FloatingDragState {
  index: number;
  tradeName: string;
  address: string;
  width: number;
  height: number;
  left: number;
  top: number;
  grabOffsetY: number;
  currentY: number;
}

export interface VendorDisplayInfo {
  tradeName: string;
  address: string;
  lat: number | null;
  lon: number | null;
}
