"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));
  const [supabase] = useState(() => createClient());
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
