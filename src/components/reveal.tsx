import type { ReactNode } from "react";

// Originally a scroll-triggered fade via motion/react. motion runtime is
// incompatible with our Next 16 / React 19 stack (every wrapped section
// stayed at opacity:0), so this is now a static pass-through. Layout intact,
// animation removed.
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}
