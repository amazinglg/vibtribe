import React, { memo } from 'react';

/**
 * Vector VibTribe mark — four overlapping translucent lobes.
 * Rendered as inline SVG so it stays crisp at any size and blends with the
 * surface behind it (no opaque raster edges / "pasted image" look).
 */
const VibTribeMark = memo(function VibTribeMark({
  size = 32,
  className = '',
  title = 'VibTribe',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="vt-lobe-a" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FF7BA9" />
          <stop offset="100%" stopColor="#FF2D78" />
        </radialGradient>
        <radialGradient id="vt-lobe-b" cx="65%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4CF2C0" />
          <stop offset="100%" stopColor="#00E28A" />
        </radialGradient>
        <radialGradient id="vt-lobe-c" cx="50%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#A66BFF" />
          <stop offset="100%" stopColor="#6D28FF" />
        </radialGradient>
        <radialGradient id="vt-lobe-d" cx="50%" cy="75%" r="80%">
          <stop offset="0%" stopColor="#8B5CFF" />
          <stop offset="100%" stopColor="#5B1FE0" />
        </radialGradient>
        <filter id="vt-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>
      <g filter="url(#vt-soft)" style={{ mixBlendMode: 'normal' }}>
        <circle cx="24" cy="32" r="17" fill="url(#vt-lobe-a)" opacity="0.82" />
        <circle cx="40" cy="32" r="17" fill="url(#vt-lobe-b)" opacity="0.78" />
        <circle cx="32" cy="22" r="15" fill="url(#vt-lobe-c)" opacity="0.72" />
        <circle cx="32" cy="42" r="15" fill="url(#vt-lobe-d)" opacity="0.68" />
      </g>
    </svg>
  );
});

export default VibTribeMark;