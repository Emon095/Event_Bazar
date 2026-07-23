"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { isNativeApp } from "@/lib/native";
import { publicPath } from "@/lib/site";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));
  const [supabase] = useState(() => createClient());
  useEffect(() => {
    if (isNativeApp()) {
      if ("serviceWorker" in navigator) void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(registration => registration.unregister())));
      if ("caches" in window) void caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
      return;
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(publicPath("/sw.js"), { scope: publicPath("/") }).catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    async function restoreAuthentication() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const user = data.session.user;
        localStorage.setItem("event-bazar-user", JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0],
          avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture || null,
        }));
        window.dispatchEvent(new Event("event-bazar-auth-changed"));
      }
    }

    void restoreAuthentication();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user;
        localStorage.setItem("event-bazar-user", JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0],
          avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture || null,
        }));
      } else {
        localStorage.removeItem("event-bazar-user");
      }
      window.dispatchEvent(new Event("event-bazar-auth-changed"));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);
  useEffect(() => {
    if (!isNativeApp()) return;
    let removeListener: (() => Promise<void>) | undefined;
    void import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith("com.eventbazar.app://auth/callback")) return;
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        const providerError = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
        await import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => undefined);
        if (providerError || !code) {
          window.location.replace(publicPath(`/login?error=${encodeURIComponent(providerError || "Google did not return an authorization code.")}`));
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          window.location.replace(publicPath(`/login?error=${encodeURIComponent(error.message)}`));
          return;
        }
        window.location.replace(publicPath("/"));
      });
      removeListener = () => listener.remove();
    });
    return () => { void removeListener?.(); };
  }, [supabase]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
