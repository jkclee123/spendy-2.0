"use client";

import { useState, useRef, useCallback } from "react";
import { GripVertical } from "lucide-react";

interface DraggableListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (newOrder: T[]) => void;
  disabled?: boolean;
}

/**
 * List component with drag-to-reorder functionality
 * - Supports touch and mouse drag (only via handle)
 * - Provides visual feedback during drag
 * - Calls onReorder on drop with new array order
 */
export function DraggableList<T>({
  items,
  keyExtractor,
  renderItem,
  onReorder,
  disabled = false,
}: DraggableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<HTMLDivElement | null>(null);
  const isDraggingFromHandle = useRef(false);

  // Mouse drag handlers - only from handle
  const handleHandleMouseDown = useCallback(
    (index: number) => {
      if (disabled) return;
      isDraggingFromHandle.current = true;
      setDraggedIndex(index);
    },
    [disabled]
  );

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;
    // Only allow drag if initiated from handle
    if (!isDraggingFromHandle.current) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);

    // Set drag image to the entire row
    const rowElement = e.currentTarget;
    if (rowElement) {
      e.dataTransfer.setDragImage(rowElement, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();

    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (disabled || draggedIndex === null) return;

    if (dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newItems = [...items];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(dragOverIndex, 0, removed);
      onReorder(newItems);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    isDraggingFromHandle.current = false;
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Touch event support - only from handle
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const isTouchDragging = useRef(false);

  const handleHandleTouchStart = useCallback(
    (e: React.TouchEvent, index: number) => {
      if (disabled) return;
      e.stopPropagation();
      isTouchDragging.current = true;
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || draggedIndex === null || touchStartY === null || !isTouchDragging.current)
        return;

      // Calculate which item we're over
      const element = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);

      const listItem = element?.closest("[data-draggable-item]");
      if (listItem) {
        const overIndex = parseInt(listItem.getAttribute("data-index") || "0", 10);
        setDragOverIndex(overIndex);
      }
    },
    [disabled, draggedIndex, touchStartY]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || draggedIndex === null || !isTouchDragging.current) return;

    if (dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newItems = [...items];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(dragOverIndex, 0, removed);
      onReorder(newItems);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartY(null);
    isTouchDragging.current = false;
  }, [disabled, draggedIndex, dragOverIndex, items, onReorder]);

  return (
    <div className="space-y-2" role="list" aria-label="Reorderable list">
      <p id="drag-instructions" className="sr-only">
        Use arrow keys to reorder items when focused on the drag handle
      </p>
      {items.map((item, index) => {
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={keyExtractor(item)}
            data-draggable-item
            data-index={index}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={isDragging ? dragItemRef : null}
            className={`
              flex items-center gap-3 transition-all duration-200
              ${isDragging ? "opacity-50" : "opacity-100"}
              ${isDragOver && !isDragging ? "translate-y-1" : ""}
            `}
          >
            {/* Drag handle - only this triggers dragging */}
            {!disabled && (
              <div
                role="button"
                tabIndex={0}
                aria-label={`Drag to reorder item ${index + 1}`}
                aria-describedby="drag-instructions"
                className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 touch-none focus:outline-none rounded"
                onMouseDown={() => handleHandleMouseDown(index)}
                onTouchStart={(e) => handleHandleTouchStart(e, index)}
                onKeyDown={(e) => {
                  // Allow keyboard reordering with arrow keys
                  if (e.key === "ArrowUp" && index > 0) {
                    e.preventDefault();
                    const newItems = [...items];
                    const [removed] = newItems.splice(index, 1);
                    newItems.splice(index - 1, 0, removed);
                    onReorder(newItems);
                  } else if (e.key === "ArrowDown" && index < items.length - 1) {
                    e.preventDefault();
                    const newItems = [...items];
                    const [removed] = newItems.splice(index, 1);
                    newItems.splice(index + 1, 0, removed);
                    onReorder(newItems);
                  }
                }}
              >
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </div>
            )}

            {/* Item content */}
            <div className="flex-1">{renderItem(item, index)}</div>
          </div>
        );
      })}
    </div>
  );
}
