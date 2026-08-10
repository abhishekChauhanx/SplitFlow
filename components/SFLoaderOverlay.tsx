"use client";

import SFLoader from "@/components/SFLoader";
import "@/components/SFLoader.css";

export default function SFLoaderOverlay({
  visible,
  label = "Loading...",
}: {
  visible: boolean;
  label?: string;
}) {
  return (
    <div className={`sf-overlay ${visible ? "sf-overlay--visible" : ""}`}>
      <SFLoader size={140} duration={2.4} />
      <p className="sf-overlay-text">{label}</p>
    </div>
  );
}