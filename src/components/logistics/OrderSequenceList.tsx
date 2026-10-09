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
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  getVendorInfo: (order: Order) => VendorDisplayInfo;
  handleSwap: (fromIndex: number, toIndex: number) => void;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleGripPointerDown: (e: React.PointerEvent, index: number) => void;
  handleGripPointerMove: (e: React.PointerEvent) => void;
  handleGripPointerUp: (e: React.PointerEvent) => void;
  handleGripPointerCancel: (e: React.PointerEvent) => void;
  handleTouchStart: (e: React.TouchEvent, index: number) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTouchCancel: () => void;
}

export const OrderSequenceList: React.FC<OrderSequenceListProps> = ({
  items,
  draggedIndex,
  touchActiveIndex,
  insertionIndex,
  listContainerRef,
  getVendorInfo,
  handleSwap,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleGripPointerDown,
  handleGripPointerMove,
  handleGripPointerUp,
  handleGripPointerCancel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleTouchCancel
}) => {
  const activeDragIdx = touchActiveIndex !== null ? touchActiveIndex : draggedIndex;

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

            return (
              <React.Fragment key={order.id}>
                <OrderSequenceItem
                  order={order}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  isDragging={isDragging}
                  isTouchActive={isTouchActive}
                  info={info}
                  onSwap={handleSwap}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onPointerDown={handleGripPointerDown}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={handleGripPointerUp}
                  onPointerCancel={handleGripPointerCancel}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
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
