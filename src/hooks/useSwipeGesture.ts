"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SwipeGestureConfig {
  onSwipeLeft?: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface SwipeGestureReturn {
  offset: number;
  isSwiping: boolean;
  hasSwiped: boolean;
  resetHasSwiped: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };
}

const SWIPE_START_THRESHOLD = 10;

/**
 * Custom hook for handling swipe gestures on elements
 * Extracted from TransactionCard swipe logic
 *
 * @param config Configuration for swipe behavior
 * @returns Object containing offset, isSwiping state, and event handlers
 */
export function useSwipeGesture(config: SwipeGestureConfig): SwipeGestureReturn {
  const { onSwipeLeft, threshold = 80, disabled = false } = config;

  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const currentOffset = useRef(0);
  const hasSwipedRef = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      touchStartX.current = clientX;
      setIsSwiping(true);
      hasSwipedRef.current = false;
    },
    [disabled]
  );

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (disabled || touchStartX.current === null) return;

      const diff = clientX - touchStartX.current;

      if (Math.abs(diff) > SWIPE_START_THRESHOLD) {
        hasSwipedRef.current = true;
      }

      const newOffset = Math.max(-150, Math.min(0, diff));
      currentOffset.current = newOffset;
      setOffset(newOffset);
    },
    [disabled]
  );

  const handleDragEnd = useCallback(() => {
    if (disabled) return;

    setIsSwiping(false);
    touchStartX.current = null;

    if (currentOffset.current <= -threshold && onSwipeLeft) {
      onSwipeLeft();
    }

    setOffset(0);
    currentOffset.current = 0;
  }, [disabled, threshold, onSwipeLeft]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      handleDragStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleDragMove(e.touches[0].clientX);
      if (hasSwipedRef.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleDragStart, handleDragMove, handleDragEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleDragStart(e.clientX);
    },
    [handleDragStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleDragMove(e.clientX);
    },
    [handleDragMove]
  );

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isSwiping) {
      handleDragEnd();
    }
  }, [isSwiping, handleDragEnd]);

  const resetHasSwiped = useCallback(() => {
    hasSwipedRef.current = false;
  }, []);

  return {
    offset,
    isSwiping,
    hasSwiped: hasSwipedRef.current,
    resetHasSwiped,
    ref: elementRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
}
