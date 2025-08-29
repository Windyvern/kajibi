import { useSpring, SpringValue } from 'react-spring';
import { useDrag } from '@use-gesture/react';
import { useCallback, useRef } from 'react';

interface SwipeAnimationHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeAnimationResult {
  bind: (...args: any[]) => any;
  style: {
    x: SpringValue<number>;
    y: SpringValue<number>;
    rotateZ: SpringValue<number>;
    scale: SpringValue<number>;
    opacity: SpringValue<number>;
  };
}

export const useSwipeAnimation = (handlers: SwipeAnimationHandlers): SwipeAnimationResult => {
  const swipeThreshold = 100; // Distance needed to trigger swipe
  const velocityThreshold = 0.5; // Velocity needed for quick swipes
  const isSwipingRef = useRef(false);
  
  const [{ x, y, rotateZ, scale, opacity }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotateZ: 0,
    scale: 1,
    opacity: 1,
    config: { tension: 300, friction: 30 }
  }));

  const resetAnimation = useCallback(() => {
    api.start({
      x: 0,
      y: 0,
      rotateZ: 0,
      scale: 1,
      opacity: 1,
      config: { tension: 300, friction: 30 }
    });
  }, [api]);

  const triggerSwipeAnimation = useCallback((direction: 'left' | 'right' | 'up' | 'down', callback?: () => void) => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let targetX = 0, targetY = 0, targetRotation = 0;
    
    switch (direction) {
      case 'left':
        targetX = -windowWidth * 1.5;
        targetRotation = -30;
        break;
      case 'right':
        targetX = windowWidth * 1.5;
        targetRotation = 30;
        break;
      case 'up':
        targetY = -windowHeight * 1.5;
        break;
      case 'down':
        targetY = windowHeight * 1.5;
        break;
    }
    
    api.start({
      x: targetX,
      y: targetY,
      rotateZ: targetRotation,
      scale: 0.8,
      opacity: 0,
      config: { tension: 200, friction: 20 },
      onRest: () => {
        // Reset position immediately after animation completes
        api.set({ x: 0, y: 0, rotateZ: 0, scale: 1, opacity: 1 });
        if (callback) callback();
      }
    });
  }, [api]);

  const bind = useDrag(
    ({ 
      offset: [dx, dy], 
      velocity: [vx, vy], 
      direction: [dirX, dirY], 
      down,
      movement: [mx, my],
      cancel
    }) => {
      if (!down) {
        isSwipingRef.current = false;
        
        // Determine if this was a swipe based on distance and velocity
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const absVx = Math.abs(vx);
        const absVy = Math.abs(vy);
        
        // Check for horizontal swipe
        if ((absX > swipeThreshold || absVx > velocityThreshold) && absX > absY) {
          if (dx > 0 && handlers.onSwipeRight) {
            triggerSwipeAnimation('right', handlers.onSwipeRight);
            return;
          } else if (dx < 0 && handlers.onSwipeLeft) {
            triggerSwipeAnimation('left', handlers.onSwipeLeft);
            return;
          }
        }
        
        // Check for vertical swipe
        if ((absY > swipeThreshold || absVy > velocityThreshold) && absY > absX) {
          if (dy < 0 && handlers.onSwipeUp) {
            triggerSwipeAnimation('up', handlers.onSwipeUp);
            return;
          } else if (dy > 0 && handlers.onSwipeDown) {
            triggerSwipeAnimation('down', handlers.onSwipeDown);
            return;
          }
        }
        
        // If no swipe was triggered, reset to center
        resetAnimation();
      } else {
        // During drag, follow the gesture with some resistance
        isSwipingRef.current = true;
        const resistance = 0.6;
        const maxRotation = 15;
        
        // Calculate rotation based on horizontal movement
        const rotation = (dx / window.innerWidth) * maxRotation * resistance;
        
        // Apply some scaling when dragging far
        const dragDistance = Math.sqrt(dx * dx + dy * dy);
        const maxDragDistance = Math.min(window.innerWidth, window.innerHeight) * 0.5;
        const scaleReduction = Math.min(dragDistance / maxDragDistance * 0.1, 0.1);
        
        api.start({
          x: dx * resistance,
          y: dy * resistance,
          rotateZ: rotation,
          scale: 1 - scaleReduction,
          opacity: 1 - (dragDistance / maxDragDistance) * 0.3,
          immediate: true
        });
      }
    },
    {
      axis: undefined, // Allow both horizontal and vertical
      bounds: { 
        left: -window.innerWidth, 
        right: window.innerWidth,
        top: -window.innerHeight,
        bottom: window.innerHeight
      },
      rubberband: true,
      filterTaps: true,
      threshold: 10
    }
  );

  return {
    bind,
    style: { x, y, rotateZ, scale, opacity }
  };
};
