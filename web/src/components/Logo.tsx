export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="var(--ink)" />
      <rect x="14" y="24" width="26" height="26" rx="6" fill="var(--paper)" />
      <path d="M20 31h14M20 37h14M20 43h9" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="45" cy="19" r="4.5" fill="var(--alert)" />
      <path d="M45 8.5a10.5 10.5 0 0 1 10.5 10.5" fill="none" stroke="var(--alert)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">PatchPing</span>
    </span>
  );
}
