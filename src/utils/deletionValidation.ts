import { Order, Vendor, User, City, Truck, Warehouse, Communication, District, Direction } from '../types';

export function checkSupplierDeletion(
  id: string,
  tradeName: string,
  orders: Order[],
  communications: Communication[] = []
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  if (activeOrders.some(o => o.vendor_id === id)) {
    return `ვერ წაიშლება მომწოდებელი "${tradeName}", რადგან ის დაკავშირებულია შეკვეთასთან.`;
  }
  const activeComms = communications.filter(c => !c.is_deleted);
  if (activeComms.some(c => c.vendor_id === id)) {
    return `ვერ წაიშლება მომწოდებელი "${tradeName}", რადგან ის დაკავშირებულია კომუნიკაციასთან.`;
  }
  return null;
}

export function checkUserDeletion(
  id: string,
  name: string,
  orders: Order[],
  vendors: Vendor[],
  communications: Communication[] = [],
  targetRole?: string,
  currentUserRole?: string
): string | null {
  if (targetRole === 'admin' && currentUserRole !== 'admin') {
    return 'ადმინისტრატორის როლის მქონე მომხმარებლის წაშლა შეუძლია მხოლოდ ადმინისტრატორს.';
  }
  const activeOrders = orders.filter(o => !o.is_deleted);
  if (activeOrders.some(o => o.operator_id === id || o.driver_id === id || o.companion_id === id)) {
    return `ვერ წაიშლება მომხმარებელი "${name}", რადგან ის დაკავშირებულია შეკვეთასთან.`;
  }
  const activeVendors = vendors.filter(v => !v.is_deleted);
  if (activeVendors.some(v => v.manager_id === id || v.operator_id === id)) {
    return `ვერ წაიშლება მომხმარებელი "${name}", რადგან ის დაკავშირებულია მომწოდებელთან.`;
  }
  const activeComms = communications.filter(c => !c.is_deleted);
  if (activeComms.some(c => c.user_id === id || c.responsible_user_id === id)) {
    return `ვერ წაიშლება მომხმარებელი "${name}", რადგან ის დაკავშირებულია კომუნიკაციასთან.`;
  }
  return null;
}

export function checkCityDeletion(
  id: string,
  name: string,
  vendors: Vendor[],
  trucks: Truck[] = [],
  districts: District[] = []
): string | null {
  const activeVendors = vendors.filter(v => !v.is_deleted);
  if (activeVendors.some(v => v.city === id || v.city === name)) {
    return `ვერ წაიშლება ქალაქი "${name}", რადგან ის დაკავშირებულია მომწოდებელთან.`;
  }
  const activeTrucks = trucks.filter(t => !t.is_deleted);
  if (activeTrucks.some(t => t.city === id || t.city === name)) {
    return `ვერ წაიშლება ქალაქი "${name}", რადგან ის დაკავშირებულია ტრანსპორტთან.`;
  }
  const activeDistricts = districts.filter(d => !d.is_deleted);
  if (activeDistricts.some(d => d.city_id === id)) {
    return `ვერ წაიშლება ქალაქი "${name}", რადგან მასში არსებობს რაიონები.`;
  }
  return null;
}

export function checkDistrictDeletion(
  id: string,
  name: string,
  vendors: Vendor[]
): string | null {
  const activeVendors = vendors.filter(v => !v.is_deleted);
  if (activeVendors.some(v => v.district === id || v.district === name)) {
    return `ვერ წაიშლება რაიონი "${name}", რადგან ის დაკავშირებულია მომწოდებელთან.`;
  }
  return null;
}

export function checkDirectionDeletion(
  id: string,
  name: string,
  trucks: Truck[] = [],
  orders: Order[] = []
): string | null {
  const activeTrucks = trucks.filter(t => !t.is_deleted);
  if (activeTrucks.some(t => t.direction_id === id)) {
    return `ვერ წაიშლება მიმართულება "${name}", რადგან ის დაკავშირებულია ტრანსპორტთან.`;
  }
  const activeOrders = orders.filter(o => !o.is_deleted);
  if (activeOrders.some(o => o.direction_id === id)) {
    return `ვერ წაიშლება მიმართულება "${name}", რადგან ის დაკავშირებულია შეკვეთასთან.`;
  }
  return null;
}

export function checkVehicleDeletion(
  plate: string,
  orders: Order[]
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  if (activeOrders.some(o => o.truck_plate === plate)) {
    return `ვერ წაიშლება ტრანსპორტი "${plate}", რადგან ის დაკავშირებულია შეკვეთასთან.`;
  }
  return null;
}

export function checkWarehouseDeletion(
  id: string,
  name: string,
  vendors: Vendor[],
  orders: Order[],
  trucks: Truck[] = []
): string | null {
  const activeOrders = orders.filter(o => !o.is_deleted);
  if (activeOrders.some(o => o.warehouse_id === id)) {
    return `ვერ წაიშლება საწყობი "${name}", რადგან ის დაკავშირებულია შეკვეთასთან.`;
  }
  const activeVendors = vendors.filter(v => !v.is_deleted);
  if (activeVendors.some(v => v.warehouse_id === id)) {
    return `ვერ წაიშლება საწყობი "${name}", რადგან ის დაკავშირებულია მომწოდებელთან.`;
  }
  const activeTrucks = trucks.filter(t => !t.is_deleted);
  if (activeTrucks.some(t => t.warehouse_id === id)) {
    return `ვერ წაიშლება საწყობი "${name}", რადგან ის დაკავშირებულია ტრანსპორტთან.`;
  }
  return null;
}

export function checkContactDeletion(
  contactId: string,
  name: string,
  communications: Communication[] = []
): string | null {
  const activeComms = communications.filter(c => !c.is_deleted);
  if (activeComms.some(c => c.vendor_contact_id === contactId)) {
    return `ვერ წაიშლება კონტაქტი "${name}", რადგან ის დაკავშირებულია კომუნიკაციასთან.`;
  }
  return null;
}
