// Adapted from mobileapp-main/lib/skate-dice-data.ts
// Color fields removed — components use Chakra semantic tokens instead.

export interface SkateDie {
  key: string;
  faces: string[];
}

export const WILDCARDS = ["SK8", "✗"];

export const SKATE_DICE: SkateDie[] = [
  {
    key: "stance",
    faces: ["Regular", "Switch", "Nollie", "Fakie", "SK8", "✗"],
  },
  {
    key: "side",
    faces: ["Frontside", "Backside", "Frontside", "Backside", "SK8", "✗"],
  },
  {
    key: "spin",
    faces: ["180", "360", "180", "360", "SK8", "✗"],
  },
  {
    key: "flip",
    faces: ["Kickflip", "Heelflip", "Pop Shuvit", "Kickflip", "SK8", "✗"],
  },
];

export const isWildcard = (face: string) => WILDCARDS.includes(face);

export function trickFromFaces(faces: string[]): string {
  const words = faces.filter((f) => !isWildcard(f));
  return words.length === 0 ? "Skater's choice!" : words.join(" ");
}

export function randomFace(die: SkateDie): string {
  return die.faces[Math.floor(Math.random() * die.faces.length)];
}
