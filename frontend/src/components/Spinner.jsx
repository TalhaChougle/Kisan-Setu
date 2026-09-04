import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${sizes[size]}`} />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center items-center min-h-[300px]">
      <Spinner size="lg" />
    </div>
  );
}
