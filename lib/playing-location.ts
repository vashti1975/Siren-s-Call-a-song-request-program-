export const cityLocations = [
  { name: "Limsa Lominsa", zone: "Limsa Lominsa Lower Decks" },
  { name: "Gridania", zone: "New Gridania" },
  { name: "Ul'dah", zone: "Ul'dah - Steps of Nald" },
  { name: "Ishgard", zone: "Foundation" },
  { name: "Kugane", zone: "Kugane" },
  { name: "The Crystarium", zone: "The Crystarium" },
  { name: "Old Sharlayan", zone: "Old Sharlayan" },
  { name: "Tuliyollal", zone: "Tuliyollal" },
] as const;

export type PlayingLocation = {
  kind: "city" | "venue";
  name: string;
  dataCenter: string;
  world: string;
  zone: string;
  address: string;
  x: number | null;
  y: number | null;
};
export type SavedVenue = { id: string; location: PlayingLocation };
export type LocationSettings = { current: PlayingLocation | null; venues: SavedVenue[] };

export function locationPin(location: PlayingLocation) {
  return location.x !== null && location.y !== null
    ? `${location.zone} (X: ${location.x.toFixed(1)}, Y: ${location.y.toFixed(1)})`
    : location.zone;
}

export function locationText(location: PlayingLocation) {
  return [location.name, [location.dataCenter, location.world].filter(Boolean).join(" / "), location.address, locationPin(location)]
    .filter((part, index, all) => part && all.indexOf(part) === index).join(" · ");
}

// Read the expanded text copied from the chat log, never the unresolved <flag> tag.
export function parseMapPin(text: string): { zone: string; x: number; y: number } | null {
  const cleaned = text.replace(/[\uE000-\uF8FF]/g, "").trim();
  const match = cleaned.match(/^(.+?)\s*\(\s*(?:X\s*:\s*)?(\d+(?:\.\d+)?)\s*[,，]\s*(?:Y\s*:\s*)?(\d+(?:\.\d+)?)\s*\)(?:\s*(?:Z\s*:\s*)?-?\d*(?:\.\d+)?)?\s*$/i);
  if (!match) return null;
  const x = Number(match[2]), y = Number(match[3]);
  const zone = match[1].replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!zone || zone.length > 120 || x < 0 || y < 0 || x > 100 || y > 100) return null;
  return { zone, x, y };
}
