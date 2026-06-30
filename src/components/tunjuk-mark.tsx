interface Props {
  size?: number;
  className?: string;
  pulse?: boolean;
}

export function TunjukMark({ size = 24, className = "", pulse = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden
    >
      <path d="M2 9 V2 H9" />
      <path d="M30 9 V2 H23" />
      <path d="M2 23 V30 H9" />
      <path d="M30 23 V30 H23" />
      <path d="M16 9 V13" />
      <path d="M16 19 V23" />
      <path d="M9 16 H13" />
      <path d="M19 16 H23" />
      <circle
        cx="16"
        cy="16"
        r="2"
        fill="#63d297"
        stroke="none"
        className={pulse ? "tunjuk-pulse" : ""}
      />
    </svg>
  );
}
