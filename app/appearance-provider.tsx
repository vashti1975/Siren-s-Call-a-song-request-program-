"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {defaultAppearance,type Appearance} from "../lib/appearance";
const AppearanceContext=createContext({appearance:defaultAppearance,apply:(_value:Appearance)=>{}});
export const useAppearance=()=>useContext(AppearanceContext);
export default function AppearanceProvider({children}:{children:React.ReactNode}) {
  const [appearance,apply]=useState(defaultAppearance);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch('/api/appearance',{cache:'no-store'});if(response.ok&&active)apply(await response.json() as Appearance);}catch{}};void load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(()=>{
    const style=document.documentElement.style;
    for(const [key,value] of Object.entries({accent:appearance.accent,page:appearance.background,panel:appearance.panel,text:appearance.text}))style.setProperty('--'+key,value);
    document.body.style.backgroundImage=appearance.backgroundImage?`linear-gradient(#0006,#0006),url(${JSON.stringify(appearance.backgroundImage)})`:"none";
    document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';
    document.title=appearance.title;
  },[appearance]);
  return <AppearanceContext.Provider value={{appearance,apply}}>{children}</AppearanceContext.Provider>;
}
