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
      <path d="M10 21 L32 6.5 L54 21" strokeWidth={5} />
      {/* Tyre */}
      <circle cx={32} cy={40} r={17} strokeWidth={5} />
      {/* The world, kept quiet so the wheel reads first */}
      <g strokeWidth={1.5} opacity={0.55}>
        <ellipse cx={32} cy={40} rx={8} ry={17} />
        <ellipse cx={32} cy={40} rx={17} ry={8} />
        <line x1={15} y1={40} x2={49} y2={40} />
      </g>
      {/* Three spokes, hub to rim */}
      <g strokeWidth={3}>
        <line x1={32} y1={35.5} x2={32} y2={23} />
        <line x1={28.1} y1={42.25} x2={17.3} y2={48.5} />
        <line x1={35.9} y1={42.25} x2={46.7} y2={48.5} />
      </g>
      {/* Hub */}
      <circle cx={32} cy={40} r={4.5} strokeWidth={3.5} />
    </svg>
  );
}
