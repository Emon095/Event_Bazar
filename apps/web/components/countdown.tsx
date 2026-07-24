"use client";

import { useEffect, useState } from "react";

function parts(target: string) {
  const left = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left / 3600000) % 24);
  const mins = Math.floor((left / 60000) % 60);
  const secs = Math.floor((left / 1000) % 60);
  return { days, hours, mins, secs };
}

export function Countdown({ target }: { target: string }) {
  const [time, setTime] = useState(() => parts(target));
  useEffect(() => {
    const refresh = () => setTime(parts(target));
    refresh();
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [target]);
  return <div className="countdown" aria-label={`${time.days} days, ${time.hours} hours remaining`}>
    <span><b>{String(time.days).padStart(2,"0")}</b><small>DAYS</small></span><i>:</i>
    <span><b>{String(time.hours).padStart(2,"0")}</b><small>HRS</small></span><i>:</i>
    <span><b>{String(time.mins).padStart(2,"0")}</b><small>MIN</small></span><i>:</i>
    <span><b>{String(time.secs).padStart(2,"0")}</b><small>SEC</small></span>
  </div>;
}
