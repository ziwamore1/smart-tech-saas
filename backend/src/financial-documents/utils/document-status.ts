export function quotationEffectiveStatus(q: {
  status: string;
  validUntil?: Date | null;
}): string {
  if ((q.status === 'ISSUED' || q.status === 'SENT') && q.validUntil && new Date(q.validUntil).getTime() < Date.now()) {
    return 'EXPIRED';
  }
  return q.status;
}

export function invoiceEffectiveStatus(inv: {
  status: string;
  dueDate?: Date | null;
}): string {
  if (
    (inv.status === 'ISSUED' || inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') &&
    inv.dueDate &&
    new Date(inv.dueDate).getTime() < Date.now()
  ) {
    return 'OVERDUE';
  }
  return inv.status;
}