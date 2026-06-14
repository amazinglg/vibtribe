import React from 'react';

interface WordmarkProps {
  className?: string;
}

/**
 * VibTribe wordmark — "Vib" in white, "Tribe" in a purple→blue gradient.
 * Matches the official logo lockup. Size is controlled by the parent
 * via font-size utility classes on `className`.
 */
export default function Wordmark({ className = '' }: WordmarkProps) {
  return (
    <span className={`font-bold tracking-tight whitespace-nowrap ${className}`}>
      <span className="text-white">Vib</span>
      <span
        className="bg-clip-text text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, #a855f7 0%, #8b5cf6 35%, #6366f1 65%, #3b82f6 100%)',
        }}
      >
        Tribe
      </span>
    </span>
  );
}