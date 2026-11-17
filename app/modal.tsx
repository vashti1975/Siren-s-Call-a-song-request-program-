"use client";
import { useEffect, useRef, type ReactNode } from "react";
export default function Modal({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
 return <dialog ref={ref} className="song-editor modal-dialog" aria-labelledby={label} onCancel={e=>{e.preventDefault();onClose();}}>{children}</dialog>;
}
