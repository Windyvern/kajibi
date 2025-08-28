import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

// Lightweight glassmorphism wrapper to mimic a "liquid glass" feel
// without adding a React 19-only dependency. Easy to remove later.
export default function LiquidGlass({ children, className }: Props) {
  return (
    <div className={`liquid-glass ${className || ''}`}>
      {children}
    </div>
  );
}
