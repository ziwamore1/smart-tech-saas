import { FinancialDocumentType } from '@prisma/client';

export const FINANCIAL_DOCUMENTS_FOLDER = 'smarttech/financial-documents';

export const VERIFICATION_URL_BASE =
  process.env.VERIFICATION_URL || process.env.PUBLIC_APP_URL || 'https://verify.smarttechsaas.com';

export const DEFAULT_DOCUMENT_PREFIXES: Record<FinancialDocumentType, string> = {
  QUOTATION: 'QT',
  INVOICE: 'INV',
  PAYMENT_RECEIPT: 'RCT',
};

export const CURRENCY_NAMES: Record<string, { major: string; minor: string }> = {
  ZMW: { major: 'Kwacha', minor: 'Ngwee' },
  USD: { major: 'Dollar', minor: 'Cent' },
  EUR: { major: 'Euro', minor: 'Cent' },
  GBP: { major: 'Pound', minor: 'Pence' },
  ZAR: { major: 'Rand', minor: 'Cent' },
  KES: { major: 'Shilling', minor: 'Cent' },
  NGN: { major: 'Naira', minor: 'Kobo' },
  GHS: { major: 'Cedi', minor: 'Pesewa' },
};

export const ALLOWED_CURRENCIES = Object.keys(CURRENCY_NAMES);

export const FINANCIAL_VERIFY_BASE = '/api/v1/public/financial-verification';