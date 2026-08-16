"use client";

export default function CloseLegalTabButton() {
  return (
    <button
      type="button"
      onClick={() => window.close()}
      style={{
        border: 0,
        background: "transparent",
        padding: 0,
        color: "#0b5cab",
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      ← Close this tab
    </button>
  );
}