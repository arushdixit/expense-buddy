import React, { useState, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useSync } from "@/context/SyncContext";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  const { triggerSync } = useSync();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pullThreshold = 70; // px

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].screenY;
      isDragging.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;

    const currentY = e.touches[0].screenY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Pull down: resistance factor
      const distance = Math.min(diff * 0.4, 120);
      setPullDistance(distance);
      
      if (distance > 10 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold);
      try {
        await triggerSync();
      } catch (error) {
        console.error("Sync failed:", error);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 600);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-y-auto h-full w-full select-none"
    >
      {/* Pull Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-200 z-50"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? 1 : 0,
          transform: `translateY(${Math.min(pullDistance - 40, 0)}px)`,
        }}
      >
        <div className="bg-card shadow-md border border-border/40 p-2.5 rounded-full flex items-center justify-center text-primary">
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <RefreshCw
              className="h-4 w-4 text-primary transition-transform"
              style={{ transform: `rotate(${pullDistance * 4}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Main Content wrapper with translate shift */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? 40 : pullDistance * 0.5}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)",
        }}
        className="h-full w-full"
      >
        {children}
      </div>
    </div>
  );
};
