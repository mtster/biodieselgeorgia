import { useQuery } from '@tanstack/react-query';
import { User } from '../types';
import { 
  getVendorsPaginated,
  getOrdersPaginated,
  getCommunicationsPaginated,
  getContactsPaginated,
  getUsersPaginated,
  getChangeHistoryPaginated
} from '../lib/db';
import { hasModuleViewPermission } from '../lib/realtime';

export function usePaginatedHistory(
  page: number,
  filters: {
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
    selectedUser?: string;
    selectedOperation?: string;
    selectedField?: string;
  },
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'history') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['change_history', page, filterKey],
    queryFn: () => getChangeHistoryPaginated(
      12,
      (page - 1) * 12,
      filters.startDate,
      filters.endDate,
      filters.searchTerm,
      filters.selectedUser,
      filters.selectedOperation,
      filters.selectedField
    ),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === filterKey) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function usePaginatedVendors(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'suppliers') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['vendors', page, filterKey],
    queryFn: () => getVendorsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === filterKey) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function usePaginatedOrders(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'orders') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['orders', page, filterKey],
    queryFn: () => getOrdersPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === filterKey) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function usePaginatedCommunications(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'communications') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['communications', page, filterKey],
    queryFn: () => getCommunicationsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === filterKey) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function usePaginatedContacts(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'contacts') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';

  const query = useQuery({
    queryKey: ['contacts', page, searchTerm],
    queryFn: () => getContactsPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === searchTerm) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}

export function usePaginatedUsers(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const isAllowed = hasModuleViewPermission(currentUser, 'users') && currentUser?.role !== 'driver' && currentUser?.role !== 'vendor';

  const query = useQuery({
    queryKey: ['users', page, searchTerm],
    queryFn: () => getUsersPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery && previousQuery.queryKey[2] === searchTerm) {
        return previousData;
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  return query;
}
