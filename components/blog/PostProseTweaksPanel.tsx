"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  usePostProseTweaks,
  DEFAULT_POST_PROSE_TWEAKS,
  type PostProseTweaks,
  type ProseBodyFont,
  type ProseBodyColor,
  type ProseSize,
  type ProsePageBg,
  type ProseProseBg,
  type ProseHeadingFont,
  type ProseHeadingColor,
  type ProseLinkColor,
  type ProseLinkUnderline,
  type ProseBlockquoteStyle,
  type ProseCodeAccent,
  type ProseDropCapColor,
  type ProseHrStyle,
  type ProseBgPattern,
  type ProsePatternColor,
} from "@/hooks/usePostProseTweaks";

const HIDDEN_KEY = "skatehive:post-prose-tweaks:hidden";

// Tree-shake the panel out of production. `process.env.NODE_ENV` is
// statically replaced by the Next.js bundler, so the early-return drops
// every line below it from the prod bundle.
const IS_DEV = process.env.NODE_ENV === "development";

const BODY_FONTS: { value: ProseBodyFont; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "pixel", label: "Pixel" },
];
const BODY_COLORS: { value: ProseBodyColor; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "neon", label: "Neon" },
  { value: "white", label: "White" },
  { value: "custom", label: "Custom" },
];
const SIZES: { value: ProseSize; label: string }[] = [
  { value: "compact", label: "S" },
  { value: "comfortable", label: "M" },
  { value: "spacious", label: "L" },
];
const PAGE_BGS: { value: ProsePageBg; label: string }[] = [
  { value: "theme", label: "Theme" },
  { value: "transparent", label: "None" },
  { value: "custom", label: "Custom" },
];
const PROSE_BGS: { value: ProseProseBg; label: string }[] = [
  { value: "transparent", label: "None" },
  { value: "tint", label: "Tint" },
  { value: "paper", label: "Paper" },
  { value: "custom", label: "Custom" },
];
const BG_PATTERNS: { value: ProseBgPattern; label: string }[] = [
  { value: "none", label: "None" },
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dots" },
];
const PATTERN_COLORS: { value: ProsePatternColor; label: string }[] = [
  { value: "accent", label: "Accent" },
  { value: "text", label: "Text" },
  { value: "custom", label: "Custom" },
];
const HEADING_FONTS: { value: ProseHeadingFont; label: string }[] = [
  { value: "inherit", label: "Body" },
  { value: "sans", label: "Sans" },
  { value: "pixel", label: "Pixel" },
];
const HEADING_COLORS: { value: ProseHeadingColor; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "accent", label: "Accent" },
  { value: "text", label: "Text" },
  { value: "custom", label: "Custom" },
];
const LINK_COLORS: { value: ProseLinkColor; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "accent", label: "Accent" },
  { value: "custom", label: "Custom" },
];
const LINK_UNDERLINES: { value: ProseLinkUnderline; label: string }[] = [
  { value: "subtle", label: "Subtle" },
  { value: "solid", label: "Solid" },
  { value: "thick", label: "Thick" },
  { value: "none", label: "None" },
];
const BLOCKQUOTE_STYLES: { value: ProseBlockquoteStyle; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "pull-quote", label: "Pull" },
  { value: "box", label: "Box" },
];
const CODE_ACCENTS: { value: ProseCodeAccent; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "accent", label: "Accent" },
  { value: "custom", label: "Custom" },
];
const DROP_CAP_COLORS: { value: ProseDropCapColor; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "accent", label: "Accent" },
  { value: "inherit", label: "Body" },
];
const HR_STYLES: { value: ProseHrStyle; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "full", label: "Full" },
  { value: "fade", label: "Fade" },
];

export function PostProseTweaksPanel() {
  if (!IS_DEV) return null;
  return <PostProseTweaksPanelInner />;
}

function PostProseTweaksPanelInner() {
  const { tweaks, update, reset, importTweaks } = usePostProseTweaks();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    body: true,
    layout: false,
    bg: false,
    headings: false,
    links: false,
    blockquote: false,
    code: false,
    images: false,
    hr: false,
    dropCap: false,
    touches: true,
    io: false,
  });

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {}
  }, []);

  if (!mounted) return null;
  if (hidden) return null;

  const toggleSection = (k: string) =>
    setExpanded((e) => ({ ...e, [k]: !e[k] }));

  const onExport = async () => {
    // Strip keys equal to default so the JSON only carries deltas — easier
    // to read and faster to set as the new baseline.
    const delta: Partial<PostProseTweaks> = {};
    for (const k of Object.keys(tweaks) as (keyof PostProseTweaks)[]) {
      if (tweaks[k] !== DEFAULT_POST_PROSE_TWEAKS[k]) {
        (delta as Record<string, unknown>)[k] = tweaks[k];
      }
    }
    const json = JSON.stringify(delta, null, 2);
    setExportText(json);
    try {
      await navigator.clipboard.writeText(json);
      setImportStatus("Copied to clipboard");
      setTimeout(() => setImportStatus(null), 2000);
    } catch {
      setImportStatus("Select & copy below");
    }
  };

  const onApplyImport = () => {
    const res = importTweaks(importText);
    setImportStatus(res.ok ? "Applied" : `Error: ${res.error}`);
    if (res.ok) {
      setImportText("");
      setTimeout(() => setImportStatus(null), 2000);
    }
  };

  const content = !open ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Reading Tweaks"
      style={fabStyle}
    >
      Aa
    </button>
  ) : (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Reading Tweaks</span>
        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>
          ×
        </button>
      </div>

      <div style={scrollAreaStyle}>
        {/* ─── BODY ─── */}
        <Section
          label="Body"
          open={expanded.body}
          onToggle={() => toggleSection("body")}
        >
          <Row label="Font">
            {BODY_FONTS.map((o) => (
              <Pill key={o.value} active={tweaks.bodyFont === o.value} onClick={() => update({ bodyFont: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
          <Row label="Color">
            {BODY_COLORS.map((o) => (
              <Pill key={o.value} active={tweaks.bodyColor === o.value} onClick={() => update({ bodyColor: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.bodyColor === "custom" && (
              <ColorPick value={tweaks.bodyColorCustom} onChange={(v) => update({ bodyColorCustom: v })} />
            )}
          </Row>
          <Row label="Preset">
            {SIZES.map((o) => (
              <Pill
                key={o.value}
                active={tweaks.size === o.value}
                onClick={() => {
                  // Preset adjusts fontSize+leading+gap; let user fine-tune via sliders.
                  if (o.value === "compact") update({ size: o.value, fontSize: 15, lineHeight: 1.6, paragraphGap: 0.9 });
                  else if (o.value === "comfortable") update({ size: o.value, fontSize: 17, lineHeight: 1.75, paragraphGap: 1.15 });
                  else update({ size: o.value, fontSize: 19, lineHeight: 1.85, paragraphGap: 1.4 });
                }}
              >
                {o.label}
              </Pill>
            ))}
          </Row>
          <Slider label="Font size" min={13} max={24} step={1} unit="px" value={tweaks.fontSize} onChange={(v) => update({ fontSize: v })} />
          <Slider label="Line height" min={1.2} max={2.2} step={0.05} value={tweaks.lineHeight} onChange={(v) => update({ lineHeight: v })} />
          <Slider label="Letter spacing" min={-0.02} max={0.08} step={0.005} unit="em" value={tweaks.letterSpacing} onChange={(v) => update({ letterSpacing: v })} />
          <Slider label="Paragraph gap" min={0.4} max={2.2} step={0.05} unit="em" value={tweaks.paragraphGap} onChange={(v) => update({ paragraphGap: v })} />
        </Section>

        {/* ─── LAYOUT ─── */}
        <Section label="Layout" open={expanded.layout} onToggle={() => toggleSection("layout")}>
          <Slider label="Max width" min={45} max={120} step={1} unit="ch" value={tweaks.maxWidthCh} onChange={(v) => update({ maxWidthCh: v })} />
          <Slider label="Prose padding" min={0} max={48} step={1} unit="px" value={tweaks.prosePadding} onChange={(v) => update({ prosePadding: v })} />
        </Section>

        {/* ─── BACKGROUND ─── */}
        <Section label="Background" open={expanded.bg} onToggle={() => toggleSection("bg")}>
          <Row label="Page">
            {PAGE_BGS.map((o) => (
              <Pill key={o.value} active={tweaks.pageBg === o.value} onClick={() => update({ pageBg: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.pageBg === "custom" && (
              <ColorPick value={tweaks.pageBgCustom} onChange={(v) => update({ pageBgCustom: v })} />
            )}
          </Row>
          <Row label="Reader">
            {PAGE_BGS.map((o) => (
              <Pill key={o.value} active={tweaks.readerBg === o.value} onClick={() => update({ readerBg: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.readerBg === "custom" && (
              <ColorPick value={tweaks.readerBgCustom} onChange={(v) => update({ readerBgCustom: v })} />
            )}
          </Row>
          {tweaks.readerBg === "custom" && (
            <Slider label="Reader alpha" min={0} max={100} step={1} unit="%" value={tweaks.readerBgAlpha} onChange={(v) => update({ readerBgAlpha: v })} />
          )}
          <Row label="Prose">
            {PROSE_BGS.map((o) => (
              <Pill key={o.value} active={tweaks.proseBg === o.value} onClick={() => update({ proseBg: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.proseBg === "custom" && (
              <ColorPick value={tweaks.proseBgCustom} onChange={(v) => update({ proseBgCustom: v })} />
            )}
          </Row>
          {tweaks.proseBg !== "transparent" && (
            <Slider label="Prose alpha" min={0} max={100} step={1} unit="%" value={tweaks.proseBgAlpha} onChange={(v) => update({ proseBgAlpha: v })} />
          )}
          <Row label="Pattern">
            {BG_PATTERNS.map((o) => (
              <Pill key={o.value} active={tweaks.bgPattern === o.value} onClick={() => update({ bgPattern: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
          {tweaks.bgPattern !== "none" && (
            <>
              <Row label="Pattern color">
                {PATTERN_COLORS.map((o) => (
                  <Pill key={o.value} active={tweaks.bgPatternColor === o.value} onClick={() => update({ bgPatternColor: o.value })}>
                    {o.label}
                  </Pill>
                ))}
                {tweaks.bgPatternColor === "custom" && (
                  <ColorPick value={tweaks.bgPatternColorCustom} onChange={(v) => update({ bgPatternColorCustom: v })} />
                )}
              </Row>
              <Slider label="Pattern opacity" min={0} max={100} step={1} unit="%" value={tweaks.bgPatternOpacity} onChange={(v) => update({ bgPatternOpacity: v })} />
              <Slider label="Pattern size" min={6} max={64} step={1} unit="px" value={tweaks.bgPatternSize} onChange={(v) => update({ bgPatternSize: v })} />
            </>
          )}
        </Section>

        {/* ─── HEADINGS ─── */}
        <Section label="Headings" open={expanded.headings} onToggle={() => toggleSection("headings")}>
          <Row label="Font">
            {HEADING_FONTS.map((o) => (
              <Pill key={o.value} active={tweaks.headingFont === o.value} onClick={() => update({ headingFont: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
          <Row label="Color">
            {HEADING_COLORS.map((o) => (
              <Pill key={o.value} active={tweaks.headingColor === o.value} onClick={() => update({ headingColor: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.headingColor === "custom" && (
              <ColorPick value={tweaks.headingColorCustom} onChange={(v) => update({ headingColorCustom: v })} />
            )}
          </Row>
          <Slider label="H1 size" min={1.1} max={3.5} step={0.05} unit="rem" value={tweaks.h1Size} onChange={(v) => update({ h1Size: v })} />
          <Slider label="H2 size" min={1.0} max={2.8} step={0.05} unit="rem" value={tweaks.h2Size} onChange={(v) => update({ h2Size: v })} />
          <Slider label="H3 size" min={0.9} max={2.2} step={0.05} unit="rem" value={tweaks.h3Size} onChange={(v) => update({ h3Size: v })} />
          <Slider label="H4 size" min={0.9} max={1.8} step={0.05} unit="rem" value={tweaks.h4Size} onChange={(v) => update({ h4Size: v })} />
          <Slider label="Weight" min={300} max={900} step={100} value={tweaks.headingWeight} onChange={(v) => update({ headingWeight: v })} />
          <Slider label="Letter spacing" min={-0.05} max={0.1} step={0.005} unit="em" value={tweaks.headingLetterSpacing} onChange={(v) => update({ headingLetterSpacing: v })} />
          <Slider label="Top margin" min={0.2} max={3.5} step={0.1} unit="em" value={tweaks.headingTopMargin} onChange={(v) => update({ headingTopMargin: v })} />
        </Section>

        {/* ─── LINKS ─── */}
        <Section label="Links" open={expanded.links} onToggle={() => toggleSection("links")}>
          <Row label="Color">
            {LINK_COLORS.map((o) => (
              <Pill key={o.value} active={tweaks.linkColor === o.value} onClick={() => update({ linkColor: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.linkColor === "custom" && (
              <ColorPick value={tweaks.linkColorCustom} onChange={(v) => update({ linkColorCustom: v })} />
            )}
          </Row>
          <Row label="Underline">
            {LINK_UNDERLINES.map((o) => (
              <Pill key={o.value} active={tweaks.linkUnderline === o.value} onClick={() => update({ linkUnderline: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
        </Section>

        {/* ─── BLOCKQUOTE ─── */}
        <Section label="Blockquote" open={expanded.blockquote} onToggle={() => toggleSection("blockquote")}>
          <Row label="Style">
            {BLOCKQUOTE_STYLES.map((o) => (
              <Pill key={o.value} active={tweaks.blockquoteStyle === o.value} onClick={() => update({ blockquoteStyle: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
        </Section>

        {/* ─── CODE ─── */}
        <Section label="Code" open={expanded.code} onToggle={() => toggleSection("code")}>
          <Row label="Accent">
            {CODE_ACCENTS.map((o) => (
              <Pill key={o.value} active={tweaks.codeAccent === o.value} onClick={() => update({ codeAccent: o.value })}>
                {o.label}
              </Pill>
            ))}
            {tweaks.codeAccent === "custom" && (
              <ColorPick value={tweaks.codeAccentCustom} onChange={(v) => update({ codeAccentCustom: v })} />
            )}
          </Row>
          <Slider label="Bg intensity" min={0} max={30} step={1} unit="%" value={tweaks.codeBgIntensity} onChange={(v) => update({ codeBgIntensity: v })} />
        </Section>

        {/* ─── IMAGES ─── */}
        <Section label="Images" open={expanded.images} onToggle={() => toggleSection("images")}>
          <Toggle label="Image frames" value={tweaks.imageFrames} onChange={(v) => update({ imageFrames: v })} />
          <Slider label="Radius" min={0} max={28} step={1} unit="px" value={tweaks.imageRadius} onChange={(v) => update({ imageRadius: v })} />
          <Slider label="Border" min={0} max={3} step={1} unit="px" value={tweaks.imageBorder} onChange={(v) => update({ imageBorder: v })} />
          <Slider label="Shadow" min={0} max={100} step={5} unit="%" value={tweaks.imageShadow} onChange={(v) => update({ imageShadow: v })} />
        </Section>

        {/* ─── HR ─── */}
        <Section label="HR" open={expanded.hr} onToggle={() => toggleSection("hr")}>
          <Row label="Style">
            {HR_STYLES.map((o) => (
              <Pill key={o.value} active={tweaks.hrStyle === o.value} onClick={() => update({ hrStyle: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
          <Slider label="Thickness" min={1} max={4} step={1} unit="px" value={tweaks.hrThickness} onChange={(v) => update({ hrThickness: v })} />
        </Section>

        {/* ─── DROP CAP ─── */}
        <Section label="Drop cap" open={expanded.dropCap} onToggle={() => toggleSection("dropCap")}>
          <Toggle label="Enabled" value={tweaks.dropCap} onChange={(v) => update({ dropCap: v })} />
          <Slider label="Size" min={2.0} max={6.0} step={0.1} unit="em" value={tweaks.dropCapSize} onChange={(v) => update({ dropCapSize: v })} />
          <Row label="Color">
            {DROP_CAP_COLORS.map((o) => (
              <Pill key={o.value} active={tweaks.dropCapColor === o.value} onClick={() => update({ dropCapColor: o.value })}>
                {o.label}
              </Pill>
            ))}
          </Row>
        </Section>

        {/* ─── TOUCHES ─── */}
        <Section label="Touches" open={expanded.touches} onToggle={() => toggleSection("touches")}>
          <Toggle label="Tight rhythm" value={tweaks.tightRhythm} onChange={(v) => update({ tightRhythm: v })} />
        </Section>

        {/* ─── EXPORT / IMPORT ─── */}
        <Section label="Export / Import" open={expanded.io} onToggle={() => toggleSection("io")}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button type="button" onClick={onExport} style={primaryBtnStyle}>
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              style={resetStyle}
            >
              {importOpen ? "Hide" : "Import"}
            </button>
          </div>
          {exportText && (
            <textarea
              readOnly
              value={exportText}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={textareaStyle}
            />
          )}
          {importOpen && (
            <>
              <textarea
                placeholder='Paste { "bodyFont": "sans", ... }'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                style={textareaStyle}
              />
              <button type="button" onClick={onApplyImport} style={primaryBtnStyle}>
                Apply
              </button>
            </>
          )}
          {importStatus && (
            <div style={{ fontSize: 10, color: "#adff2f", marginTop: 6 }}>{importStatus}</div>
          )}
          <div style={{ fontSize: 10, color: "#888", marginTop: 8, lineHeight: 1.4 }}>
            Export only saves what differs from defaults. Paste the JSON into
            chat to make it the new project default.
          </div>
        </Section>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderTop: "1px solid #2a2a2a" }}>
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

/* ─── Pieces ─────────────────────────────────────── */

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid #1f1f1f" }}>
      <button type="button" onClick={onToggle} style={sectionHeaderStyle}>
        <span style={{ color: open ? "#adff2f" : "#aaa" }}>{label}</span>
        <span style={{ color: "#666" }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ padding: "8px 12px 12px 12px" }}>{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={rowLabelStyle}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>{children}</div>
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

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...rowLabelStyle, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "#adff2f" }}>
          {Number.isInteger(value) ? value : value.toFixed(step < 0.1 ? 3 : 2)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#adff2f" }}
      />
    </div>
  );
}

function ColorPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 28,
        height: 22,
        border: "1px solid #444",
        borderRadius: 4,
        padding: 0,
        background: "transparent",
        cursor: "pointer",
      }}
    />
  );
}

/* ─── Styles ─────────────────────────────────────── */

const fabStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 76,
  right: 20,
  zIndex: 2147483647,
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "2px solid #adff2f",
  background: "#000",
  color: "#adff2f",
  fontFamily: "'Georgia', serif",
  fontSize: 18,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 0 0 4px rgba(173,255,47,0.15), 0 8px 24px rgba(0,0,0,0.6)",
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 72,
  right: 16,
  zIndex: 2147483647,
  width: 320,
  maxHeight: "82vh",
  display: "flex",
  flexDirection: "column",
  background: "rgba(0,0,0,0.94)",
  border: "1px solid #adff2f",
  borderRadius: 10,
  color: "#eee",
  fontFamily: "monospace",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  backdropFilter: "blur(8px)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: "1px solid #2a2a2a",
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

const scrollAreaStyle: React.CSSProperties = {
  overflowY: "auto",
  flex: 1,
};

const sectionHeaderStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  color: "#aaa",
  fontFamily: "monospace",
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#888",
  marginBottom: 4,
};

const pillStyle: React.CSSProperties = {
  border: "1px solid #444",
  borderRadius: 6,
  padding: "3px 8px",
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
  flex: 1,
  padding: "6px 10px",
  background: "transparent",
  border: "1px solid #444",
  borderRadius: 6,
  color: "#aaa",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  background: "#adff2f",
  border: "1px solid #adff2f",
  borderRadius: 6,
  color: "#000",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: "bold",
  cursor: "pointer",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 80,
  marginTop: 6,
  marginBottom: 6,
  padding: 8,
  background: "rgba(0,0,0,0.6)",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#adff2f",
  fontFamily: "monospace",
  fontSize: 10,
  resize: "vertical",
};
