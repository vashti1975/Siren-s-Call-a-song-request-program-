"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin, Shuffle } from "lucide-react";
import { cityLocations, locationText, parseMapPin, type LocationSettings, type PlayingLocation } from "../lib/playing-location";

type Draft = Omit<PlayingLocation, "x" | "y"> & {x: string; y: string};
const emptyDraft: Draft = {kind: "city", name: cityLocations[0].name, zone: cityLocations[0].zone, dataCenter: "", world: "", address: "", x: "", y: ""};
const toDraft = (location: PlayingLocation): Draft => ({...location, x: location.x?.toString() ?? "", y: location.y?.toString() ?? ""});

export default function OwnerPlayingLocation() {
  const [settings, setSettings] = useState<LocationSettings | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [venueId, setVenueId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const operation = useRef(false);
  async function load() {
    try {
      const response = await fetch("/api/location", {cache: "no-store"});
      if (!response.ok) throw new Error("Couldn’t load your location settings. Try again.");
      const data = await response.json() as LocationSettings;
      setSettings(data); setError("");
      if (data.current) {
        setDraft(toDraft(data.current));
        setVenueId(data.venues.find(venue => JSON.stringify(venue.location) === JSON.stringify(data.current))?.id ?? "");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t load location settings."); }
  }
  useEffect(() => { void load(); }, []);
  function update(key: keyof Draft, value: string) { setDraft(previous => ({...previous, [key]: value})); setNotice(""); }
  function chooseCity(index: number) {
    const city = cityLocations[index];
    setDraft(previous => ({...previous, kind: "city", name: city.name, zone: city.zone, address: "", x: "", y: ""}));
    setVenueId(""); setPin(""); setError(""); setNotice("");
  }
  function readPin(): Draft | null {
    if (!pin.trim()) return draft;
    const parsed = parseMapPin(pin);
    if (!parsed) { setError("Paste the expanded zone and coordinates from the chat log, such as Limsa Lominsa Lower Decks (9.5, 11.0), or enter the zone, X and Y below. <flag> alone has no coordinates."); return null; }
    const city = cityLocations.find(city => city.zone === parsed.zone);
    return {...draft, zone: parsed.zone, x: String(parsed.x), y: String(parsed.y), ...(draft.kind === "city" ? {name: city?.name ?? parsed.zone} : {})};
  }
  function usePin() {
    const next = readPin();
    if (next) { setDraft(next); setPin(""); setError(""); setNotice("Pin added to the draft. Choose Show location to share it."); }
  }
  async function write(action: "show" | "hide" | "save-venue" | "delete-venue") {
    if (operation.current || !settings) return;
    let body: Record<string, unknown> = {action};
    if (action === "show" || action === "save-venue") {
      const next = readPin(); if (!next) return;
      if (!next.name.trim() || !next.zone.trim() || (next.kind === "venue" && !next.address.trim())) { setError("Enter a name and zone, plus the full address for a venue."); return; }
      if ((next.x.trim() === "") !== (next.y.trim() === "")) { setError("Enter both X and Y, or leave both blank."); return; }
      const location: PlayingLocation = {...next, address: next.kind === "city" ? "" : next.address, x: next.x.trim() === "" ? null : Number(next.x), y: next.y.trim() === "" ? null : Number(next.y)};
      body = {...body, location, ...(action === "save-venue" ? {id: venueId || crypto.randomUUID()} : {})};
      setDraft(next);
    }
    if (action === "delete-venue") body.id = venueId;
    operation.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/location", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
      const data = await response.json() as LocationSettings & {error?: string};
      if (!response.ok) throw new Error(data.error || "Couldn’t save the location. Please try again.");
      setSettings(data);
      if (action === "save-venue") setVenueId(body.id as string);
      if (action === "delete-venue") setVenueId("");
      if (action === "show" || action === "save-venue") setPin("");
      setNotice(action === "show" ? "Location is live. Listeners see changes within 5 seconds." : action === "hide" ? "Location hidden from listeners." : action === "save-venue" ? "Venue saved. Choose Show location when you’re playing there." : "Saved venue removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save the location."); }
    finally { operation.current = false; setBusy(false); }
  }
  return <details className="owner-location">
    <summary><MapPin size={16} aria-hidden="true"/><strong>Playing at</strong><span>{settings ? settings.current ? locationText(settings.current) : "Hidden · choose a location" : error ? "Couldn’t load settings" : "Loading…"}</span><ChevronDown size={14} aria-hidden="true"/></summary>
    {!settings ? <div className="location-editor"><p role={error ? "alert" : "status"}>{error || "Loading locations…"}</p>{error && <button type="button" onClick={load}>Try again</button>}</div> : <form className="location-editor" onSubmit={event => {event.preventDefault(); void write("show");}}>
      <fieldset disabled={busy}>
        <div className="location-presets"><label>Location type<select value={draft.kind} onChange={event => {setDraft(previous => ({...previous, kind: event.target.value as Draft["kind"], name: event.target.value === "venue" ? "" : emptyDraft.name, zone: event.target.value === "venue" ? "" : emptyDraft.zone, address: "", x: "", y: ""})); setVenueId(""); setPin(""); setError(""); setNotice("");}}><option value="city">City / open-world spot</option><option value="venue">Venue</option></select></label>
        {draft.kind === "city" ? <><label>City<select value={cityLocations.findIndex(city => city.name === draft.name)} onChange={event => chooseCity(Number(event.target.value))}>{!cityLocations.some(city => city.name === draft.name) && <option value={-1}>{draft.name || "Custom location"}</option>}{cityLocations.map((city, index) => <option key={city.name} value={index}>{city.name}</option>)}</select></label><button type="button" onClick={() => {const choices = cityLocations.map((_, index) => index).filter(index => cityLocations[index].name !== draft.name); chooseCity(choices[Math.floor(Math.random() * choices.length)]);}}><Shuffle size={13}/>Random city</button></> : <label>Saved venue<select value={venueId} onChange={event => {const venue = settings.venues.find(venue => venue.id === event.target.value); setVenueId(event.target.value); setDraft(venue ? toDraft(venue.location) : {...emptyDraft, kind: "venue", name: "", zone: ""}); setPin(""); setError(""); setNotice("");}}><option value="">New venue…</option>{settings.venues.map(venue => <option key={venue.id} value={venue.id}>{venue.location.name} · {venue.location.world}</option>)}</select></label>}</div>
        <div className="location-fields">
          <label>{draft.kind === "venue" ? "Venue name" : "Location name"}<input maxLength={100} required value={draft.name} onChange={event => update("name", event.target.value)}/></label>
          <label>Data center<input maxLength={60} value={draft.dataCenter} onChange={event => update("dataCenter", event.target.value)} placeholder="Data center"/></label>
          <label>World<input maxLength={60} value={draft.world} onChange={event => update("world", event.target.value)} placeholder="World"/></label>
          {draft.kind === "venue" && <label className="location-wide">Venue address<input required maxLength={240} value={draft.address} onChange={event => update("address", event.target.value)} placeholder="Mist · Ward 12 · Plot 34 / Apartment 5"/></label>}
          <label className="location-zone">Zone / district<input maxLength={120} required value={draft.zone} onChange={event => update("zone", event.target.value)} placeholder="Limsa Lominsa Lower Decks or Mist"/></label>
          <label>X<input type="number" min={0} max={100} step="any" inputMode="decimal" value={draft.x} onChange={event => update("x", event.target.value)} placeholder="9.5"/></label>
          <label>Y<input type="number" min={0} max={100} step="any" inputMode="decimal" value={draft.y} onChange={event => update("y", event.target.value)} placeholder="11.0"/></label>
        </div>
        <div className="location-pin-input"><label>Paste FFXIV map pin (optional)<input value={pin} maxLength={400} onChange={event => {setPin(event.target.value); setNotice("");}} placeholder="Limsa Lominsa Lower Decks ( 9.5, 11.0 )"/></label><button type="button" disabled={!pin.trim()} onClick={usePin}>Use pin</button></div>
        <p className="location-help">In FFXIV, Ctrl + right-click the map, send &lt;flag&gt; in chat, then copy the expanded zone and coordinates here. You can also type them above. The songbook shares pin text; it cannot open the in-game map. <a href="https://na.finalfantasyxiv.com/uiguide/communication/communication-chat/chat_flag.html" target="_blank" rel="noreferrer">Map-pin help ↗</a></p>
        <div className="location-actions"><button type="submit" className="location-publish">{busy ? "Saving…" : "Show location"}</button>{draft.kind === "venue" && <button type="button" onClick={() => void write("save-venue")}>{venueId ? "Update saved venue" : "Save venue"}</button>}{settings.current && <button type="button" onClick={() => void write("hide")}>Hide location</button>}{draft.kind === "venue" && venueId && <button type="button" onClick={() => void write("delete-venue")}>Remove saved venue</button>}</div>
      </fieldset>
      {error && <p className="location-error" role="alert">{error}</p>}{notice && <p className="location-notice" role="status">{notice}</p>}
    </form>}
  </details>;
}
