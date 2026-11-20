"use client";
import { useEffect, useState } from "react";
import { Copy, MapPin } from "lucide-react";
import { locationPin, locationText, type PlayingLocation } from "../lib/playing-location";

export default function PlayingAt() {
  const [location, setLocation] = useState<PlayingLocation | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/location/current", {cache: "no-store"});
        if (!response.ok) return;
        const data = await response.json() as {location: PlayingLocation | null};
        if (active) setLocation(data.location);
      } catch { /* Keep the last shared location during a temporary connection failure. */ }
      finally { pending = false; }
    }
    function resume() { if (document.visibilityState === "visible") void refresh(); }
    void refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, []);
  useEffect(() => { setMessage(""); }, [location?.name, location?.world, location?.dataCenter, location?.address, location?.zone, location?.x, location?.y]);
  if (!location) return null;
  async function copyLocation() {
    try { await navigator.clipboard.writeText(locationText(location!)); setMessage("Location copied"); }
    catch { setMessage("Couldn’t copy. Select the location text to copy it."); }
  }
  return <div className="playing-at" role="status" aria-live="polite" aria-label="Current performance location">
    <MapPin size={16} aria-hidden="true"/>
    <p><strong>Playing at</strong> <span>{location.name}</span>
      {(location.world || location.dataCenter) && <span className="location-detail"> · {[location.dataCenter, location.world].filter(Boolean).join(" / ")}</span>}
      {location.address && <span className="location-detail"> · {location.address}</span>}
      {(location.zone !== location.name || location.x !== null) && <span className="location-detail"> · {locationPin(location)}</span>}
    </p>
    <button type="button" onClick={copyLocation} aria-label="Copy performance location"><Copy size={13} aria-hidden="true"/>Copy</button>
    {message && <span className="location-copy-message" role="status">{message}</span>}
  </div>;
}
