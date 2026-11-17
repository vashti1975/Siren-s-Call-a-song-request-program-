import { z } from "zod";
import { isOwner, sameOrigin, privateHeaders } from "../../../lib/owner";
import { deleteVenue, locationSettings, playingLocationSchema, saveVenue, setPlayingLocation } from "../../../lib/playing-location-store";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!await isOwner()) return Response.json({error: "Owner access required"}, {status: 403, headers: privateHeaders});
  return Response.json(await locationSettings(), {headers: privateHeaders});
}

export async function POST(request: Request) {
  if (!await isOwner()) return Response.json({error: "Owner access required"}, {status: 403, headers: privateHeaders});
  if (!sameOrigin(request)) return Response.json({error: "Invalid origin"}, {status: 403, headers: privateHeaders});
  let raw; try { raw = await request.json(); } catch { return Response.json({error: "Invalid location"}, {status: 400, headers: privateHeaders}); }
  const parsed = z.discriminatedUnion("action", [
    z.object({action: z.literal("show"), location: playingLocationSchema}),
    z.object({action: z.literal("hide")}),
    z.object({action: z.literal("save-venue"), id: z.string().uuid(), location: playingLocationSchema}),
    z.object({action: z.literal("delete-venue"), id: z.string().uuid()}),
  ]).safeParse(raw);
  if (!parsed.success) return Response.json({error: "Enter a location name, zone, venue address when needed, and both coordinates or neither (0–100)."}, {status: 400, headers: privateHeaders});
  const data = parsed.data;
  if (data.action === "show") await setPlayingLocation(data.location);
  if (data.action === "hide") await setPlayingLocation(null);
  if (data.action === "save-venue") {
    if (data.location.kind !== "venue") return Response.json({error: "Choose Venue to save an address."}, {status: 400, headers: privateHeaders});
    await saveVenue(data.id, data.location);
  }
  if (data.action === "delete-venue") await deleteVenue(data.id);
  return Response.json(await locationSettings(), {headers: privateHeaders});
}
