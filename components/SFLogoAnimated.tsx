"use client";

import "./SFLogoAnimated.css";

export default function SFLogoAnimated({
  height = 24,
  showText = true,
  animate = true,
}: {
  height?: number;
  showText?: boolean;
  animate?: boolean;
}) {
  // viewBox is cropped tightly to the two circles, same as SFLogo
  const width = (108 / 76) * height;

  return (
    <span
      className={`sf-logo-anim${animate ? "" : " sf-logo-anim--static"}`}
      style={{ fontSize: height * 0.8 }}
    >
      <svg
        width={width}
        height={height}
        viewBox="20 32 108 76"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle className="sf-logo-anim__a" cx="58" cy="70" r="38" fill="#4f46e5" />
        <circle className="sf-logo-anim__b" cx="90" cy="70" r="38" fill="#0ea5e9" />
      </svg>
      {showText && <span className="sf-logo-anim__text">SplitFlow</span>}
    </span>
  );
}