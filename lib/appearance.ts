export type Appearance = {
  title: string; subtitle: string; accent: string; background: string;
  panel: string; text: string; logo: string; backgroundImage: string; chibi: string;
  animatedBackground: boolean;
};
export const defaultAppearance: Appearance = {
  title: "FFXIV Songbook", subtitle: "A song for every adventurer",
  accent: "#8eafd3", background: "#171d26", panel: "#232c38", text: "#edf1f6",
  logo: "", backgroundImage: "", chibi: "/default-chibi.png", animatedBackground: false,
};
