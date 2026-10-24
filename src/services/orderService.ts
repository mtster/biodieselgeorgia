/**
 * Order Service
 * Modularized into focused sub-modules:
 * - ./orders/orderUtils.ts (types, dates, helpers, keys)
 * - ./orders/orderQueries.ts (paginated and filtered fetching)
 * - ./orders/orderMutations.ts (save, delete, route rank updates, RPCs)
 */

export {
  KEY_ORDERS,
  isDateTodayTbilisi,
  checkIsLogisticsManager,
  isValidUuid,
  type PaginatedOrdersResult
} from './orders/orderUtils';

export {
  getOrdersPaginated,
  getActiveOrdersCount,
  getOrders,
  getSMSLogs
} from './orders/orderQueries';

export {
  saveOrder,
  deleteOrder,
  batchAssignCrewToOrders,
  batchUnassignCrewFromOrders,
  batchDeleteOrders,
  updateOrdersRouteRanks,
  createDatabaseOrderColumn,
  type BatchAssignCrewParams
} from './orders/orderMutations';
