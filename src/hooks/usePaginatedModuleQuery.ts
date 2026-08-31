import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
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
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'suppliers');
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['vendors', page, filterKey],
    queryFn: () => getVendorsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isAllowed && currentUser && query.data?.totalCount !== undefined) {
      if (page * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['vendors', page + 1, filterKey],
          queryFn: () => getVendorsPaginated(12, page * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [page, filterKey, isAllowed, currentUser, queryClient, query.data?.totalCount]);

  return query;
}

export function usePaginatedOrders(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'orders');
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['orders', page, filterKey],
    queryFn: () => getOrdersPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isAllowed && currentUser && query.data?.totalCount !== undefined) {
      if (page * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['orders', page + 1, filterKey],
          queryFn: () => getOrdersPaginated(12, page * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [page, filterKey, isAllowed, currentUser, queryClient, query.data?.totalCount]);

  return query;
}

export function usePaginatedCommunications(
  page: number,
  filters: any,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'communications');
  const filterKey = JSON.stringify(filters);

  const query = useQuery({
    queryKey: ['communications', page, filterKey],
    queryFn: () => getCommunicationsPaginated(12, (page - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isAllowed && currentUser && query.data?.totalCount !== undefined) {
      if (page * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['communications', page + 1, filterKey],
          queryFn: () => getCommunicationsPaginated(12, page * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [page, filterKey, isAllowed, currentUser, queryClient, query.data?.totalCount]);

  return query;
}

export function usePaginatedContacts(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'contacts');

  const query = useQuery({
    queryKey: ['contacts', page, searchTerm],
    queryFn: () => getContactsPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isAllowed && currentUser && query.data?.totalCount !== undefined) {
      if (page * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['contacts', page + 1, searchTerm],
          queryFn: () => getContactsPaginated(12, page * 12, searchTerm),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [page, searchTerm, isAllowed, currentUser, queryClient, query.data?.totalCount]);

  return query;
}

export function usePaginatedUsers(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'users');

  const query = useQuery({
    queryKey: ['users', page, searchTerm],
    queryFn: () => getUsersPaginated(12, (page - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isAllowed && currentUser && query.data?.totalCount !== undefined) {
      if (page * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['users', page + 1, searchTerm],
          queryFn: () => getUsersPaginated(12, page * 12, searchTerm),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [page, searchTerm, isAllowed, currentUser, queryClient, query.data?.totalCount]);

  return query;
}
