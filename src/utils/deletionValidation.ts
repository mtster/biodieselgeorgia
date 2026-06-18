import { Order, Vendor, User, City, Truck, Warehouse } from '../types';

export function checkSupplierDeletion(
  id: string,
  tradeName: string,
  orders: Order[]
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  const isTied = activeOrders.some(o => o.vendor_id === id);
  if (isTied) {
    return `Can not delete ${tradeName} because it is tied to Order`;
  }
  return null;
}

export function checkUserDeletion(
  id: string,
  name: string,
  orders: Order[],
  vendors: Vendor[]
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  const isTiedToOrder = activeOrders.some(
    o => o.operator_id === id || o.driver_id === id || o.companion_id === id
  );
  if (isTiedToOrder) {
    return `Can not delete ${name} because it is tied to Order`;
  }

  const activeVendors = vendors.filter(v => !v.is_deleted);
  const isTiedToVendor = activeVendors.some(
    v => v.manager_id === id || v.operator_id === id
  );
  if (isTiedToVendor) {
    return `Can not delete ${name} because it is tied to Supplier`;
  }

  return null;
}

export function checkCityDeletion(
  id: string,
  name: string,
  vendors: Vendor[]
): string | null {
  const activeVendors = vendors.filter(v => !v.is_deleted);
  const isTied = activeVendors.some(v => v.city === id || v.city === name);
  if (isTied) {
    return `Can not delete ${name} because it is tied to Supplier`;
  }
  return null;
}

export function checkVehicleDeletion(
  plate: string,
  orders: Order[]
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  const isTied = activeOrders.some(o => o.truck_plate === plate);
  if (isTied) {
    return `Can not delete ${plate} because it is tied to Order`;
  }
  return null;
}

export function checkWarehouseDeletion(
  id: string,
  name: string,
  vendors: Vendor[],
  orders: Order[]
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  const isTiedToOrder = activeOrders.some(o => o.warehouse_id === id);
  if (isTiedToOrder) {
    return `Can not delete ${name} because it is tied to Order`;
  }

  const activeVendors = vendors.filter(v => !v.is_deleted);
  const isTiedToVendor = activeVendors.some(v => v.warehouse_id === id);
  if (isTiedToVendor) {
    return `Can not delete ${name} because it is tied to Supplier`;
  }

  return null;
}
