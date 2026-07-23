"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, CalendarDays, Check, Clock3, ExternalLink, Globe2, Heart, MapPin, MessageCircle, MoreHorizontal, Send, Share2, Sparkles, Trophy, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { categoryStyle } from "@/lib/data";
import type { EventItem } from "@/lib/types";
import { Countdown } from "./countdown";
import { createClient } from "@/utils/supabase/client";
import { cancelEventReminder, scheduleEventReminder } from "@/lib/native";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function EventCard({ event, index }: { event: EventItem; index: number }) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);
  const [commentCount, setCommentCount] = useState(event.comments);
  const style = categoryStyle[event.category];
  const date = new Date(event.startsAt);
  const href = event.officialUrl ?? `/events/${event.slug}`;
  const external = Boolean(event.officialUrl);
  const databaseEvent = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.id);
  useEffect(() => {
    setInterested(localStorage.getItem(`interested:${event.id}`) === "1");
    setSaved(localStorage.getItem(`saved:${event.id}`) === "1");
    if (databaseEvent) void supabase.auth.getUser().then(async ({data}) => {
      const id = data.user?.id ?? null; setUserId(id);
      if (!id) return;
      const [{data:reactions},{data:saves},{count}] = await Promise.all([
        supabase.from("event_reactions").select("reaction").eq("event_id",event.id).eq("user_id",id).eq("reaction","interested"),
        supabase.from("saved_events").select("event_id").eq("event_id",event.id).eq("user_id",id),
        supabase.from("comments").select("*",{count:"exact",head:true}).eq("event_id",event.id),
      ]);
      setInterested(Boolean(reactions?.length)); setSaved(Boolean(saves?.length)); setCommentCount(count ?? event.comments);
    });
  }, [databaseEvent, event.comments, event.id, supabase]);
  const toggleInterested = () => setInterested(current => {
    const next = !current;
    localStorage.setItem(`interested:${event.id}`, next ? "1" : "0");
    window.dispatchEvent(new CustomEvent("event-bazar-interest-changed", { detail: { id: event.id, interested: next } }));
    void (next ? scheduleEventReminder(event) : cancelEventReminder(event));
    if (databaseEvent && userId) void (next
      ? supabase.from("event_reactions").upsert({event_id:event.id,user_id:userId,reaction:"interested"})
      : supabase.from("event_reactions").delete().eq("event_id",event.id).eq("user_id",userId).eq("reaction","interested"));
    return next;
  });
  const toggleSaved = () => setSaved(current => {
    const next = !current; localStorage.setItem(`saved:${event.id}`, next ? "1" : "0");
    if (databaseEvent && userId) void (next
      ? supabase.from("saved_events").upsert({event_id:event.id,user_id:userId})
      : supabase.from("saved_events").delete().eq("event_id",event.id).eq("user_id",userId));
    return next;
  });
  const share = async () => {
    const url = external ? href : location.origin + href;
    if (navigator.share) await navigator.share({ title: event.title, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url);
  };

  return <motion.article className={`event-card category-${event.category.toLowerCase()}`} initial={{ opacity: 0, y: 28, scale: .985 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-60px" }} whileHover={{ y: -4 }} transition={{ delay: Math.min(index * .045, .22), duration: .48, ease: "easeOut" }}>
    <div className="card-head">
      <div className={`avatar ${style.color}`}>{event.organizerInitials}</div>
      <div className="organizer"><strong>{event.organizer}</strong><span>{event.location} · <Globe2 size={12} /></span></div>
      <button className="icon-button" aria-label="More options"><MoreHorizontal /></button>
    </div>
    {event.banner ? <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="banner">
      <Image src={event.banner} alt="" fill sizes="(max-width: 720px) 100vw, 650px" priority={index < 2} />
      <div className="banner-shade" />
      {event.featured && <span className="featured"><Sparkles size={13} /> Featured</span>}
      <span className={`category ${style.color}`}>{style.icon} {event.category}</span>
      <div className="date-tile"><b>{date.toLocaleDateString("en", { day: "2-digit" })}</b><span>{date.toLocaleDateString("en", { month: "short" }).toUpperCase()}</span></div>
    </Link> : <div className="no-image-meta"><span className={`category ${style.color}`}>{style.icon} {event.category}</span><span><b>{date.toLocaleDateString("en", { day: "2-digit" })}</b>{date.toLocaleDateString("en", { month: "short" }).toUpperCase()}</span><small>{event.source ?? "Community event"}</small></div>}
    <div className="card-body">
      <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}><h2>{event.title}</h2></Link>
      <p className="description">{event.description}</p>
      <div className="schedule">
        <div><CalendarDays /><span><small>EVENT DATE</small><b>{date.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</b></span></div>
        <div><Clock3 /><span><small>STARTS AT</small><b>{date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })} BST</b></span></div>
        <Countdown target={event.startsAt} />
      </div>
      <div className="fact-row">
        <span><Trophy /> <small>Prize</small><b>{event.prize}</b></span>
        <span><UsersRound /> <small>Team</small><b>{event.teamSize}</b></span>
        <span><Sparkles /> <small>Level</small><b>{event.difficulty}</b></span>
        <span><MapPin /> <small>Format</small><b>{event.format}</b></span>
      </div>
      <div className="tags">{event.tags.map(tag => <span key={tag}>#{tag.replaceAll(" ", "")}</span>)}</div>
      <a className="event-open" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>View official event <ExternalLink/></a>
      <div className="social-proof"><span className="mini-faces"><i>👨🏽‍💻</i><i>👩🏻‍💻</i><i>🧑🏾‍💻</i></span><span><b>{compact.format(event.interested + (interested ? 1 : 0))}</b> interested</span><span className="dot">•</span><span>{commentCount} comments</span></div>
    </div>
    <div className="card-actions">
      <motion.button whileTap={{ scale: .94 }} className={interested ? "active" : ""} onClick={toggleInterested}><Heart fill={interested ? "currentColor" : "none"} /> <span>{interested ? "Interested" : "I'm interested"}</span></motion.button>
      <button className={commenting ? "active-blue" : ""} onClick={() => setCommenting(value => !value)}><MessageCircle /> <span>Comment</span></button>
      <button onClick={toggleSaved} className={saved ? "active-blue" : ""}><Bookmark fill={saved ? "currentColor" : "none"} /> <span>{saved ? "Saved" : "Save"}</span></button>
      <button onClick={share}><Share2 /> <span>Share</span></button>
    </div>
    <AnimatePresence>{commenting && <motion.form className="quick-comment" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} onSubmit={form => {form.preventDefault(); const body=comment.trim(); if(body){ if(databaseEvent && userId) void supabase.from("comments").insert({event_id:event.id,author_id:userId,body}).then(({error}) => {if(!error)setCommentCount(value=>value+1);}); setCommentSent(true);setComment("");}}}><span className="avatar blue">AK</span><input value={comment} onChange={event => {setComment(event.target.value);setCommentSent(false);}} placeholder={databaseEvent && !userId ? "Sign in to comment…" : "Write a comment…"} aria-label="Comment" disabled={databaseEvent && !userId}/><button aria-label="Send comment" disabled={!comment.trim() || (databaseEvent && !userId)}>{commentSent ? <Check/> : <Send/>}</button></motion.form>}</AnimatePresence>
    <AnimatePresence>{interested && <motion.div className="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>We’ll remind you before it starts ✨</motion.div>}</AnimatePresence>
  </motion.article>;
}
