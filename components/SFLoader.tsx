"use client";

import React from "react";
import "./SFLoader.css";

interface SFLoaderProps {
  size?: number;
  duration?: number;
  label?: string;
  dotRadius?: number;
  dotOffset?: number;
}

/**
 * SFLoader
 *
 * Uses native SVG <animate> / <animateTransform> — NOT CSS keyframes.
 * This is the only cross-browser reliable way to animate
 * stroke-dashoffset on an SVG rect.
 *
 * Props
 *   size      — square px size   (default 200)
 *   duration  — loop seconds     (default 3)
 *   label     — centre text      (default "SF")
 *   dotRadius — corner dot size  (default 2.5)
 *   dotOffset — how far outside the top-left corner the dot sits, so it
 *               doesn't touch the border stroke (default 6)
 */
const SFLoader: React.FC<SFLoaderProps> = ({
  size = 200,
  duration = 3,
  label = "SF",
  dotRadius = 2.5,
  dotOffset = 6,
}) => {
  const outerInset = 8;
  const innerInset = 18;
  const outerSize = size - outerInset * 2; // e.g. 184 at size=200
  const innerSize = size - innerInset * 2; // e.g. 164 at size=200
  const perimeter = innerSize * 4; // e.g. 656 at size=200
  const dur = `${duration}s`;

  return (
    <div className="sf-loader-wrapper">
      <svg
        className="sf-loader-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Loading"
        role="img"
      >
        {/* ── dark background ── */}
        <rect className="sf-bg" width={size} height={size} rx="2" />

        {/* ── outer decorative border ── */}
        <rect
          className="sf-border-outer"
          x={outerInset}
          y={outerInset}
          width={outerSize}
          height={outerSize}
        />

        {/* ── inner dim static track ── */}
        <rect
          className="sf-border-inner"
          x={innerInset}
          y={innerInset}
          width={innerSize}
          height={innerSize}
        />

        {/* ── centre label ── */}
        <text
          className="sf-label"
          x={size / 2}
          y={size / 2}
          fontSize={size * 0.18}
          letterSpacing={size * 0.03}
        >
          {label}
        </text>

        {/*
          ── Animated border ──
          strokeDasharray  = perimeter  → whole border = one dash
          strokeDashoffset = perimeter  → dash starts fully offset (invisible)
          <animate> drives offset from perimeter → 0 → border draws itself
          This uses native SVG SMIL animation — works in all browsers,
          no CSS var-in-keyframes bug.
        */}
        <rect
          className="sf-border-animated"
          x={innerInset}
          y={innerInset}
          width={innerSize}
          height={innerSize}
          strokeDasharray={perimeter}
          strokeDashoffset={perimeter}
        >
          <animate
            attributeName="stroke-dashoffset"
            from={perimeter}
            to={0}
            dur={dur}
            repeatCount="indefinite"
            calcMode="linear"
          />
        </rect>

        {/* ── top-left corner dot — sits outside the corner, not touching the border — pulses ── */}
        <circle
          className="sf-dot-tl"
          cx={innerInset - dotOffset}
          cy={innerInset - dotOffset}
          r={dotRadius}
        >
          <animate attributeName="opacity" values="0.3;1;0.3" dur={dur} repeatCount="indefinite" />
        </circle>

        {/* ── bottom-right corner dot — sits outside that corner, pulses out of phase ── */}
        <circle
          className="sf-dot-br"
          cx={size - innerInset + dotOffset}
          cy={size - innerInset + dotOffset}
          r={dotRadius}
        >
          <animate attributeName="opacity" values="1;0.3;1" dur={dur} repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
};

export default SFLoader;