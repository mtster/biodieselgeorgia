import React from 'react';
import { Order } from '../../types';
import { VendorDisplayInfo } from './types';
import { OrderSequenceItem } from './OrderSequenceItem';
import { DropIndicatorLine } from './DropIndicatorLine';

interface OrderSequenceListProps {
  items: Order[];
  draggedIndex: number | null;
  touchActiveIndex: number | null;
  insertionIndex: number | null;
  newOrderIds?: string[] | Set<string>;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  getVendorInfo: (order: Order) => VendorDisplayInfo;
  handleSwap: (fromIndex: number, toIndex: number) => void;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleGripPointerDown: (e: React.PointerEvent, index: number) => void;
}

export const OrderSequenceList: React.FC<OrderSequenceListProps> = ({
  items,
  draggedIndex,
  touchActiveIndex,
  insertionIndex,
  newOrderIds,
  listContainerRef,
  getVendorInfo,
  handleSwap,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleGripPointerDown
}) => {
  const activeDragIdx = touchActiveIndex !== null ? touchActiveIndex : draggedIndex;

  const isOrderNew = (orderId: string): boolean => {
    if (!newOrderIds) return false;
    if (newOrderIds instanceof Set) return newOrderIds.has(orderId);
    return Array.isArray(newOrderIds) && newOrderIds.includes(orderId);
  };

  return (
    <div
      ref={listContainerRef}
      className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-2.5"
    >
      {items.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-slate-500 text-xs font-medium mt-4">
          დღევანდელი დღისთვის ამ მანქანაზე აქტიური შეკვეთები არ მოიძებნა.
        </div>
      ) : (
        <>
          {/* Top insertion line indicator (gap 0, before first order) */}
          <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === 0} />

          {items.map((order, idx) => {
            const info = getVendorInfo(order);
            const isDragging = draggedIndex === idx;
            const isTouchActive = touchActiveIndex === idx;
            const isNew = isOrderNew(order.id);

            return (
              <React.Fragment key={order.id}>
                <OrderSequenceItem
                  order={order}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  isDragging={isDragging}
                  isTouchActive={isTouchActive}
                  isNew={isNew}
                  info={info}
                  onSwap={handleSwap}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onPointerDown={handleGripPointerDown}
                />
                {/* Insertion line indicator below this order (gap idx + 1) */}
                <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === idx + 1} />
              </React.Fragment>
            );
          })}
        </>
      )}
    </div>
  );
};
