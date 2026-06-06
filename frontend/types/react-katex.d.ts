declare module 'react-katex' {
  import React from 'react';
  interface KatexProps {
    math: string;
    block?: boolean;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
    settings?: Record<string, any>;
  }
  export const InlineMath: React.FC<KatexProps>;
  export const BlockMath: React.FC<KatexProps>;
  const defaultExport: React.FC<KatexProps>;
  export default defaultExport;
}
