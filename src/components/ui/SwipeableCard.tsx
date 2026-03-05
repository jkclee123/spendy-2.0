"use client";

import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { Trash2, CheckCircle } from "lucide-react";

interface SwipeableCardProps {
  children: React.ReactNode;
  // Single action props (left-swipe only)
  onSwipeAction?: () => void;
  actionLabel?: string;
  actionColor?: "red" | "yellow" | "blue" | "green";
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Reusable card component with swipe-to-action gesture
 * - Swipe left reveals action button
 * - Swipe past threshold triggers onSwipeAction
 * - Right-swipe is disabled (no effect)
 * - Extracted from TransactionCard logic
 */
export function SwipeableCard({
  children,
  onSwipeAction,
  actionLabel = "Delete",
  actionColor = "red",
  onClick,
  disabled = false,
}: SwipeableCardProps) {
  const { offset, isSwiping, hasSwiped, resetHasSwiped, ref, handlers } = useSwipeGesture({
    onSwipeLeft: onSwipeAction,
    threshold: 80,
    disabled,
  });

  const colorClasses = {
    red: "bg-red-500 dark:bg-red-500/80",
    yellow: "bg-yellow-500 dark:bg-yellow-600/80",
    blue: "bg-blue-500 dark:bg-blue-600/80",
    green: "bg-green-500 dark:bg-green-600/80",
  };

  const isLeftActionVisible = offset <= -40;
  const leftActionOpacity = Math.min(1, Math.abs(offset) / 40);

  const handleClick = () => {
    // Prevent click if we just performed a swipe
    if (hasSwiped) {
      resetHasSwiped();
      return;
    }

    if (!isSwiping && offset === 0 && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Build accessible description for swipe action
  const swipeDescription = onSwipeAction ? `Swipe left to ${actionLabel.toLowerCase()}` : undefined;

  return (
    <div className="relative overflow-hidden" aria-label={swipeDescription || undefined}>
      {/* Left action background layer (swipe left reveals right side) */}
      {onSwipeAction && (
        <div
          className={`
            absolute inset-0 flex items-center justify-end rounded-xl
            ${colorClasses[actionColor]} px-4 transition-opacity duration-200
            ${isLeftActionVisible ? "opacity-100" : "opacity-0"}
          `}
          aria-hidden="true"
        >
          <div
            className="flex items-center gap-2 text-gray-100"
            style={{ opacity: leftActionOpacity }}
          >
            {actionColor === "blue" || actionColor === "green" ? (
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Trash2 className="h-6 w-6" aria-hidden="true" />
            )}
            <span className="font-medium">{actionLabel}</span>
          </div>
        </div>
      )}

      {/* Card content layer */}
      <div
        ref={ref}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick ? handleClick : undefined}
        onKeyDown={onClick ? handleKeyDown : undefined}
        {...handlers}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isSwiping ? "none" : "transform 0.3s ease-out",
        }}
        className={`
          relative flex min-h-[72px] select-none items-center justify-between rounded-xl 
          border border-gray-400 bg-white p-4
          dark:border-gray-500 dark:bg-gray-800
          ${
            onClick && offset === 0
              ? "cursor-pointer hover:border-black dark:hover:border-gray-400 hover:shadow-sm focus:outline-none"
              : ""
          }
          ${isSwiping ? "cursor-grabbing" : ""}
        `}
      >
        {children}
      </div>
    </div>
  );
}
