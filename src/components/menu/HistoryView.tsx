import React, { useState, useEffect } from 'react';
import { ChangeHistory, User } from '../../types';
import PageHeader from '../PageHeader';
import { StandardTable, ColumnConfig } from '../StandardTable';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t, formatDateTime } from '../../utils/lang';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { usePaginatedHistory } from '../../hooks/usePaginatedModuleQuery';

interface Props {
  history?: ChangeHistory[];
  users?: User[];
  currentUser?: User | null;
  loadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
}

export default function HistoryView({ history = [], users = [], currentUser = null }: Props) {
  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(endOfMonth.getDate())}`;
  });
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedOperation, setSelectedOperation] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [page, setPage] = useState(1);

  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm
  } = useDebouncedSearch('', 350);

  // Reset page to 1 whenever any filter or search term changes
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, debouncedSearchTerm, selectedUser, selectedOperation, selectedField]);

  const historyFilters = {
    startDate,
    endDate,
    searchTerm: debouncedSearchTerm,
    selectedUser,
    selectedOperation,
    selectedField
  };

  const { data: paginatedData, isLoading } = usePaginatedHistory(
    page,
    historyFilters,
    currentUser
  );

  // Compute dynamic filter dropdown options
  const userOptions = Array.from(new Set([
    ...users.map(u => u.name).filter(Boolean),
    ...history.map(d => d.employee_name).filter(Boolean)
  ])).sort() as string[];

  const commonOperations = [
    'Supplier added', 'Supplier updated', 'Supplier deleted',
    'Order added', 'Order updated', 'Order status changed', 'Order deleted',
    'Vehicle added', 'Vehicle updated', 'Vehicle deleted',
    'Communication added', 'Communication deleted',
    'User added', 'User updated', 'User deleted',
    'Direction added', 'Direction updated', 'Direction deleted',
    'Warehouse added', 'Warehouse updated', 'Warehouse deleted',
    'City added', 'City updated', 'City deleted',
    'District added', 'District updated', 'District deleted'
  ];
  const uniqueOperations = Array.from(new Set([
    ...commonOperations,
    ...history.map(d => d.operation).filter(Boolean)
  ])).sort() as string[];

  const uniqueFields = Array.from(new Set([
    'Name', 'Status', 'Driver', 'Assistant', 'Vehicle', 'Price', 'Address', 'Direction', 'Warehouse', 'City', 'District', 'Role',
    ...history.map(d => d.field_name).filter(Boolean)
  ])).sort() as string[];

  const columns: ColumnConfig<ChangeHistory>[] = [
    {
      header: t('Date & Time'),
      key: 'date_time',
      render: (log) => formatDateTime(log.date_time)
    },
    {
      header: t('User'),
      key: 'employee_name',
      render: (log) => log.employee_name
    },
    {
      header: t('Operation'),
      key: 'operation',
      render: (log) => t(log.operation)
    },
    {
      header: t('Field'),
      key: 'field_name',
      render: (log) => log.field_name ? t(log.field_name) : '-'
    },
    {
      header: t('Old Value'),
      key: 'old_value',
      render: (log) => log.old_value ? t(log.old_value) : '-'
    },
    {
      header: t('New Value'),
      key: 'new_value',
      render: (log) => log.new_value ? t(log.new_value) : '-'
    }
  ];

  const logs = paginatedData?.logs ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header */}
      <PageHeader title={t("Change History")} />

      {/* 2. Filters Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        <PeriodFilter 
          startDate={startDate} 
          setStartDate={setStartDate} 
          endDate={endDate} 
          setEndDate={setEndDate} 
        />

        <div className="flex-1 w-full">
          <CentralSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            idPrefix="history-search"
            searchPlaceholder={t("Search change history logs...")}
            filters={[
              {
                label: t("User"),
                value: selectedUser,
                placeholder: t("All Users"),
                onChange: setSelectedUser,
                options: userOptions.map(user => ({ value: user, label: user }))
              },
              {
                label: t("Operation"),
                value: selectedOperation,
                placeholder: t("All Operations"),
                onChange: setSelectedOperation,
                options: uniqueOperations.map(op => ({ value: op, label: t(op) }))
              },
              {
                label: t("Field"),
                value: selectedField,
                placeholder: t("All Fields"),
                onChange: setSelectedField,
                options: uniqueFields.map(fd => ({ value: fd, label: t(fd) }))
              }
            ]}
          />
        </div>
      </div>

      {/* 3. Table element with built-in server-side pagination */}
      <div className="space-y-4">
        <StandardTable
          data={logs}
          columns={columns}
          serverTotalCount={totalCount}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
          emptyMessage={t("No change history logs match current filters.")}
        />
      </div>
    </div>
  );
}
