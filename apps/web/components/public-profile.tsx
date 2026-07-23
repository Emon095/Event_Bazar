"use client";

import { ArrowLeft, CalendarDays, Globe2, MapPin, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Logo } from "./logo";

interface Profile {
  id: string; name: string; avatar_url: string | null; bio: string | null;
  institution: string | null; location: string | null; website_url: string | null; skills: string | null;
}
interface PostedEvent {
  id: string; slug: string; title: string; short_description: string; starts_at: string;
  location: string; format: string; categories: { name: string } | { name: string }[];
}

export function PublicProfile() {
  const id = useSearchParams().get("id");
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<PostedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    void Promise.all([
      supabase.from("profiles").select("id,name,avatar_url,bio,institution,location,website_url,skills").eq("id",id).maybeSingle(),
      supabase.from("events").select("id,slug,title,short_description,starts_at,location,format,categories(name)").eq("creator_id",id).eq("status","published").order("starts_at"),
    ]).then(([profileResult,eventResult]) => {
      setProfile(profileResult.data as Profile | null);
      setEvents((eventResult.data ?? []) as PostedEvent[]);
    }).finally(() => setLoading(false));
  }, [id, supabase]);

  return <main className="account-page public-profile-page"><div className="create-ambient"/><header className="create-nav"><Link href="/"><Logo/></Link><Link href="/"><ArrowLeft/> Back to events</Link></header><section className="account-shell">
    {loading ? <div className="admin-empty">Loading profile…</div> : !profile ? <div className="account-required"><UserRound/><h1>Profile not found</h1><Link href="/">Return home</Link></div> : <>
      <div className="public-profile-hero"><div className="profile-picture">{profile.avatar_url ? <Image src={profile.avatar_url} alt={profile.name} width={164} height={164} unoptimized/> : <UserRound/>}</div><div><small>EVENT BAZAR CREATOR</small><h1>{profile.name}</h1><p>{profile.institution || "Community member"}{profile.location ? ` · ${profile.location}` : ""}</p></div></div>
      <div className="public-profile-grid"><article><h2>About</h2><p>{profile.bio || `${profile.name} has not added a bio yet.`}</p>{profile.skills && <div className="profile-skills">{profile.skills.split(",").map(skill => <span key={skill}>{skill.trim()}</span>)}</div>}{profile.website_url && <a href={profile.website_url} target="_blank" rel="noopener noreferrer"><Globe2/> Visit website</a>}</article>
      <section><div className="profile-events-heading"><div><small>POSTED EVENTS</small><h2>{events.length} {events.length === 1 ? "event" : "events"}</h2></div></div>{events.length ? <div className="profile-event-list">{events.map(event => {const category=Array.isArray(event.categories)?event.categories[0]:event.categories;return <Link href={`/events/${event.slug}`} className="profile-event-card" key={event.id}><span>{category?.name || "Event"}</span><h3>{event.title}</h3><p>{event.short_description}</p><div><small><CalendarDays/>{new Date(event.starts_at).toLocaleDateString()}</small><small><MapPin/>{event.location}</small></div></Link>;})}</div> : <p className="no-comments">No published events yet.</p>}</section></div>
    </>}
  </section></main>;
}
