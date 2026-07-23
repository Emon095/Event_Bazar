"use client";

import { KeyRound, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";

type PublishedEvent = {
  id: string; title: string; short_description: string; starts_at: string;
  organizer_name: string; category_name: string; source: string; created_at: string;
};

export function EventAdmin() {
  const [supabase] = useState(() => createClient());
  const [key, setKey] = useState("");
  const [events, setEvents] = useState<PublishedEvent[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const { data, error } = await supabase.rpc("admin_list_events", { access_key:key });
    if (error) {
      setUnlocked(false);
      setError(error.code === "42501" ? "Invalid admin access key." : `${error.message} Run supabase/admin-key-access.sql if the admin functions are not installed.`);
    } else {
      setEvents((data ?? []) as PublishedEvent[]); setUnlocked(true);
      sessionStorage.setItem("event-bazar-admin-key",key);
    }
    setLoading(false);
  }

  async function remove(eventId: string) {
    if (!window.confirm("Permanently delete this event and all of its comments and reactions?")) return;
    setError("");
    const { data, error } = await supabase.rpc("admin_delete_event", { access_key:key, target_event_id:eventId });
    if (error || !data) { setError(error?.message || "Event was not found."); return; }
    setEvents(current => current.filter(event => event.id !== eventId));
  }

  return <main className="admin-page">
    <div className="create-ambient"/>
    <header className="create-nav"><Link href="/"><Logo/></Link><Link href="/">Back to events</Link></header>
    <section className="admin-shell">
      <div className="admin-title"><small>SUPABASE MODERATION DESK</small><h1>All events</h1><p>Enter the single admin access key to review and delete unusual posts.</p></div>
      <form className="admin-key" onSubmit={unlock}>
        <KeyRound/><input type="password" value={key} onChange={event => setKey(event.target.value)} placeholder="Admin access key" autoComplete="current-password" required/>
        <button disabled={loading}>{loading ? "Checking…" : "Open moderation"}</button>
      </form>
      {error && <div className="form-error">{error}</div>}
      {loading ? <div className="admin-empty"><LoaderCircle className="spin"/> Loading events…</div> :
       unlocked && events.length ? <div className="admin-list">{events.map(event => <article key={event.id}>
          <span>{event.category_name} · {event.source}</span><h2>{event.title}</h2><p>{event.short_description}</p>
          <small>{event.organizer_name} · {new Date(event.starts_at).toLocaleString()}</small>
          <div><span className="admin-warning"><ShieldAlert/> Verify the post before deletion</span><button className="delete" onClick={() => void remove(event.id)}><Trash2/> Delete event</button></div>
        </article>)}</div> :
       unlocked ? <div className="admin-empty">No events are currently stored in Supabase.</div> :
       <div className="admin-empty">Enter the admin key to display all events.</div>}
    </section>
  </main>;
}
