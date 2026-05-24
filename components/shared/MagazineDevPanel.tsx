"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useMagazineTweaks,
  type BodyFont,
  type BodyColor,
} from "@/hooks/useMagazineTweaks";

const BODY_FONTS: { value: BodyFont; label: string }[] = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "pixel", label: "Pixel" },
];

const BODY_COLORS: { value: BodyColor; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "neon", label: "Neon" },
  { value: "white", label: "White" },
];

// Visibility logic:
// - Hidden if localStorage["skatehive:magazine-tweaks:hidden"] === "1"
// - Otherwise visible. We don't gate on NODE_ENV because Next.js inlining
//   was making the panel disappear during normal `next dev` sessions, and
//   it's a tiny 44px FAB that's harmless to ship.
// To hide permanently in browser console:
//   localStorage.setItem("skatehive:magazine-tweaks:hidden", "1")
const HIDDEN_KEY = "skatehive:magazine-tweaks:hidden";

export function MagazineDevPanel() {
  const { tweaks, update, reset } = useMagazineTweaks();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {}
    // Debug breadcrumb so we can confirm the panel actually mounted.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[MagazineDevPanel] mounted");
    }
  }, []);

  if (!mounted) return null;
  if (hidden) return null;

  const content = !open ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Magazine Tweaks (dev)"
      style={fabStyle}
    >
      ⚙ Magazine
    </button>
  ) : (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Magazine Tweaks</span>
        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>
          ×
        </button>
      </div>

      <Section label="Body font">
        {BODY_FONTS.map((opt) => (
          <Pill
            key={opt.value}
            active={tweaks.bodyFont === opt.value}
            onClick={() => update({ bodyFont: opt.value })}
          >
            {opt.label}
          </Pill>
        ))}
      </Section>

      <Section label="Body color">
        {BODY_COLORS.map((opt) => (
          <Pill
            key={opt.value}
            active={tweaks.bodyColor === opt.value}
            onClick={() => update({ bodyColor: opt.value })}
          >
            {opt.label}
          </Pill>
        ))}
      </Section>

      <Section label="Touches">
        <Toggle
          label="Drop cap"
          value={tweaks.dropCap}
          onChange={(v) => update({ dropCap: v })}
        />
        <Toggle
          label="Pull quote"
          value={tweaks.pullQuote}
          onChange={(v) => update({ pullQuote: v })}
        />
        <Toggle
          label="Image frames"
          value={tweaks.imageFrames}
          onChange={(v) => update({ imageFrames: v })}
        />
        <Toggle
          label="Tight rhythm"
          value={tweaks.tightRhythm}
          onChange={(v) => update({ tightRhythm: v })}
        />
      </Section>

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button type="button" onClick={reset} style={resetStyle}>
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(HIDDEN_KEY, "1");
            } catch {}
            setHidden(true);
          }}
          style={resetStyle}
          title="Hide forever (clear localStorage to bring back)"
        >
          Hide
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionStyle}>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...pillStyle,
        background: active ? "#adff2f" : "transparent",
        color: active ? "#000" : "#ccc",
        borderColor: active ? "#adff2f" : "#444",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={toggleRowStyle}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#adff2f" }}
      />
      <span>{label}</span>
    </label>
  );
}

const fabStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  right: 20,
  zIndex: 2147483647,
  padding: "10px 16px",
  borderRadius: 999,
  border: "2px solid #adff2f",
  background: "#000",
  color: "#adff2f",
  fontFamily: "monospace",
  fontSize: 12,
  fontWeight: "bold",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: "0 0 0 4px rgba(173,255,47,0.15), 0 8px 24px rgba(0,0,0,0.6)",
  pointerEvents: "auto",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 2147483647,
  width: 240,
  padding: 14,
  background: "rgba(0,0,0,0.92)",
  border: "1px solid #adff2f",
  borderRadius: 10,
  color: "#eee",
  fontFamily: "monospace",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  backdropFilter: "blur(6px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: "1px solid #333",
  color: "#adff2f",
  fontWeight: "bold",
  letterSpacing: 0.5,
};

const closeStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#888",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  padding: "0 4px",
};

const sectionStyle: React.CSSProperties = { marginBottom: 12 };

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#888",
  marginBottom: 6,
};

const sectionBodyStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const pillStyle: React.CSSProperties = {
  border: "1px solid #444",
  borderRadius: 6,
  padding: "4px 10px",
  fontFamily: "monospace",
  fontSize: 11,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s, border-color 0.15s",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  marginBottom: 4,
  cursor: "pointer",
  userSelect: "none",
};

const resetStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "6px 10px",
  background: "transparent",
  border: "1px solid #444",
  borderRadius: 6,
  color: "#888",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};
