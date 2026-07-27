import { useQuery } from '@tanstack/react-query';
import { User } from '../types';
import { 
  getVendorsPaginated,
  getOrdersPaginated,
  getCommunicationsPaginated,
  getContactsPaginated,
  getUsersPaginated
} from '../lib/db';
import { hasModuleViewPermission } from '../lib/realtime';

export function usePaginatedVendors(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'suppliers');

  return useQuery({
    queryKey: ['vendors', page, JSON.stringify(filters)],
    queryFn: () => getVendorsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePaginatedOrders(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'orders');

  return useQuery({
    queryKey: ['orders', page, JSON.stringify(filters)],
    queryFn: () => getOrdersPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePaginatedCommunications(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'communications');

  return useQuery({
    queryKey: ['communications', page, JSON.stringify(filters)],
    queryFn: () => getCommunicationsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePaginatedContacts(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'contacts');

  return useQuery({
    queryKey: ['contacts', page, searchTerm],
    queryFn: () => getContactsPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePaginatedUsers(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'employees');

  return useQuery({
    queryKey: ['users', page, searchTerm],
    queryFn: () => getUsersPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    staleTime: 1000 * 60 * 5,
  });
}
