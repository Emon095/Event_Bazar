"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ExternalLink, ImagePlus, LoaderCircle, MapPin, Sparkles, UploadCloud } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";

const categories = ["ctf", "programming", "hackathon", "workshop", "career"];
const defaultBanner = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=85";

export function CreateEventForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(defaultBanner);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const slug = useMemo(() => title.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), [title]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const values = new FormData(event.currentTarget);
    const startsAt = new Date(`${starts}T00:00:00`);
    const deadlineAt = new Date(`${deadline}T00:00:00`);
    const endsAt = ends ? new Date(`${ends}T23:59:59`) : null;
    if (!slug) { setError("Please enter a valid event title."); setSubmitting(false); return; }
    if (!deadline || !starts || Number.isNaN(startsAt.valueOf()) || Number.isNaN(deadlineAt.valueOf())) { setError("Choose the registration deadline and event start dates."); setSubmitting(false); return; }
    if (deadlineAt >= startsAt) { setError("Registration must close before the event starts."); setSubmitting(false); return; }
    if (endsAt && (Number.isNaN(endsAt.valueOf()) || endsAt < startsAt)) { setError("Event end date must be the same as or after the start date."); setSubmitting(false); return; }
    const payload = {
      title, slug, short_description: values.get("short_description"),
      description: values.get("description"), category_slug: values.get("category"),
      organizer_name: values.get("organizer"), banner_url: values.get("banner_url") || defaultBanner,
      starts_at: startsAt.toISOString(), registration_deadline: deadlineAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null, registration_url: values.get("registration_url") || null,
      website_url: values.get("website_url") || null, discord_url: values.get("discord_url") || null, prize: values.get("prize") || "Free",
      team_size: values.get("team_size") || "Solo", difficulty: values.get("difficulty"),
      format: values.get("format"), location: values.get("location") || "Worldwide",
    };
    try {
      const { data:auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in before publishing an event.");
      const { data:category, error:categoryError } = await supabase.from("categories").select("id").eq("slug",payload.category_slug).single();
      if (categoryError) throw categoryError;
      const { error:insertError } = await supabase.from("events").insert({
        creator_id:auth.user.id, category_id:category.id, slug:payload.slug, title:payload.title,
        short_description:payload.short_description, description:payload.description,
        organizer_name:payload.organizer_name, banner_url:payload.banner_url,
        starts_at:payload.starts_at, ends_at:payload.ends_at, registration_deadline:payload.registration_deadline,
        registration_url:payload.registration_url, website_url:payload.website_url, discord_url:payload.discord_url,
        prize:payload.prize, team_size:payload.team_size, difficulty:payload.difficulty,
        format:payload.format, location:payload.location, status:"published", source:"community",
      });
      if (insertError) throw insertError;
      router.push(`/?published=${encodeURIComponent(slug)}`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit this event."); }
    finally { setSubmitting(false); }
  }

  return <main className="create-page">
    <div className="create-ambient"/>
    <header className="create-nav"><Link href="/"><Logo/></Link><Link href="/"><ArrowLeft/> Cancel</Link></header>
    <div className="create-layout">
      <aside className="create-intro"><span className="hero-kicker"><i/> COMMUNITY POWERED</span><h1>Share an event worth <em>showing up for.</em></h1><p>Give the community the essentials and publish it instantly.</p><div className="submission-steps"><div className="active"><i>1</i><span><b>Event basics</b><small>Name, organizer and category</small></span></div><div><i>2</i><span><b>Schedule & location</b><small>Choose dates from the calendar</small></span></div><div><i>3</i><span><b>Publish</b><small>Your event goes live immediately</small></span></div></div></aside>
      <form className="event-form" onSubmit={submit}>
        <div className="form-section-title"><span><Sparkles/></span><div><small>STEP 01</small><h2>Tell us about the event</h2></div></div>
        <label className="wide"><span>Event title *</span><input name="title" value={title} onChange={event => setTitle(event.target.value)} minLength={4} maxLength={180} placeholder="e.g. Build for Bangladesh 2026" required/><small>eventbazar.app/events/{slug || "your-event"}</small></label>
        <div className="form-grid"><label><span>Category *</span><select name="category" required>{categories.map(value => <option value={value} key={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label><label><span>Organizer *</span><input name="organizer" minLength={2} maxLength={150} placeholder="Your organization" required/></label></div>
        <label className="wide"><span>Short description *</span><input name="short_description" minLength={20} maxLength={400} placeholder="A concise summary people will see in the feed" required/></label>
        <label className="wide"><span>Full description *</span><textarea name="description" minLength={50} rows={5} placeholder="What will participants experience? Include the important details…" required/></label>

        <div className="form-section-title section-gap"><span><CalendarDays/></span><div><small>STEP 02</small><h2>Schedule and participation</h2></div></div>
        <div className="form-grid three schedule-dates"><label><span>Registration deadline *</span><input type="date" name="deadline" min={today} max={starts || undefined} value={deadline} onChange={event => setDeadline(event.target.value)} required/><small>Registration closes</small></label><label><span>Event starts *</span><input type="date" name="starts_at" min={deadline || today} max={ends || undefined} value={starts} onChange={event => setStarts(event.target.value)} required/><small>First event day</small></label><label><span>Event ends</span><input type="date" name="ends_at" min={starts || today} value={ends} onChange={event => setEnds(event.target.value)}/><small>Optional final day</small></label></div>
        <div className="form-grid three"><label><span>Format</span><select name="format"><option>Online</option><option>Offline</option><option>Hybrid</option></select></label><label><span>Difficulty</span><select name="difficulty"><option>All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label><span>Team size</span><input name="team_size" placeholder="1–4"/></label></div>
        <label className="wide icon-field"><span>Location</span><MapPin/><input name="location" placeholder="Worldwide, Dhaka, or venue name"/></label>

        <div className="form-section-title section-gap"><span><ImagePlus/></span><div><small>STEP 03</small><h2>Links and presentation</h2></div></div>
        <label className="wide"><span>Registration link</span><input type="url" name="registration_url" placeholder="https://…"/></label>
        <div className="form-grid"><label><span>Website</span><input type="url" name="website_url" placeholder="https://…"/></label><label><span>Discord/community link</span><input type="url" name="discord_url" placeholder="https://…"/></label></div>
        <div className="form-grid"><label><span>Prize</span><input name="prize" placeholder="Free, ৳50K, $10,000…"/></label><label><span>Banner image URL</span><input type="url" name="banner_url" placeholder="https://…" onChange={event => setPreview(event.target.value || defaultBanner)}/></label></div>
        <div className="banner-preview"><Image src={preview} alt="Event banner preview" fill sizes="600px" unoptimized onError={() => setPreview(defaultBanner)}/><span><UploadCloud/> Live banner preview</span></div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-submit"><p>By publishing, you confirm that the event details and links are accurate.</p><button disabled={submitting}>{submitting ? <><LoaderCircle className="spin"/> Publishing…</> : <>Publish event <ExternalLink/></>}</button></div>
      </form>
    </div>
  </main>;
}
