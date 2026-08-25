import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export default function BrandMark({ size = 26, className = '' }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
      <path d="M4 16.5 10.2 23c1.9 2 5.1 1.8 6.7-.5L24.8 7" stroke="#16B9B8" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 9 6.2 7.2" stroke="#56D9A7" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
