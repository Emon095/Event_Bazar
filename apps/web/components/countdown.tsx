"use client";

import { useEffect, useState } from "react";

function parts(target: string) {
  const left = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left / 3600000) % 24);
  const mins = Math.floor((left / 60000) % 60);
  return { days, hours, mins };
}

export function Countdown({ target }: { target: string }) {
  const [time, setTime] = useState(() => parts(target));
  useEffect(() => { const timer = setInterval(() => setTime(parts(target)), 60000); return () => clearInterval(timer); }, [target]);
  return <div className="countdown" aria-label={`${time.days} days, ${time.hours} hours remaining`}>
    <span><b>{String(time.days).padStart(2,"0")}</b><small>DAYS</small></span><i>:</i>
    <span><b>{String(time.hours).padStart(2,"0")}</b><small>HRS</small></span><i>:</i>
    <span><b>{String(time.mins).padStart(2,"0")}</b><small>MIN</small></span>
  </div>;
}

