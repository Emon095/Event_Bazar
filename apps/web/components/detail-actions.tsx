"use client";
import { Heart, Share2 } from "lucide-react";
import { useState } from "react";

export function DetailActions() {
  const [active,setActive]=useState(false);
  return <div className="detail-actions"><button className={active?"active":""} onClick={()=>setActive(v=>!v)}><Heart fill={active?"currentColor":"none"}/>{active?"Interested":"I'm interested"}</button><button aria-label="Share" onClick={()=>navigator.share?.({title:document.title,url:location.href})}><Share2/></button></div>;
}

