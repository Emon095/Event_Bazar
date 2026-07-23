"use client";

import { ArrowLeft, Download, LoaderCircle, Pencil, Save, UserRound } from "lucide-react";
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

export function AccountScreen() {
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) throw new Error("Please sign in to open your account.");
      const { data: row, error } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (error) throw error;
      if (row) {
        setProfile(row as Profile);
        return;
      }
      const metadata = data.user.user_metadata;
      setProfile({
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
      });
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
       <><div className="account-profile-head">
          <div className="profile-picture">{profile.avatar_url ? <Image src={profile.avatar_url} alt={profile.name} width={164} height={164} unoptimized/> : <UserRound/>}</div>
          <div><small>{profile.is_admin ? "ADMIN ACCOUNT" : "EVENT BAZAR MEMBER"}</small><h1>{profile.name}</h1><p>{profile.email}</p></div>
          <div className="profile-tools"><button onClick={() => setEditing(value => !value)}><Pencil/> {editing ? "Cancel" : "Edit"}</button><button onClick={downloadText}><Download/> TXT</button></div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {editing ? <form className="profile-form" onSubmit={save}>
          <label><span>Name *</span><input name="name" defaultValue={profile.name} minLength={2} required/></label>
          <label><span>Email</span><input value={profile.email} disabled/></label>
          <label><span>Varsity / institute</span><input name="institution" defaultValue={profile.institution || ""} placeholder="Your university, school, or company"/></label>
          <label><span>Profile picture URL</span><input type="url" name="avatar_url" defaultValue={profile.avatar_url || ""} placeholder="https://…"/></label>
          <label><span>Location</span><input name="location" defaultValue={profile.location || ""} placeholder="Dhaka, Bangladesh"/></label>
          <label><span>Website</span><input type="url" name="website_url" defaultValue={profile.website_url || ""} placeholder="https://…"/></label>
          <label className="wide"><span>Skills / interests</span><input name="skills" defaultValue={profile.skills || ""} placeholder="CTF, Python, AI, competitive programming"/></label>
          <label className="wide"><span>Bio</span><textarea name="bio" defaultValue={profile.bio || ""} maxLength={1000} rows={5} placeholder="Tell the community about yourself…"/></label>
          <button className="profile-save" disabled={loading}><Save/> {loading ? "Saving…" : "Save profile"}</button>
        </form> : <div className="profile-details">
          <div><small>VARSITY / INSTITUTE</small><b>{profile.institution || "Not added"}</b></div><div><small>LOCATION</small><b>{profile.location || "Not added"}</b></div>
          <div><small>SKILLS / INTERESTS</small><b>{profile.skills || "Not added"}</b></div><div><small>WEBSITE</small><b>{profile.website_url || "Not added"}</b></div>
          <article><small>BIO</small><p>{profile.bio || "Add a bio to introduce yourself to the Event Bazar community."}</p></article>
        </div>}</>}
    </section>
  </main>;
}
