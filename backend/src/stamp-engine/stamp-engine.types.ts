// Shared types for the Digital Stamp Engine.
// The visual stamp is presentation only — authenticity is cryptographic.

export interface StampCanvasConfig {
  width?: number;
  height?: number;
  background?: string; // 'transparent' or CSS color
}

export interface StampShapeConfig {
  type: 'circle' | 'rectangle' | 'square' | 'oval';
  outerRadius?: number; // circle
  width?: number; // rectangle
  height?: number;
  borderWidth?: number;
  borderColor?: string;
  borderCount?: number; // concentric borders
  innerRings?: StampRingConfig[];
}

export interface StampRingConfig {
  radius?: number; // circle/oval ring radius (or inset for rect)
  inset?: number; // rectangular rings inset from edge
  width: number;
  color: string;
  dashed?: boolean;
  dashGap?: [number, number];
}

export interface StampLayerBase {
  id: string;
  name?: string;
  type:
    | 'text'
    | 'curved-text'
    | 'image'
    | 'date'
    | 'serial'
    | 'verification-marker';
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  zIndex?: number;
}

export interface StampTextLayer extends StampLayerBase {
  type: 'text';
  content: string;
  fontFamily?: string; // serif | sans-serif | monospace | cursive or explicit
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  align?: 'start' | 'middle' | 'end';
  direction?: 'horizontal' | 'vertical';
}

export interface StampCurvedTextLayer extends StampLayerBase {
  type: 'curved-text';
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  separator?: string; // character placed at the arc gap midpoint (e.g. '★')
  curve: {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle: number; // degrees, 0 = 12 o'clock
    endAngle: number;
    orientation: 'outward' | 'inward'; // outward = text on outside of arc reading clockwise
  };
}

export interface StampImageLayer extends StampLayerBase {
  type: 'image';
  assetId?: string; // StampAsset id (resolved server-side)
  url?: string; // fallback direct URL (data URI allowed)
  width: number;
  height: number;
  fit?: 'contain' | 'cover';
}

export interface StampDateLayer extends StampLayerBase {
  type: 'date';
  format?: 'DD MMM YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  showTime?: boolean;
  timeFormat?: 'HH:mm:ss' | 'HH:mm';
  label?: string; // e.g. "DIGITALLY STAMPED"
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  source?: 'server'; // only server timestamps are honored
}

export interface StampSerialLayer extends StampLayerBase {
  type: 'serial';
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  label?: string; // e.g. "SERIAL NO"
}

export interface StampVerificationMarkerLayer extends StampLayerBase {
  type: 'verification-marker';
  size?: number;
  color?: string;
  text?: string; // e.g. "VERIFIED DIGITALLY"
  fontSize?: number;
}

export type StampLayer =
  | StampTextLayer
  | StampCurvedTextLayer
  | StampImageLayer
  | StampDateLayer
  | StampSerialLayer
  | StampVerificationMarkerLayer;

export interface StampEffectsConfig {
  inkOpacity?: number; // global opacity of the stamp body
  texture?: 'none' | 'ink' | 'grain';
  emboss?: boolean;
  noiseAmount?: number; // 0..1
  watermarkText?: string;
  watermarkOpacity?: number;
}

export interface StampTemplateConfig {
  canvas: StampCanvasConfig;
  shape: StampShapeConfig;
  layers: StampLayer[];
  effects?: StampEffectsConfig;
  center?: {
    type?: 'logo' | 'text' | 'none';
  };
}

/** Render context resolved at stamp time (server authoritative). */
export interface StampRenderContext {
  serialNumber?: string;
  stampDate?: string; // preformatted visual date
  stampTime?: string;
  timezoneLabel?: string; // e.g. "CAT"
  assets: Record<string, string>; // assetId -> URL/dataURI
}

// ── Permissions ──

export const DOCUMENT_STAMP_PERMISSIONS = [
  'DOCUMENT_STAMP_VIEW',
  'DOCUMENT_STAMP_CREATE',
  'DOCUMENT_STAMP_EDIT',
  'DOCUMENT_STAMP_DELETE',
  'DOCUMENT_STAMP_APPLY',
  'DOCUMENT_STAMP_APPROVE',
  'DOCUMENT_VERIFY',
  'DOCUMENT_REVOKE',
] as const;

export type DocumentStampPermission = (typeof DOCUMENT_STAMP_PERMISSIONS)[number];

/** Roles implicitly holding every DOCUMENT_STAMP_* permission (school-level authority). */
export const STAMP_ADMIN_ROLES = ['Director', 'Head Teacher', 'Admin', 'SUPER_ADMIN'];

const ROLE_DEFAULT_PERMISSIONS: Record<string, DocumentStampPermission[]> = {
  Director: [...DOCUMENT_STAMP_PERMISSIONS],
  'Head Teacher': [...DOCUMENT_STAMP_PERMISSIONS],
  Admin: [...DOCUMENT_STAMP_PERMISSIONS],
  Deputy: [
    'DOCUMENT_STAMP_VIEW',
    'DOCUMENT_STAMP_CREATE',
    'DOCUMENT_STAMP_EDIT',
    'DOCUMENT_STAMP_APPLY',
    'DOCUMENT_STAMP_APPROVE',
    'DOCUMENT_VERIFY',
    'DOCUMENT_REVOKE',
  ],
  'Class Teacher': ['DOCUMENT_STAMP_VIEW', 'DOCUMENT_VERIFY'],
  Teacher: ['DOCUMENT_STAMP_VIEW', 'DOCUMENT_VERIFY'],
  Registrar: [
    'DOCUMENT_STAMP_VIEW',
    'DOCUMENT_STAMP_APPLY',
    'DOCUMENT_VERIFY',
  ],
};

export function defaultPermissionsForRoles(roles: string[]): Set<DocumentStampPermission> {
  const granted = new Set<DocumentStampPermission>();
  for (const role of roles || []) {
    const perms = ROLE_DEFAULT_PERMISSIONS[role];
    if (perms) perms.forEach(p => granted.add(p));
  }
  return granted;
}
