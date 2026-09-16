import { FinancialTaxPricingMode } from '@prisma/client';
import { roundMoney } from './amount-in-words';

export interface CalcItemInput {
  itemName?: string | null;
  description?: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount?: number;
  taxRate?: number | null;
}

export interface CalcItemResult {
  itemName?: string | null;
  description?: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount: number;
  taxRate: number | null;
  taxAmount: number;
  subtotal: number;
  lineTotal: number;
  sortOrder: number;
}

export interface TotalsResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number | null;
}

export function computeItems(
  items: CalcItemInput[],
  globalTaxRate: number | null | undefined,
  pricingMode: FinancialTaxPricingMode = FinancialTaxPricingMode.EXCLUSIVE,
): { items: CalcItemResult[]; totals: TotalsResult } {
  const baseRate = globalTaxRate ?? 0;
  const lineResults: CalcItemResult[] = (items || []).map((raw, index) => {
    const quantity = Number.isFinite(raw.quantity) ? raw.quantity : 1;
    const unitPrice = Number.isFinite(raw.unitPrice) ? raw.unitPrice : 0;
    const discount = Number.isFinite(raw.discount) ? raw.discount : 0;
    const rate = raw.taxRate != null ? raw.taxRate : baseRate;
    const subtotal = roundMoney(quantity * unitPrice);
    const netBeforeTax = roundMoney(subtotal - discount);
    let taxAmount = 0;
    let lineTotal: number;
    if (rate > 0) {
      if (pricingMode === FinancialTaxPricingMode.INCLUSIVE) {
        taxAmount = roundMoney(netBeforeTax - netBeforeTax / (1 + rate / 100));
        lineTotal = netBeforeTax;
      } else {
        taxAmount = roundMoney((netBeforeTax * rate) / 100);
        lineTotal = roundMoney(netBeforeTax + taxAmount);
      }
    } else {
      lineTotal = netBeforeTax;
    }
    return {
      itemName: raw.itemName,
      description: raw.description ?? raw.itemName ?? '',
      quantity,
      unit: raw.unit,
      unitPrice,
      discount,
      taxRate: rate > 0 ? rate : null,
      taxAmount,
      subtotal,
      lineTotal,
      sortOrder: index,
    };
  });

  const totals: TotalsResult = lineResults.reduce(
    (acc, item) => {
      acc.subtotal = roundMoney(acc.subtotal + item.subtotal);
      acc.discount = roundMoney(acc.discount + item.discount);
      acc.taxableAmount = roundMoney(acc.taxableAmount + item.subtotal - item.discount);
      acc.taxAmount = roundMoney(acc.taxAmount + item.taxAmount);
      acc.totalAmount = roundMoney(acc.totalAmount + item.lineTotal);
      return acc;
    },
    { subtotal: 0, discount: 0, taxableAmount: 0, taxAmount: 0, totalAmount: 0, taxRate: baseRate > 0 ? baseRate : null },
  );

  return { items: lineResults, totals };
}