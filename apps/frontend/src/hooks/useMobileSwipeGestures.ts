import { useRef, useState, useCallback, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, config } from '@react-spring/web';

interface MobileSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface MobileSwipeGesturesResult {
  // Combined gesture for all mobile interactions
  mobileGesture: (...args: any[]) => any;
  drawerStyle: {
    y: any;
    display: any;
  };
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  
  // Swipe left/right gesture for article navigation
  storyStyle: {
    x: any;
    scale: any;
    opacity: any;
  };
}

export const useMobileSwipeGestures = (
  handlers: MobileSwipeHandlers,
  drawerHeight: number = 300
): MobileSwipeGesturesResult => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  console.log('Hook render - isDrawerOpen:', isDrawerOpen);
  
  // Description drawer animation (swipe up/down)
  const [{ y }, drawerApi] = useSpring(() => ({ 
    y: drawerHeight,
    config: config.stiff
  }));

  // Story navigation animation (swipe left/right)
  const [{ x, scale, opacity }, storyApi] = useSpring(() => ({ 
    x: 0,
    scale: 1,
    opacity: 1,
    config: config.wobbly
  }));

  // Monitor state changes
  useEffect(() => {
    console.log('🔄 isDrawerOpen changed to:', isDrawerOpen);
  }, [isDrawerOpen]);

  const openDrawer = useCallback(() => {
    console.log('OpenDrawer called - setting state to true and animating to y: 0');
    setIsDrawerOpen(true);
    drawerApi.start({
      y: 0,
      immediate: false,
      config: config.stiff,
      onRest: () => {
        console.log('Open animation completed, final y should be 0');
      }
    });
  }, [drawerApi]);

  const closeDrawer = useCallback((velocity = 0) => {
    console.log('CloseDrawer called - setting state to false and animating to y:', drawerHeight);
    setIsDrawerOpen(false);
    drawerApi.start({
      y: drawerHeight,
      immediate: false,
      config: { ...config.stiff, velocity },
      onRest: () => {
        console.log('Close animation completed, final y should be', drawerHeight);
      }
    });
  }, [drawerApi, drawerHeight]);

  // Combined mobile gesture that handles both horizontal and vertical swipes
  const closeDragAllowedRef = useRef(false);
  const openLockUntilRef = useRef(0);

  const mobileGesture = useDrag(
    ({ first, last, event, velocity: [vx, vy], direction: [dx, dy], offset: [ox, oy], movement: [mx, my], cancel }) => {
      // Track whether close-drag is allowed (must start from handle when open)
      if (first) {
        try {
          const target = event?.target as HTMLElement | null;
          closeDragAllowedRef.current = !!(target && target.closest('[data-drawer-handle="true"]'));
        } catch {
          closeDragAllowedRef.current = false;
        }
      }
      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      
      console.log('Gesture state:', { absX, absY, last, isDrawerOpen, my, vy });
      
      // Determine if this is primarily horizontal or vertical movement
      // Made conditions less restrictive and more independent
      if (absX > 30 && (absX > absY * 1.5 || absX > 60)) {
        // Horizontal swipe - story navigation (prioritize when clearly horizontal)
        const width = window.innerWidth;
        const threshold = width / 3;
        
        if (last) {
          if (absX > threshold) {
            // Trigger navigation
            const direction = dx > 0 ? 'right' : 'left';
            
            storyApi.start({
              x: direction === 'left' ? -width * 1.2 : width * 1.2,
              scale: 0.8,
              opacity: 0.3,
              config: config.wobbly,
              onRest: () => {
                if (direction === 'left') {
                  handlers.onSwipeLeft?.();
                } else {
                  handlers.onSwipeRight?.();
                }
                storyApi.set({ x: 0, scale: 1, opacity: 1 });
              }
            });
          } else {
            // Reset position
            storyApi.start({ x: 0, scale: 1, opacity: 1, config: config.wobbly });
          }
        } else {
          // Follow the gesture for horizontal movement
          const resistance = 0.6;
          const dragDistance = Math.abs(mx);
          const maxDrag = width * 0.8;
          const scaleReduction = Math.min(dragDistance / maxDrag * 0.2, 0.2);
          const opacityReduction = Math.min(dragDistance / maxDrag * 0.4, 0.4);
          
          storyApi.start({
            x: mx * resistance,
            scale: 1 - scaleReduction,
            opacity: 1 - opacityReduction,
            immediate: true
          });
        }
      } else if (absY > 25) {
        // Vertical swipe - drawer control (increased threshold for more resistance)
        console.log('Vertical gesture detected:', { absY, my, isDrawerOpen, last });
        
        if (!isDrawerOpen) {
          // Opening gesture - swipe up (my is negative)
          if (!last) {
            // Smooth rubber banding effect during drag
            const swipeDistance = Math.max(0, -my);
            const progress = Math.min(swipeDistance / drawerHeight, 0.8); // Max 80% preview
            const newY = drawerHeight * (1 - progress);
            
            drawerApi.start({ 
              y: newY, 
              immediate: true 
            });
          } else {
            // Decision time - should we open?
            const swipeDistance = -my; // positive when dragging up
            // Require upward intent (dy < 0). Be more forgiving on distance and velocity.
            const upwardIntent = dy < 0;
            const distanceOK = swipeDistance > drawerHeight * 0.15; // lowered threshold to 15%
            const velocityOK = vy > 0.35; // slightly lower velocity threshold
            const shouldOpen = upwardIntent && (distanceOK || velocityOK);
            
            console.log('Opening decision:', { 
              swipeDistance, 
              shouldOpen, 
              threshold: drawerHeight * 0.25,
              velocity: vy,
              direction: dy 
            });
            
            if (shouldOpen) {
              console.log('✅ Opening drawer! State before:', isDrawerOpen, 'timestamp:', Date.now());
              // Cancel current gesture to avoid any trailing close
              try { cancel?.(); } catch {}
              openLockUntilRef.current = Date.now() + 250; // lock against immediate close for 250ms
              openDrawer();
              handlers.onSwipeUp?.();
              
              // Prevent any further gesture processing
              setTimeout(() => {
                console.log('🔒 State after opening timeout:', isDrawerOpen);
              }, 100);
            } else {
              console.log('❌ Not opening, closing instead');
              closeDrawer(Math.abs(vy));
            }
          }
        } else {
          // Closing gesture - swipe down (my is positive) - only when drawer is open
          // Require drag to start from the drawer handle; otherwise ignore vertical drags
          if (!closeDragAllowedRef.current) {
            if (last) openDrawer();
            return;
          }
          if (!last) {
            if (Date.now() < openLockUntilRef.current) return; // ignore early close attempts
            const newY = Math.max(0, Math.min(drawerHeight * 0.6, my)); // Limit drag distance
            drawerApi.start({ y: newY, immediate: true });
          } else {
            if (Date.now() < openLockUntilRef.current) { openDrawer(); return; }
            // Require intentional downward swipe to close
            const shouldClose = (my > drawerHeight * 0.45) || (my > drawerHeight * 0.25 && vy > 0.7 && dy > 0);
            console.log('Closing decision:', { my, shouldClose, thresholds: { hard: drawerHeight * 0.45, soft: drawerHeight * 0.25 }, vy, dy });
            
            if (shouldClose) {
              console.log('Closing drawer!');
              closeDrawer(vy);
              handlers.onSwipeDown?.();
            } else {
              console.log('Not closing, staying open');
              // Snap back to open position if not closing
              openDrawer();
            }
          }
        }
      }
    },
    { 
      from: () => [0, isDrawerOpen ? 0 : drawerHeight], 
      filterTaps: true, 
      bounds: { top: -drawerHeight * 1.2, bottom: drawerHeight * 0.8, left: -window.innerWidth, right: window.innerWidth }, 
      rubberband: 0.6 // More flexible rubber banding
    }
  );

  return {
    mobileGesture,
    drawerStyle: {
      y,
      display: y.to((py) => (py < drawerHeight ? 'block' : 'none'))
    },
    isDrawerOpen: isDrawerOpen,
    openDrawer,
    closeDrawer,
    storyStyle: {
      x,
      scale,
      opacity
    }
  };
};
