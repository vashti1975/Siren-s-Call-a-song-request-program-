"use client";
import { useState } from "react";
import { Copy, MapPin } from "lucide-react";
import { locationPin, locationText, type PlayingLocation } from "../lib/playing-location";

export default function PlayingAt({location}: {location: PlayingLocation | null}) {
  const [message, setMessage] = useState("");
  if (!location) return null;
  async function copyLocation() {
    try { await navigator.clipboard.writeText(locationText(location!)); setMessage("Location copied"); }
    catch { setMessage("Couldn’t copy. Select the location text to copy it."); }
  }
  return <div className="playing-at" aria-label="Current performance location">
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
