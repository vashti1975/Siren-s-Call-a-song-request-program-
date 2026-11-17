import { isOwner } from "../lib/owner";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import Home from "./songbook-client";
import SongbookBrand from "./songbook-brand";
export const dynamic = "force-dynamic";
export default async function Page() {
 if(await isOwner()) return <Home/>;
 const user=await getChatGPTUser();
 return <main className="access-page"><SongbookBrand/><h1>Private songbook</h1><p>{user?"Song editing and request totals are available only to the songbook owner.":"Sign in to manage your songs and view your private request totals."}</p>{!user&&<a className="primary-button" href={chatGPTSignInPath("/")} target="_top">Owner sign in</a>}<a href="/requests">Browse songs & request a song →</a></main>;
}
