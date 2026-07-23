"use client";

import { ArrowLeft, CalendarDays, Camera, Download, Globe2, GraduationCap, LoaderCircle, MapPin, Pencil, Save, Trash2, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  id: string; name: string; email: string; avatar_url: string | null; bio: string | null;
  institution: string | null; website_url: string | null; location: string | null;
  skills: string | null; is_admin: boolean;
};
type PostedEvent = {
  id: string; slug: string; title: string; short_description: string; starts_at: string;
  location: string; format: string; banner_url: string | null; categories: { name: string } | { name: string }[];
};

export function AccountScreen() {
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"posts" | "about">("posts");
  const [postedEvents, setPostedEvents] = useState<PostedEvent[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) throw new Error("Please sign in to open your account.");
      const { data: row, error } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (error) throw error;
      const metadata = data.user.user_metadata;
      const resolved = row ? row as Profile : {
        id: data.user.id,
        name: metadata.full_name || metadata.name || data.user.email?.split("@")[0] || "Event Bazar Member",
        email: data.user.email || "",
        avatar_url: metadata.avatar_url || metadata.picture || null,
        bio: null,
        institution: null,
        website_url: null,
        location: null,
        skills: null,
        is_admin: false,
      };
      setProfile(resolved);
      const { data: posts, error: postsError } = await supabase.from("events").select("id,slug,title,short_description,starts_at,location,format,banner_url,categories(name)").eq("creator_id",data.user.id).eq("status","published").order("created_at",{ascending:false});
      if (postsError) throw postsError;
      setPostedEvents((posts ?? []) as PostedEvent[]);
    }).catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const values = new FormData(event.currentTarget);
    const payload = Object.fromEntries(["name","institution","avatar_url","bio","website_url","location","skills"].map(key => [key, String(values.get(key) || "").trim() || null]));
    try {
      const { data:userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Please sign in again.");
      const { data, error } = await supabase.from("profiles").upsert({
        id: userData.user.id,
        email: userData.user.email || "",
        ...payload,
      }).select().single();
      if (error) throw error;
      setProfile(data as Profile); localStorage.setItem("event-bazar-user", JSON.stringify(data)); setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save profile."); }
    finally { setLoading(false); }
  }
  async function uploadAvatar(file: File) {
    if (!profile) return;
    if (!file.type.startsWith("image/")) { setError("Choose a JPG, PNG, WebP, or GIF image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Profile pictures must be 5 MB or smaller."); return; }
    setUploading(true); setError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${profile.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
      if (updateError) throw updateError;
      const next = { ...profile, avatar_url: avatarUrl };
      setProfile(next);
      localStorage.setItem("event-bazar-user", JSON.stringify(next));
      window.dispatchEvent(new Event("event-bazar-auth-changed"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload profile picture.");
    } finally {
      setUploading(false);
    }
  }

  async function updateEvent(event: FormEvent<HTMLFormElement>, item: PostedEvent) {
    event.preventDefault();
    setBusyEventId(item.id); setError("");
    const values = new FormData(event.currentTarget);
    const startsAt = new Date(`${String(values.get("starts_at"))}T00:00:00`);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const changes = {
        title: String(values.get("title") || "").trim(),
        short_description: String(values.get("short_description") || "").trim(),
        starts_at: startsAt.toISOString(),
        location: String(values.get("location") || "").trim() || "Worldwide",
        format: String(values.get("format") || "Online"),
        banner_url: String(values.get("banner_url") || "").trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error: updateError } = await supabase.from("events").update(changes).eq("id", item.id).eq("creator_id", auth.user.id).select("id,slug,title,short_description,starts_at,location,format,banner_url,categories(name)").single();
      if (updateError) throw updateError;
      setPostedEvents(current => current.map(post => post.id === item.id ? data as PostedEvent : post));
      setEditingEventId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this event.");
    } finally { setBusyEventId(null); }
  }

  async function deleteEvent(item: PostedEvent) {
    if (!window.confirm(`Delete “${item.title}”? This also removes its comments, reactions, and saves. This cannot be undone.`)) return;
    setBusyEventId(item.id); setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const { error: deleteError } = await supabase.from("events").delete().eq("id", item.id).eq("creator_id", auth.user.id);
      if (deleteError) throw deleteError;
      setPostedEvents(current => current.filter(post => post.id !== item.id));
      if (editingEventId === item.id) setEditingEventId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this event.");
    } finally { setBusyEventId(null); }
  }

  function downloadText() {
    if (!profile) return;
    const text = [
      "EVENT BAZAR ACCOUNT", `Name: ${profile.name}`, `Email: ${profile.email}`,
      `Varsity/Institute: ${profile.institution || ""}`, `Location: ${profile.location || ""}`,
      `Website: ${profile.website_url || ""}`, `Skills: ${profile.skills || ""}`,
      `Profile picture: ${profile.avatar_url || ""}`, "", "Bio:", profile.bio || "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type:"text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "event-bazar-profile.txt"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="account-page">
    <div className="create-ambient"/>
    <header className="create-nav"><Link href="/"><Logo/></Link><Link href="/"><ArrowLeft/> Back to events</Link></header>
    <section className="account-shell">
      {loading && !profile ? <div className="admin-empty"><LoaderCircle className="spin"/> Loading account…</div> :
       !profile ? <div className="account-required"><UserRound/><h1>Account required</h1><p>{error}</p><Link href="/login">Sign in or create account</Link></div> :
       <><div className="account-cover"><span>Event Bazar creator profile</span></div><div className="account-profile-head social-profile-head">
          <div className="profile-picture">{profile.avatar_url ? <Image src={profile.avatar_url} alt={profile.name} width={164} height={164} unoptimized/> : <UserRound/>}<label className="avatar-upload" title="Upload profile picture"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={change => {const file=change.target.files?.[0];if(file)void uploadAvatar(file);change.target.value="";}}/>{uploading ? <LoaderCircle className="spin"/> : <Camera/>}</label></div>
          <div><small>{profile.is_admin ? "ADMIN ACCOUNT" : "EVENT BAZAR MEMBER"}</small><h1>{profile.name}</h1><p>{profile.email}</p></div>
          <div className="profile-tools"><button onClick={() => setEditing(value => !value)}><Pencil/> {editing ? "Cancel" : "Edit"}</button><button onClick={downloadText}><Download/> TXT</button></div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {!editing && <div className="profile-tabs"><button className={tab==="posts"?"active":""} onClick={()=>setTab("posts")}>Posts</button><button className={tab==="about"?"active":""} onClick={()=>setTab("about")}>About</button></div>}
        {editing ? <form className="profile-form" onSubmit={save}>
          <label><span>Name *</span><input name="name" defaultValue={profile.name} minLength={2} required/></label>
          <label><span>Email</span><input value={profile.email} disabled/></label>
          <label><span>Varsity / institute</span><input name="institution" defaultValue={profile.institution || ""} placeholder="Your university, school, or company"/></label>
          <label><span>Profile picture URL</span><input type="url" name="avatar_url" defaultValue={profile.avatar_url || ""} placeholder="Upload above or enter https://…"/></label>
          <label><span>Location</span><input name="location" defaultValue={profile.location || ""} placeholder="Dhaka, Bangladesh"/></label>
          <label><span>Website</span><input type="url" name="website_url" defaultValue={profile.website_url || ""} placeholder="https://…"/></label>
          <label className="wide"><span>Skills / interests</span><input name="skills" defaultValue={profile.skills || ""} placeholder="CTF, Python, AI, competitive programming"/></label>
          <label className="wide"><span>Bio</span><textarea name="bio" defaultValue={profile.bio || ""} maxLength={1000} rows={5} placeholder="Tell the community about yourself…"/></label>
          <button className="profile-save" disabled={loading}><Save/> {loading ? "Saving…" : "Save profile"}</button>
        </form> : tab === "about" ? <div className="profile-details">
          <div><small>VARSITY / INSTITUTE</small><b>{profile.institution || "Not added"}</b></div><div><small>LOCATION</small><b>{profile.location || "Not added"}</b></div>
          <div><small>SKILLS / INTERESTS</small><b>{profile.skills || "Not added"}</b></div><div><small>WEBSITE</small><b>{profile.website_url || "Not added"}</b></div>
          <article><small>BIO</small><p>{profile.bio || "Add a bio to introduce yourself to the Event Bazar community."}</p></article>
        </div> : <div className="account-feed-layout"><aside className="profile-intro-card"><h2>Intro</h2><p>{profile.bio || "Add a bio to introduce yourself to the Event Bazar community."}</p>{profile.institution&&<span><GraduationCap/>{profile.institution}</span>}{profile.location&&<span><MapPin/>{profile.location}</span>}{profile.website_url&&<a href={profile.website_url} target="_blank" rel="noopener noreferrer"><Globe2/>{profile.website_url}</a>}<b>{postedEvents.length} published {postedEvents.length===1?"event":"events"}</b></aside><section className="account-post-feed"><div className="account-feed-title"><h2>Event posts</h2><Link href="/create-event">+ Add event</Link></div>{postedEvents.length?postedEvents.map(item=>{const category=Array.isArray(item.categories)?item.categories[0]:item.categories;const isEditing=editingEventId===item.id;return <article className="account-event-post" key={item.id}>{item.banner_url&&!isEditing&&<Image src={item.banner_url} alt="" width={700} height={300} unoptimized/>}{isEditing?<form className="account-event-edit" onSubmit={event=>void updateEvent(event,item)}><div className="event-edit-heading"><h3>Edit event</h3><button type="button" onClick={()=>setEditingEventId(null)}><X/> Cancel</button></div><label><span>Title</span><input name="title" defaultValue={item.title} minLength={4} maxLength={180} required/></label><label><span>Short description</span><textarea name="short_description" defaultValue={item.short_description} minLength={20} maxLength={400} rows={4} required/></label><div><label><span>Start date</span><input type="date" name="starts_at" defaultValue={item.starts_at.slice(0,10)} required/></label><label><span>Format</span><select name="format" defaultValue={item.format}><option>Online</option><option>Offline</option><option>Hybrid</option></select></label></div><label><span>Location</span><input name="location" defaultValue={item.location}/></label><label><span>Banner image URL</span><input type="url" name="banner_url" defaultValue={item.banner_url||""}/></label><button className="event-edit-save" disabled={busyEventId===item.id}><Save/>{busyEventId===item.id?"Saving…":"Save changes"}</button></form>:<div><div className="event-owner-actions"><span>{category?.name||"Event"} · {item.format}</span><div><button onClick={()=>setEditingEventId(item.id)}><Pencil/> Edit</button><button className="delete" disabled={busyEventId===item.id} onClick={()=>void deleteEvent(item)}>{busyEventId===item.id?<LoaderCircle className="spin"/>:<Trash2/>} Delete</button></div></div><h3>{item.title}</h3><p>{item.short_description}</p><footer><small><CalendarDays/>{new Date(item.starts_at).toLocaleDateString()}</small><small><MapPin/>{item.location}</small><Link href={`/events/${item.slug}`}>View event</Link></footer></div>}</article>}):<div className="panel-empty"><CalendarDays/><b>No event posts yet</b><p>Events you publish will appear in this profile feed.</p><Link href="/create-event">Create an event</Link></div>}</section></div>}</>}
    </section>
  </main>;
}
