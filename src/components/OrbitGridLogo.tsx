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
      {/* Peach gradient rounded background */}
      <rect width="48" height="48" rx="10.5" fill="url(#nnBgGrad)" />

      {/* Outer orbit ring */}
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="#ffffff"
        strokeOpacity="0.85"
        strokeWidth="1.4"
      />
      {/* Middle orbit ring */}
      <circle
        cx="24"
        cy="24"
        r="12.5"
        stroke="#ffffff"
        strokeOpacity="0.85"
        strokeWidth="1.2"
      />

      {/* Orbital dot accents */}
      <circle cx="30" cy="7.8" r="1.8" fill="#e8553d" opacity="0.75" />
      <circle cx="42.5" cy="28.5" r="1.5" fill="#e8553d" opacity="0.65" />
      <circle cx="15" cy="41.5" r="1.6" fill="#e8553d" opacity="0.6" />

      {/* Red core circle */}
      <circle cx="24" cy="24" r="8.2" fill="url(#nnCoreGrad)" />

      {/* Bold N letterform */}
      <path
        d="M20.6 28.6V19.4L27.4 28.6V19.4"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <defs>
        <linearGradient id="nnBgGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffa184" />
          <stop offset="1" stopColor="#ff7551" />
        </linearGradient>
        <radialGradient id="nnCoreGrad" cx="0.45" cy="0.4" r="0.65">
          <stop stopColor="#f06040" />
          <stop offset="1" stopColor="#d43b22" />
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
