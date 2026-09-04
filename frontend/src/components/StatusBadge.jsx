import React from 'react';

const MAP = {
  ACTIVE:          'badge-active',
  LOCKED:          'badge-locked',
  CLOSED:          'badge-closed',
  WITHDRAWN:       'badge-closed',
  COMPLETED:       'badge-completed',
  CONFIRMED:       'badge-locked',
  FARMER_CONFIRMED:'badge-locked',
  BUYER_CONFIRMED: 'badge-locked',
  DISPUTED:        'badge-disputed',
  FLAGGED:         'badge-disputed',
  CANCELLED:       'badge-closed',
  PENDING:         'badge-pending',
  ACCEPTED:        'badge-completed',
  REJECTED:        'badge-disputed',
  COUNTERED:       'badge-pending',
  OPEN:            'badge-disputed',
  UNDER_REVIEW:    'badge-pending',
  RESOLVED:        'badge-completed',
  VERIFIED:        'badge-completed',
};

export default function StatusBadge({ status }) {
  const cls = MAP[status] || 'badge-pending';
  return <span className={cls}>{status?.replace(/_/g, ' ')}</span>;
}
