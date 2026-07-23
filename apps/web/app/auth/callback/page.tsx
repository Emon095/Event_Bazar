"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { SITE_URL } from "@/lib/site";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing Google sign-in…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function complete() {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get("error_description") || params.get("error");
      if (providerError) throw new Error(providerError);

      const code = params.get("code");
      if (!code) throw new Error("Google did not return an authentication code. Please try again.");

      const supabase = createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      if (!data.session?.user) throw new Error("Google sign-in completed without a user session.");

      const user = data.session.user;
      localStorage.setItem("event-bazar-user", JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0],
        avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture || null,
      }));
      if (active) setMessage("Signed in successfully. Opening Event Bazar…");
      window.location.replace(SITE_URL);
    }

    void complete().catch(reason => {
      if (!active) return;
      setFailed(true);
      setMessage(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
    });

    return () => { active = false; };
  }, []);

  return <main className="auth-callback-page">
    <section>
      {failed ? <TriangleAlert/> : <LoaderCircle className="spin"/>}
      <h1>{failed ? "Sign-in problem" : "Signing you in"}</h1>
      <p>{message}</p>
      {failed
        ? <Link href="/login">Return to login</Link>
        : <span><CheckCircle2/> Secure Supabase authentication</span>}
    </section>
  </main>;
}
