import type {StickerPlacement} from './listener-stickers';
export type ListenerAward = {id:string;title:string;milestone:number;kind:"chibi";artwork?:string;noteCost?:number};
export const stickerCollectionThrough=100;
const sayings = ["Your Amazing", "You Rock!", "Encore, Please!", "Music Magic!", "Request Royalty", "Keep Rocking!", "Perfect Harmony", "Crowd Favorite", "Born to Bard", "Songbook Superstar", "You Bring the Vibes", "Legendary Listener", "Turn It Up!", "Heart of the Music", "Standing Ovation", "Melody Maker", "Rock On!", "Music Is Your Magic", "The Encore Is Yours", "Songbook Legend"];
export function requestAward(milestone:number):ListenerAward {
 return {id:`request:${milestone}`,kind:"chibi",milestone,title:milestone===1?"Great Choice":sayings[milestone/5-1]||`Shining at ${milestone}!`};
}
export function requestAwards(total:number):ListenerAward[] {
 if(total<1)return [];
 return [requestAward(1),...Array.from({length:Math.floor(total/5)},(_,i)=>requestAward((i+1)*5))];
}
export function nextRequestMilestone(total:number){return total<1?1:(Math.floor(total/5)+1)*5;}
export const listenerThemes=["ocean","amethyst","ember"] as const;
export type ListenerProfileData={
 signedIn:boolean;enabled:boolean;
 profile?:{name:string;theme:typeof listenerThemes[number];featured:string[];placements:StickerPlacement[]};
 favorites:string[];totalRequests:number;noteCount:number;nextMilestone:number;
 songCounts:{songId:string;title:string;artist:string;requests:number;played:number}[];
 awards:ListenerAward[];
 ownedSpecialRewards?:string[];
 collectionUnlocked?:boolean;
};
