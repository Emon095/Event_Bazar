"use client";

import { useEffect } from "react";

export default function MobileAuthCallbackPage() {
  useEffect(() => {
    const query = window.location.search || "";
    window.location.replace(`com.eventbazar.app://auth/callback${query}`);
  }, []);

  return <main className="auth-callback-page"><section><h1>Returning to Event Bazar</h1><p>Google sign-in is complete. Opening the app…</p></section></main>;
}
