"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";
import { MOBILE_AUTH_CALLBACK, isNativeApp } from "@/lib/native";
import { publicPath, SITE_URL } from "@/lib/site";

const AUTH_CALLBACK_URL = `${SITE_URL}/auth/callback/`;

export function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    const authError = new URLSearchParams(location.search).get("error");
    if (authError === "google_not_configured") {
      setError("Google login needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the API environment. Guest mode is ready now.");
    } else if (authError) {
      setError(authError);
    }
  }, []);
  const guest = () => {
    localStorage.setItem("event-bazar-user", JSON.stringify({ id: "guest", name: "Guest Explorer", role: "guest" }));
    router.push("/");
  };
  const supabase = createClient();
  async function google() {
    setError("");
    const native = isNativeApp();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: native ? MOBILE_AUTH_CALLBACK : AUTH_CALLBACK_URL, skipBrowserRedirect: native },
    });
    if (native && data.url) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url });
    }
    if (error) setError(error.message);
  }

  return <main className="login-page">
    <div className="login-grid"/><div className="login-glow one"/><div className="login-glow two"/>
    <nav className="login-nav"><Link href="/"><Logo/></Link><Link href="/"><ArrowLeft/> Back to events</Link></nav>
    <section className="login-shell">
      <div className="login-showcase"><span className="hero-kicker"><i/> YOUR EVENT UNIVERSE</span><h1>One community.<br/><em>Every opportunity.</em></h1><p>Save the events you love, receive reminders, and keep your technology journey in one beautiful place.</p><div className="login-points"><span><CheckCircle2/> Sync interested events</span><span><CheckCircle2/> Personalized discovery</span><span><CheckCircle2/> Community event publishing</span></div><div className="login-logo-art"><span/><Image src={publicPath("/brand/event-bazar-icon.png")} alt="Event Bazar" width={512} height={512} priority/></div></div>
      <div className="login-card"><span className="login-spark"><Sparkles/></span><small>WELCOME TO EVENT BAZAR</small><h2>Continue your journey</h2><p>Choose how you would like to enter. You can connect an account later.</p>
        <button className="google-login" onClick={() => void google()}><span><Mail/></span>Continue with Gmail<ArrowRight/></button>
        <div className="login-divider"><i/>OR<i/></div>
        <button className="guest-login" onClick={guest}><span><UserRound/></span><div><b>Guest login</b><small>Explore immediately without an account</small></div><ArrowRight/></button>
        <Link className="admin-login-link" href="/admin/events"><ShieldCheck/> Admin login <KeyRound/></Link>
        {error && <div className="login-error">{error}</div>}
        <p className="login-terms">By continuing, you agree to our Terms and Community Guidelines.</p>
      </div>
    </section>
  </main>;
}
