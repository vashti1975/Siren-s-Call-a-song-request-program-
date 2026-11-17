"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";

// Fixed positions keep the first render consistent. The center stays quiet for reading.
const lanes = [3, 96, 10, 89, 18, 81, 6, 93, 24, 75, 14, 85, 1, 98, 30, 69, 8, 91, 21, 78, 4, 95, 16, 83, 11, 88, 26, 73, 7, 92, 35, 64, 2, 97, 19, 80, 44, 55, 12, 87];
const colors = ["#c38aff", "#73e8e1", "#a6b9ff", "#ef8ee8", "#a8ecc2"];

export default function ListenerMusicBackground() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  return <>
    <div className={`listener-music-background${paused || reducedMotion ? " is-paused" : ""}`} aria-hidden="true">
      <div className="music-background-texture" />
      <div className="music-background-notes">
        {lanes.map((x, index) => <span key={index} className="ambient-music-note" style={{
          left: `${x}%`,
          color: colors[index % colors.length],
          "--note-size": `${18 + (index * 7) % 24}px`,
          "--note-duration": `${22 + (index * 7) % 19}s`,
          "--note-delay": `${-((index * 13) % 39)}s`,
          "--note-drift": `${(index % 2 ? -1 : 1) * (18 + index % 5 * 9)}px`,
          "--note-angle": `${-24 + index % 7 * 8}deg`,
          "--note-opacity": x > 30 && x < 70 ? .18 : .38 + index % 4 * .09,
          "--note-rest": `${3 + (index * 17) % 90}%`,
        } as CSSProperties}>
          <svg viewBox="0 0 40 44" fill="none" focusable="false">
            {index % 3 === 0 ? <><path d="M15 33V9l20-5v24M15 16l20-5" /><ellipse cx="10" cy="34" rx="6" ry="4" transform="rotate(-20 10 34)"/><ellipse cx="30" cy="29" rx="6" ry="4" transform="rotate(-20 30 29)"/></>
              : index % 3 === 1 ? <><path d="M21 34V5c0 10 12 9 10 19"/><ellipse cx="15" cy="35" rx="7" ry="4.5" transform="rotate(-20 15 35)"/></>
              : <><path d="M15 33V10l20-5v23"/><ellipse cx="10" cy="34" rx="6" ry="4" transform="rotate(-20 10 34)"/><ellipse cx="30" cy="29" rx="6" ry="4" transform="rotate(-20 30 29)"/></>}
          </svg>
        </span>)}
      </div>
    </div>
    <button type="button" className="listener-motion-toggle" disabled={reducedMotion} aria-pressed={paused || reducedMotion} aria-label={reducedMotion ? "Background motion off: reduced motion preference" : paused ? "Resume background animation" : "Pause background animation"} onClick={() => setPaused(value => !value)}>
      {paused || reducedMotion ? <Play size={12} aria-hidden="true"/> : <Pause size={12} aria-hidden="true"/>}
      {reducedMotion ? "Still background" : paused ? "Resume background" : "Pause background"}
    </button>
  </>;
}
