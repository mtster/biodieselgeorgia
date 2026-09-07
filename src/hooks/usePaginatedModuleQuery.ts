import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
  const prevFilterKeyRef = useRef(filterKey);

  // If filters changed, ensure we query page 1 immediately
  const effectivePage = prevFilterKeyRef.current !== filterKey ? 1 : page;
  useEffect(() => {
    prevFilterKeyRef.current = filterKey;
  }, [filterKey]);

  const query = useQuery({
    queryKey: ['vendors', effectivePage, filterKey],
    queryFn: () => getVendorsPaginated(12, (effectivePage - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      isAllowed && 
      currentUser && 
      !query.isPlaceholderData && 
      query.data?.totalCount !== undefined && 
      query.data.totalCount > 0
    ) {
      if (effectivePage * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['vendors', effectivePage + 1, filterKey],
          queryFn: () => getVendorsPaginated(12, effectivePage * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [effectivePage, filterKey, isAllowed, currentUser, queryClient, query.isPlaceholderData, query.data?.totalCount]);

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
  const prevFilterKeyRef = useRef(filterKey);

  // If filters changed, ensure we query page 1 immediately
  const effectivePage = prevFilterKeyRef.current !== filterKey ? 1 : page;
  useEffect(() => {
    prevFilterKeyRef.current = filterKey;
  }, [filterKey]);

  const query = useQuery({
    queryKey: ['orders', effectivePage, filterKey],
    queryFn: () => getOrdersPaginated(12, (effectivePage - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      isAllowed && 
      currentUser && 
      !query.isPlaceholderData && 
      query.data?.totalCount !== undefined && 
      query.data.totalCount > 0
    ) {
      if (effectivePage * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['orders', effectivePage + 1, filterKey],
          queryFn: () => getOrdersPaginated(12, effectivePage * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [effectivePage, filterKey, isAllowed, currentUser, queryClient, query.isPlaceholderData, query.data?.totalCount]);

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
  const prevFilterKeyRef = useRef(filterKey);

  // If filters changed, ensure we query page 1 immediately
  const effectivePage = prevFilterKeyRef.current !== filterKey ? 1 : page;
  useEffect(() => {
    prevFilterKeyRef.current = filterKey;
  }, [filterKey]);

  const query = useQuery({
    queryKey: ['communications', effectivePage, filterKey],
    queryFn: () => getCommunicationsPaginated(12, (effectivePage - 1) * 12, filters),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      isAllowed && 
      currentUser && 
      !query.isPlaceholderData && 
      query.data?.totalCount !== undefined && 
      query.data.totalCount > 0
    ) {
      if (effectivePage * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['communications', effectivePage + 1, filterKey],
          queryFn: () => getCommunicationsPaginated(12, effectivePage * 12, filters),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [effectivePage, filterKey, isAllowed, currentUser, queryClient, query.isPlaceholderData, query.data?.totalCount]);

  return query;
}

export function usePaginatedContacts(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'contacts');
  const prevSearchRef = useRef(searchTerm);

  // If search term changed, ensure we query page 1 immediately
  const effectivePage = prevSearchRef.current !== searchTerm ? 1 : page;
  useEffect(() => {
    prevSearchRef.current = searchTerm;
  }, [searchTerm]);

  const query = useQuery({
    queryKey: ['contacts', effectivePage, searchTerm],
    queryFn: () => getContactsPaginated(12, (effectivePage - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      isAllowed && 
      currentUser && 
      !query.isPlaceholderData && 
      query.data?.totalCount !== undefined && 
      query.data.totalCount > 0
    ) {
      if (effectivePage * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['contacts', effectivePage + 1, searchTerm],
          queryFn: () => getContactsPaginated(12, effectivePage * 12, searchTerm),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [effectivePage, searchTerm, isAllowed, currentUser, queryClient, query.isPlaceholderData, query.data?.totalCount]);

  return query;
}

export function usePaginatedUsers(
  page: number,
  searchTerm: string,
  currentUser: User | null
) {
  const queryClient = useQueryClient();
  const isAllowed = hasModuleViewPermission(currentUser, 'users');
  const prevSearchRef = useRef(searchTerm);

  // If search term changed, ensure we query page 1 immediately
  const effectivePage = prevSearchRef.current !== searchTerm ? 1 : page;
  useEffect(() => {
    prevSearchRef.current = searchTerm;
  }, [searchTerm]);

  const query = useQuery({
    queryKey: ['users', effectivePage, searchTerm],
    queryFn: () => getUsersPaginated(12, (effectivePage - 1) * 12, searchTerm),
    enabled: isAllowed && !!currentUser,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      isAllowed && 
      currentUser && 
      !query.isPlaceholderData && 
      query.data?.totalCount !== undefined && 
      query.data.totalCount > 0
    ) {
      if (effectivePage * 12 < query.data.totalCount) {
        queryClient.prefetchQuery({
          queryKey: ['users', effectivePage + 1, searchTerm],
          queryFn: () => getUsersPaginated(12, effectivePage * 12, searchTerm),
          staleTime: 1000 * 60 * 5,
        });
      }
    }
  }, [effectivePage, searchTerm, isAllowed, currentUser, queryClient, query.isPlaceholderData, query.data?.totalCount]);

  return query;
}
