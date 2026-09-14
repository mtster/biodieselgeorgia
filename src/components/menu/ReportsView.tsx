import React, { useState } from 'react';
import { Vendor, Order, User, City, District, Warehouse as WarehouseType } from '../../types';
import PageHeader from '../PageHeader';
import { t } from '../../utils/lang';

import OrdersByPeriod from '../reports/OrdersByPeriod';
import OrdersByWarehouse from '../reports/OrdersByWarehouse';
import DeliveredOrdersBySuppliers from '../reports/DeliveredOrdersBySuppliers';
import DeliveredOrdersByRegions from '../reports/DeliveredOrdersByRegions';
import DeliveredOrdersByManagers from '../reports/DeliveredOrdersByManagers';
import TanksTurnoverBySuppliers from '../reports/TanksTurnoverBySuppliers';
import LastDeliveries from '../reports/LastDeliveries';

import { 
  CalendarRange,
  Warehouse,
  Truck, 
  MapPin, 
  Users, 
  RefreshCw, 
  Clock
} from 'lucide-react';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users?: User[];
  cities?: City[];
  districts?: District[];
  warehouses?: WarehouseType[];
}

type ReportType = 'period' | 'warehouses' | 'suppliers' | 'regions' | 'managers' | 'turnover' | 'last_deliveries' | null;

export default function ReportsView({
  suppliers,
  orders,
  users = [],
  cities = [],
  districts = [],
  warehouses = [],
}: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);

  // Render the matching report screen
  if (selectedReport === 'period') {
    return (
      <OrdersByPeriod
        suppliers={suppliers}
        orders={orders}
        users={users}
        cities={cities}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'warehouses') {
    return (
      <OrdersByWarehouse
        suppliers={suppliers}
        orders={orders}
        users={users}
        cities={cities}
        warehouses={warehouses}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'suppliers') {
    return (
      <DeliveredOrdersBySuppliers
        suppliers={suppliers}
        orders={orders}
        users={users}
        cities={cities}
        districts={districts}
        warehouses={warehouses}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'regions') {
    return (
      <DeliveredOrdersByRegions
        suppliers={suppliers}
        orders={orders}
        cities={cities}
        districts={districts}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'managers') {
    return (
      <DeliveredOrdersByManagers
        suppliers={suppliers}
        orders={orders}
        users={users}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'turnover') {
    return (
      <TanksTurnoverBySuppliers
        suppliers={suppliers}
        orders={orders}
        users={users}
        cities={cities}
        districts={districts}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  if (selectedReport === 'last_deliveries') {
    return (
      <LastDeliveries
        suppliers={suppliers}
        orders={orders}
        users={users}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  // Cards Configuration
  const reportCards = [
    {
      id: 'period' as const,
      title: 'Orders by Period',
      description: 'Review orders by custom period with factual pickup quantities, city, and manager breakdown.',
      icon: CalendarRange,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-100',
      badge: 'Period Analysis',
    },
    {
      id: 'suppliers' as const,
      title: 'Delivered Orders by Suppliers',
      description: 'Review total liters, visit counts, and total cost aggregated per individual commercial supplier.',
      icon: Truck,
      color: 'bg-teal-50 text-teal-800 border-teal-100',
      badge: 'Supplier Insights',
    },
    {
      id: 'warehouses' as const,
      title: 'Orders by Warehouses',
      description: 'Review orders and factual collected volumes segregated by storage warehouses and locations.',
      icon: Warehouse,
      color: 'bg-cyan-50 text-cyan-800 border-cyan-100',
      badge: 'Warehouse Audit',
    },
    {
      id: 'managers' as const,
      title: 'Delivered Orders by Managers',
      description: 'Measure manager performance in servicing accounts, visit coordinates, and total values.',
      icon: Users,
      color: 'bg-sky-50 text-sky-800 border-sky-100',
      badge: 'Staff Ledger',
    },
    {
      id: 'regions' as const,
      title: 'Delivered Orders by Regions',
      description: 'Analyze localized biodiesel feedstock collections by regional city and municipality districts.',
      icon: MapPin,
      color: 'bg-indigo-50 text-indigo-800 border-indigo-100',
      badge: 'Geographic Analysis',
    },
    {
      id: 'turnover' as const,
      title: 'Tanks Turnover by Suppliers',
      description: 'Audit dropoff ledger operations, initial container balance, filled count, and final storage balance.',
      icon: RefreshCw,
      color: 'bg-amber-50 text-amber-800 border-amber-100',
      badge: 'Logistics Turnover',
    },
    {
      id: 'last_deliveries' as const,
      title: 'Last Deliveries Tracker',
      description: 'Monitor temporal intervals and safety alert coordinates since the final commercial delivery date.',
      icon: Clock,
      color: 'bg-rose-50 text-rose-800 border-rose-100',
      badge: 'Activity History',
    },
  ];

  return (
    <div className="space-y-6">
      {/* CENTRALIZED PAGE HEADER */}
      <PageHeader
        title={t("Reports")}
      />

      {/* RE-ARCHITECTED INTERACTIVE REPORT DIRECTORY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => setSelectedReport(card.id)}
              className="group relative flex flex-col p-6 bg-white border border-gray-200 hover:border-emerald-500 rounded-2xl text-left transition cursor-pointer select-none shadow-xs"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* Styled Icon Wrapper */}
                  <div className={`p-3 rounded-xl border ${card.color}`}>
                    <Icon size={20} className="font-bold" />
                  </div>
                  {/* Category Badge */}
                  <span className="text-[9px] font-extrabold uppercase font-sans tracking-wider bg-slate-100 text-gray-500 px-2.5 py-1 rounded-md">
                    {t(card.badge)}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-gray-900 group-hover:text-emerald-800 transition-colors font-sans leading-tight">
                    {t(card.title)}
                  </h3>
                  <p className="text-xs text-gray-500 leading-normal font-normal">
                    {t(card.description)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
