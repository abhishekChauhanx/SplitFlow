export default function SFLogo({ height = 24 }: { height?: number }) {
  // viewBox is cropped tightly to the two circles so there's no dead space
  const width = (108 / 76) * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox="20 32 108 76"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="58" cy="70" r="38" fill="#4f46e5" />
      <circle cx="90" cy="70" r="38" fill="#0ea5e9" opacity="0.92" />
    </svg>
  );
}