"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";

export function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("error") === "google_not_configured") {
      setError("Google login needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the API environment. Guest mode is ready now.");
    }
  }, []);
  const guest = () => {
    localStorage.setItem("event-bazar-user", JSON.stringify({ id: "guest", name: "Guest Explorer", role: "guest" }));
    router.push("/");
  };
  const supabase = createClient();
  async function accountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    const values = new FormData(event.currentTarget);
    const payload = {
      ...(mode === "register" ? { name: String(values.get("name") || "").trim() } : {}),
      email: String(values.get("email") || "").trim().toLowerCase(),
      password: String(values.get("password") || ""),
    };
    try {
      const result = mode === "register"
        ? await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            emailRedirectTo: `${window.location.origin}/login/`,
            data: { name: payload.name, full_name: payload.name },
          },
          })
        : await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
      if (result.error) {
        if (result.error.code === "over_email_send_rate_limit") throw new Error("Supabase email limit reached. Wait a few minutes, or create and auto-confirm the user from Supabase Dashboard → Authentication → Users.");
        if (result.error.code === "email_not_confirmed") throw new Error("Confirm your email address before signing in.");
        if (result.error.code === "invalid_credentials") throw new Error("Incorrect email/password, or the email has not been confirmed.");
        if (result.error.message === "Database error saving new user") {
          throw new Error("Account database setup needs repair. Run supabase/fix-auth-signup.sql in the Supabase SQL Editor, then try again.");
        }
        throw new Error(result.error.message || "Could not create the account.");
      }
      if (mode === "register" && !result.data.session) {
        setNotice("Account created. Open the confirmation email from Supabase, then return here and sign in.");
        setMode("login");
        return;
      }
      localStorage.setItem("event-bazar-user", JSON.stringify({ id:result.data.user?.id, email:payload.email, name:payload.name }));
      router.push("/");
      router.refresh();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message :
        reason && typeof reason === "object" && "message" in reason ? String(reason.message) :
        typeof reason === "string" ? reason :
        "Could not continue. Check the Supabase authentication settings and try again.";
      setError(message);
    }
    finally { setLoading(false); }
  }
  async function google() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:`${location.origin}/` } });
    if (error) setError(error.message);
  }

  return <main className="login-page">
    <div className="login-grid"/><div className="login-glow one"/><div className="login-glow two"/>
    <nav className="login-nav"><Link href="/"><Logo/></Link><Link href="/"><ArrowLeft/> Back to events</Link></nav>
    <section className="login-shell">
      <div className="login-showcase"><span className="hero-kicker"><i/> YOUR EVENT UNIVERSE</span><h1>One community.<br/><em>Every opportunity.</em></h1><p>Save the events you love, receive reminders, and keep your technology journey in one beautiful place.</p><div className="login-points"><span><CheckCircle2/> Sync interested events</span><span><CheckCircle2/> Personalized discovery</span><span><CheckCircle2/> Community event publishing</span></div><div className="login-logo-art"><span/><Image src="/brand/event-bazar-icon.png" alt="Event Bazar" width={512} height={512} priority/></div></div>
      <div className="login-card"><span className="login-spark"><Sparkles/></span><small>WELCOME TO EVENT BAZAR</small><h2>Continue your journey</h2><p>Choose how you would like to enter. You can connect an account later.</p>
        <div className="account-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => {setMode("login");setError("");setNotice("");}}>Sign in</button><button className={mode === "register" ? "active" : ""} onClick={() => {setMode("register");setError("");setNotice("");}}>Create account</button></div>
        <form className="account-form" onSubmit={accountSubmit}>
          {mode === "register" && <label><span><UserRound/></span><input name="name" minLength={2} maxLength={100} placeholder="Full name" autoComplete="name" required/></label>}
          <label><span><Mail/></span><input type="email" name="email" placeholder="Email address" autoComplete="email" required/></label>
          <label><span><LockKeyhole/></span><input type="password" name="password" minLength={8} maxLength={72} placeholder="Password (8+ characters)" autoComplete={mode === "register" ? "new-password" : "current-password"} required/></label>
          <button className="account-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin"/> Please wait…</> : <>{mode === "register" ? "Create account" : "Sign in"} <ArrowRight/></>}</button>
        </form>
        <button className="google-login" onClick={() => void google()}><span><Mail/></span>Continue with Google<ArrowRight/></button>
        <div className="login-divider"><i/>OR<i/></div>
        <button className="guest-login" onClick={guest}><span><UserRound/></span><div><b>Continue as guest</b><small>Explore immediately without an account</small></div><ArrowRight/></button>
        <Link className="admin-login-link" href="/admin/events"><ShieldCheck/> Admin moderation <KeyRound/></Link>
        {notice && <div className="login-notice">{notice}</div>}
        {error && <div className="login-error">{error}</div>}
        <p className="login-terms">By continuing, you agree to our Terms and Community Guidelines.</p>
      </div>
    </section>
  </main>;
}
