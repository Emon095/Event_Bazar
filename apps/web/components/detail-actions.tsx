"use client";
import { Share2 } from "lucide-react";

export function DetailActions() {
  return <div className="detail-actions share-only"><button aria-label="Share event" onClick={()=>navigator.share?.({title:document.title,url:location.href})}><Share2/> Share event</button></div>;
}
