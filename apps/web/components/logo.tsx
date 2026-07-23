import Image from "next/image";
import { publicPath } from "@/lib/site";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo"><span className="logo-mark"><Image src={publicPath("/brand/event-bazar-icon.png")} width={38} height={38} alt="Event Bazar" priority /></span>{!compact && <span>Event <span>Bazar</span><small>FIND · JOIN · ENJOY</small></span>}</div>;
}
