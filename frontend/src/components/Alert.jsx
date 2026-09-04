import React from 'react';

const STYLES = {
  success: 'bg-green-50 border-green-400 text-green-800',
  error:   'bg-red-50   border-red-400   text-red-800',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  info:    'bg-blue-50  border-blue-400  text-blue-800',
};

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

export default function Alert({ type = 'info', message, onClose }) {
  if (!message) return null;
  return (
    <div className={`flex items-start gap-3 border-l-4 rounded-lg p-4 mb-4 ${STYLES[type]}`} role="alert">
      <span className="text-lg leading-none">{ICONS[type]}</span>
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-70 hover:opacity-100 font-bold text-lg leading-none">&times;</button>
      )}
    </div>
  );
}
