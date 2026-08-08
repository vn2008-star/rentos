import React from "react";

/**
 * The RentOS mark.
 *
 * A bicycle wheel whose spokes double as a globe's meridians, under a roof:
 * Davis rides, tenants come from everywhere, and the business is housing.
 *
 * Inlined as a component rather than an <img> so it inherits currentColor and
 * can be recoloured per surface — white on the brand-gradient tile in the
 * sidebar, brand-coloured on light backgrounds.
 */
export function RentosMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="RentOS"
    >
      {/* Roof */}
      <path d="M11 21 L32 7 L53 21" strokeWidth={4.5} />
      {/* Tyre */}
      <circle cx={32} cy={40} r={17} strokeWidth={4} />
      {/* Spokes, which are also the globe's grid */}
      <g strokeWidth={2} opacity={0.9}>
        <line x1={32} y1={23} x2={32} y2={57} />
        <line x1={15} y1={40} x2={49} y2={40} />
        <line x1={20} y1={28} x2={44} y2={52} />
        <line x1={44} y1={28} x2={20} y2={52} />
        <ellipse cx={32} cy={40} rx={8} ry={17} />
        <ellipse cx={32} cy={40} rx={17} ry={8} />
      </g>
      {/* Hub */}
      <circle cx={32} cy={40} r={3.2} strokeWidth={3} />
    </svg>
  );
}
