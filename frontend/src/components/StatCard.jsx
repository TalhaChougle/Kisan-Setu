import React from 'react';

export default function StatCard({ label, value, icon, color = 'brand', sub }) {
  const colors = {
    brand:   'bg-brand-50   text-brand-700   border-brand-200',
    orange:  'bg-orange-50  text-orange-700  border-orange-200',
    blue:    'bg-blue-50    text-blue-700    border-blue-200',
    red:     'bg-red-50     text-red-700     border-red-200',
    purple:  'bg-purple-50  text-purple-700  border-purple-200',
    yellow:  'bg-yellow-50  text-yellow-700  border-yellow-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.brand}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-80">{label}</p>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}
