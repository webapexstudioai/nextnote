export function OrbitGridIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer orbit ring */}
      <circle cx="24" cy="24" r="21" stroke="url(#orbitGrad)" strokeWidth="1.5" opacity="0.5" />
      {/* Middle orbit ring */}
      <circle cx="24" cy="24" r="15" stroke="url(#orbitGrad)" strokeWidth="1.2" opacity="0.35" />
      {/* Inner glow circle */}
      <circle cx="24" cy="24" r="9" fill="url(#coreGrad)" />
      {/* Orbital dot accents */}
      <circle cx="24" cy="3" r="2" fill="#e8553d" opacity="0.9" />
      <circle cx="45" cy="24" r="1.5" fill="#ff8a6a" opacity="0.7" />
      <circle cx="9" cy="38" r="1.5" fill="#ff8a6a" opacity="0.5" />
      {/* N letterform */}
      <path
        d="M19.5 30V18L28.5 30V18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="orbitGrad" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#e8553d" />
          <stop offset="1" stopColor="#ff8a6a" />
        </linearGradient>
        <radialGradient id="coreGrad" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#e8553d" />
          <stop offset="1" stopColor="#d44429" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function OrbitGridLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <OrbitGridIcon size={size} />
      <span className="font-bold text-lg tracking-tight">
        Next<span className="text-[var(--accent)]">Note</span>
      </span>
    </div>
  );
}

export function OrbitGridLogoCompact({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <OrbitGridIcon size={size} className={className} />;
}
