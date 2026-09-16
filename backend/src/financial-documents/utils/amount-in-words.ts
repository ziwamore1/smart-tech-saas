import { CURRENCY_NAMES } from '../constants';

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function threeDigitToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      const word = ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
      parts.push(word);
    }
  }
  return parts.join(' ');
}

export function numberToWordsInt(value: number): string {
  if (!Number.isFinite(value)) return '';
  const n = Math.floor(Math.abs(value));
  if (n === 0) return ONES[0];

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const chunk = threeDigitToWords(groups[i]);
    parts.push(SCALES[i] ? `${chunk} ${SCALES[i]}` : chunk);
  }
  return parts.join(' ');
}

export function amountInWords(amount: number, currency: string = 'ZMW'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const major = Math.floor(Math.abs(safe));
  const minor = Math.round((Math.abs(safe) - major) * 100);
  const names = CURRENCY_NAMES[currency] || { major: currency, minor: 'Cent' };

  const parts: string[] = [];
  if (major > 0) {
    parts.push(`${numberToWordsInt(major)} ${names.major}${major === 1 ? '' : 's'}`);
  }
  if (minor > 0) {
    parts.push(`${numberToWordsInt(minor)} ${names.minor}${minor === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    return `Zero ${names.major}s`;
  }
  return parts.join(' and ') + ' Only';
}

export function formatAmount(amount: number, currency: string = 'ZMW'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}