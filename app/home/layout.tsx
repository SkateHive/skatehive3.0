import { JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";

// JetBrains Mono for the terminal-aesthetic media homepage. A nested layout
// can't class <html>, so we expose the font as a CSS variable on a wrapper div;
// the palette reads var(--font-jetbrains).
const jetbrains = JetBrains_Mono({
  weight: ["400", "500", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Skatehive Magazine",
  description: "The curated skateboard-media magazine — by skaters, for skaters.",
};

export default function HomeMagazineLayout({ children }: { children: React.ReactNode }) {
  return <div className={jetbrains.variable} style={{ height: "100%" }}>{children}</div>;
}
