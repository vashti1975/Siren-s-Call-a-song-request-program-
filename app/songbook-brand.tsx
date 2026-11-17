"use client";
import {useAppearance} from "./appearance-provider";
export default function SongbookBrand(){
  const {appearance}=useAppearance();
  return <div className="songbook-brand"><img src={appearance.logo||appearance.chibi} alt="" width={72} height={72}/><div><strong>{appearance.title}</strong><p>{appearance.subtitle}</p></div></div>;
}
