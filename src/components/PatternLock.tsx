import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Classic 3x3 drag pattern lock (Android-style).
 * - User drags a finger / mouse across dots.
 * - Dots are added to the sequence as the pointer crosses them.
 * - A live SVG line connects selected dots.
 * - Emits the final sequence on pointer release via onComplete.
 */
interface PatternLockProps {
  value: number[];                       // controlled selected dots
  onChange: (next: number[]) => void;    // called while drawing
  onComplete?: (final: number[]) => void;// called on pointer up
  size?: number;                         // px, default 240
  disabled?: boolean;
  hideNumbers?: boolean;
}

export default function PatternLock({
  value, onChange, onComplete, size = 240, disabled, hideNumbers,
}: PatternLockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const dotPositions = useRef<{ id: number; x: number; y: number }[]>([]);

  // Compute centers for 9 dots in a 3x3 grid
  const recomputeDots = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dots: { id: number; x: number; y: number }[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        dots.push({
          id: row * 3 + col + 1,
          x: (col + 0.5) * (w / 3),
          y: (row + 0.5) * (h / 3),
        });
      }
    }
    dotPositions.current = dots;
  }, []);

  useEffect(() => {
    recomputeDots();
    const ro = new ResizeObserver(recomputeDots);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recomputeDots]);

  const hitTest = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const r = (rect.width / 3) * 0.32; // radius of dot hit area
    for (const d of dotPositions.current) {
      const dx = d.x - x;
      const dy = d.y - y;
      if (dx * dx + dy * dy <= r * r) return d.id;
    }
    return null;
  };

  const handleMove = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPointer({ x: clientX - rect.left, y: clientY - rect.top });
    const hit = hitTest(clientX, clientY);
    if (hit && !value.includes(hit)) {
      onChange([...value, hit]);
    }
  };

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    recomputeDots();
    setDrawing(true);
    onChange([]);
    // Hit-test the starting point too
    setTimeout(() => handleMove(e.clientX, e.clientY), 0);
  };

  const handleUp = () => {
    if (!drawing) return;
    setDrawing(false);
    setPointer(null);
    onComplete?.(value);
  };

  // SVG line points
  const linePoints = value
    .map((id) => dotPositions.current.find((d) => d.id === id))
    .filter(Boolean) as { x: number; y: number }[];

  return (
    <div
      ref={containerRef}
      onPointerDown={handleDown}
      onPointerMove={(e) => drawing && handleMove(e.clientX, e.clientY)}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleUp}
      className="relative mx-auto touch-none select-none"
      style={{ width: size, height: size }}
    >
      {/* Connecting lines */}
      <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
        {linePoints.length > 1 && (
          <polyline
            points={linePoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {linePoints.length > 0 && pointer && drawing && (
          <line
            x1={linePoints[linePoints.length - 1].x}
            y1={linePoints[linePoints.length - 1].y}
            x2={pointer.x}
            y2={pointer.y}
            stroke="hsl(var(--primary))"
            strokeWidth={4}
            strokeOpacity={0.6}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Dots */}
      {Array.from({ length: 9 }, (_, i) => i + 1).map((id) => {
        const row = Math.floor((id - 1) / 3);
        const col = (id - 1) % 3;
        const cellW = size / 3;
        const isActive = value.includes(id);
        const idx = value.indexOf(id);
        return (
          <div
            key={id}
            className={`absolute rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all pointer-events-none ${
              isActive
                ? 'border-primary bg-primary text-white scale-110'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}
            style={{
              width: cellW * 0.5,
              height: cellW * 0.5,
              left: col * cellW + cellW * 0.25,
              top: row * cellW + cellW * 0.25,
            }}
          >
            {!hideNumbers && isActive ? idx + 1 : ''}
          </div>
        );
      })}
    </div>
  );
}
