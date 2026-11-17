import { catalog } from "../../../lib/catalog";
import { currentShow, showStatuses, playingNextSongId } from "../../../lib/show";
import { areRequestsOpen } from "../../../lib/request-settings";
import {showBudget,publicBudget} from "../../../lib/show-budget";
import { currentPlayingLocation } from "../../../lib/playing-location-store";
export const dynamic = "force-dynamic";
export async function GET() {
 const songs=await catalog(),showId=await currentShow();
 const statuses=await showStatuses(songs,showId);
 return Response.json({songs,statuses,playingLocation:await currentPlayingLocation(),playingNextSongId:await playingNextSongId(songs,statuses,showId),requestsOpen:await areRequestsOpen(),showLimit:publicBudget(songs,await showBudget(songs,showId))}, {headers:{"Cache-Control":"no-store"}});
}
