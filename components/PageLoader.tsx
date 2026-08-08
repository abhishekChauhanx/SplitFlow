"use client";

export default function PageLoader({ label = "Loading..." }: { label?: string }) {
  const dots = Array.from({ length: 12 });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div style={{ position: "relative", width: 56, height: 56 }}>
        {dots.map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              borderRadius: "50%",
              background: "#fff",
              transform: `rotate(${i * 30}deg) translate(22px)`,
              animation: "pageLoaderPulse 1.2s linear infinite",
              animationDelay: `${(i * 1.2) / 12}s`,
            }}
          />
        ))}
      </div>
      <p style={{ marginTop: 18, color: "#fff", fontSize: 12, letterSpacing: 3, fontWeight: 600 }}>
        {label.toUpperCase()}
      </p>
      <style jsx>{`
        @keyframes pageLoaderPulse {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
}