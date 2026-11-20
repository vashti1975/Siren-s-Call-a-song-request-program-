import { currentPlayingLocation } from "../../../../lib/playing-location-store";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({location: await currentPlayingLocation()}, {headers: {"Cache-Control": "no-store"}});
}
