import { useRef, useCallback } from 'react';

interface SimpleSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDragStart?: () => void;
  onDragMove?: (deltaX: number, deltaY: number) => void;
  onDragEnd?: () => void;
}

export const useSimpleSwipeGestures = (handlers: SimpleSwipeHandlers) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);
  const minSwipeDistance = 30; // Reduced from 50 for more responsive swipes
  const maxSwipeTime = 1000; // Maximum time for a swipe to be considered valid
  const dragThreshold = 5; // Reduced from 10 for more responsive drag start

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    
    isDraggingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (!isDraggingRef.current && distance > dragThreshold) {
      isDraggingRef.current = true;
      handlers.onDragStart?.();
    }

    if (isDraggingRef.current) {
      handlers.onDragMove?.(deltaX, deltaY);
    }
  }, [handlers, dragThreshold]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    if (isDraggingRef.current) {
      handlers.onDragEnd?.();
    }

    const deltaX = touchStartRef.current.x - touchEnd.x;
    const deltaY = touchStartRef.current.y - touchEnd.y;
    const deltaTime = touchEnd.time - touchStartRef.current.time;

    // Check if the swipe was fast enough and significant enough
    if (deltaTime <= maxSwipeTime) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Determine swipe direction based on the dominant axis
      if (absX > absY && absX > minSwipeDistance) {
        // Horizontal swipe
        if (deltaX > 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        } else if (deltaX < 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        }
      } else if (absY > absX && absY > minSwipeDistance) {
        // Vertical swipe
        if (deltaY > 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        } else if (deltaY < 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        }
      }
    }

    touchStartRef.current = null;
    isDraggingRef.current = false;
  }, [handlers, minSwipeDistance, maxSwipeTime]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
