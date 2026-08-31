import type { ReactNode } from 'react';

export default function TooltipWrap({
  text,
  children,
  className,
}: {
  text?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span title={text} className={className}>
      {children}
    </span>
  );
}
