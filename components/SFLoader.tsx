"use client";

import React from "react";
import "./SFLoader.css";

interface SFLoaderProps {
  size?: number;
  duration?: number;
}

/**
 * SFLoader — a single rotating gradient arc around two gently pulsing
 * overlapping circles (the "split" mark). Themed via CSS variables that
 * flip under a .dark ancestor class.
 */
const SFLoader: React.FC<SFLoaderProps> = ({ size = 140, duration = 1.4 }) => {
  const frameInset = size * 0.08;
  const frameSize = size - frameInset * 2;
  const frameRadius = size * 0.22;

  const ringRadius = size * 0.3;
  const circumference = 2 * Math.PI * ringRadius;
  const arcLength = circumference * 0.24;

  const cx = size / 2;
  const cy = size / 2;
  const dur = `${duration}s`;

  const dotR = size * 0.11;
  const offset = dotR * 0.55;

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
        <defs>
          <linearGradient id="sf-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>

        <rect className="sf-bg" width={size} height={size} />

        <rect
          className="sf-frame"
          x={frameInset}
          y={frameInset}
          width={frameSize}
          height={frameSize}
          rx={frameRadius}
        />

        <circle className="sf-track" cx={cx} cy={cy} r={ringRadius} />

        <circle
          className="sf-arc"
          cx={cx}
          cy={cy}
          r={ringRadius}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${cx} ${cy}`}
            to={`360 ${cx} ${cy}`}
            dur={dur}
            repeatCount="indefinite"
          />
        </circle>
<circle className="sf-circle-a" cx={cx - offset} cy={cy} r={dotR}>
  <animate
    attributeName="r"
    values={`${dotR * 0.85};${dotR * 1.25};${dotR * 0.85}`}
    keyTimes="0;0.5;1"
    dur={`${duration * 1.8}s`}
    calcMode="spline"
    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
    repeatCount="indefinite"
  />
  <animate
    attributeName="opacity"
    values="0.6;1;0.6"
    keyTimes="0;0.5;1"
    dur={`${duration * 1.8}s`}
    calcMode="spline"
    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
    repeatCount="indefinite"
  />
</circle>
<circle className="sf-circle-b" cx={cx + offset} cy={cy} r={dotR}>
  <animate
    attributeName="r"
    values={`${dotR * 1.25};${dotR * 0.85};${dotR * 1.25}`}
    keyTimes="0;0.5;1"
    dur={`${duration * 1.8}s`}
    calcMode="spline"
    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
    repeatCount="indefinite"
  />
  <animate
    attributeName="opacity"
    values="1;0.6;1"
    keyTimes="0;0.5;1"
    dur={`${duration * 1.8}s`}
    calcMode="spline"
    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
    repeatCount="indefinite"
  />
</circle>
      </svg>
    </div>
  );
};

export default SFLoader;