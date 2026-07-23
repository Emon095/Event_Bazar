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
import { publicPath } from "@/lib/site";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
interface EventComment {
  id: number;
  author_id: string;
  parent_id: number | null;
  body: string;
  created_at: string;
  authorName: string;
}

export function EventCard({ event, index }: { event: EventItem; index: number }) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);
  const [interestCount, setInterestCount] = useState(0);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [replyingTo, setReplyingTo] = useState<EventComment | null>(null);
  const style = categoryStyle[event.category];
  const date = new Date(event.startsAt);
  const href = event.officialUrl ?? `/events/${event.slug}`;
  const external = Boolean(event.officialUrl);
  useEffect(() => {
    setSaved(localStorage.getItem(`saved:${event.id}`) === "1");
    async function refreshEngagement() {
      const [{ data: auth }, { count }, { data: rows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("event_interests").select("*", { count: "exact", head: true }).eq("event_key", event.id),
        supabase.from("event_comments").select("id,author_id,parent_id,body,created_at").eq("event_key", event.id).order("created_at"),
      ]);
      const id = auth.user?.id ?? null;
      setUserId(id);
      setInterestCount(count ?? 0);
      if (id) {
        const [{ data: mine }, { data: saves }] = await Promise.all([
          supabase.from("event_interests").select("event_key").eq("event_key", event.id).eq("user_id", id).maybeSingle(),
          /^[0-9a-f-]{36}$/i.test(event.id)
            ? supabase.from("saved_events").select("event_id").eq("event_id",event.id).eq("user_id",id)
            : Promise.resolve({ data: null }),
        ]);
        setInterested(Boolean(mine));
        if (saves) setSaved(Boolean(saves.length));
      }
      const authorIds = [...new Set((rows ?? []).map(row => row.author_id))];
      const { data: profiles } = authorIds.length
        ? await supabase.from("profiles").select("id,name").in("id", authorIds)
        : { data: [] };
      const names = new Map((profiles ?? []).map(profile => [profile.id, profile.name]));
      setComments((rows ?? []).map(row => ({ ...row, authorName: names.get(row.author_id) ?? "Event Bazar user" })));
    }
    void refreshEngagement();
    const channel = supabase.channel(`engagement:${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_interests", filter: `event_key=eq.${event.id}` }, refreshEngagement)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comments", filter: `event_key=eq.${event.id}` }, refreshEngagement)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [event.id, supabase]);
  const toggleInterested = async () => {
    if (!userId) {
      window.location.href = publicPath("/login");
      return;
    }
    const next = !interested;
    setInterested(next);
    setInterestCount(value => Math.max(0, value + (next ? 1 : -1)));
    const { error } = next
      ? await supabase.from("event_interests").upsert({event_key:event.id,user_id:userId})
      : await supabase.from("event_interests").delete().eq("event_key",event.id).eq("user_id",userId);
    if (error) {
      setInterested(!next);
      setInterestCount(value => Math.max(0, value + (next ? -1 : 1)));
      return;
    }
    localStorage.setItem(`interested:${event.id}`, next ? "1" : "0");
    window.dispatchEvent(new CustomEvent("event-bazar-interest-changed", { detail: { id: event.id, interested: next } }));
    void (next ? scheduleEventReminder(event) : cancelEventReminder(event));
  };
  const toggleSaved = () => setSaved(current => {
    const next = !current; localStorage.setItem(`saved:${event.id}`, next ? "1" : "0");
    if (/^[0-9a-f-]{36}$/i.test(event.id) && userId) void (next
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
      <div className="social-proof"><span><b>{compact.format(interestCount)}</b> interested</span><span className="dot">•</span><span>{comments.length} comments</span></div>
    </div>
    <div className="card-actions">
      <motion.button whileTap={{ scale: .94 }} className={interested ? "active" : ""} onClick={toggleInterested}><Heart fill={interested ? "currentColor" : "none"} /> <span>{interested ? "Interested" : "I'm interested"}</span></motion.button>
      <button className={commenting ? "active-blue" : ""} onClick={() => setCommenting(value => !value)}><MessageCircle /> <span>{commenting ? "Hide comments" : "Comment"}</span></button>
      <button onClick={toggleSaved} className={saved ? "active-blue" : ""}><Bookmark fill={saved ? "currentColor" : "none"} /> <span>{saved ? "Saved" : "Save"}</span></button>
      <button onClick={share}><Share2 /> <span>Share</span></button>
    </div>
    <AnimatePresence>{commenting && <motion.div className="comment-panel" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}>
      {comments.length > 0 && <div className="comment-list">
        {comments.map(item => <div className={`comment-item ${item.parent_id ? "reply" : ""}`} key={item.id}>
          <span className="avatar blue">{item.authorName.split(/\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase()}</span>
          <div><b>{item.authorName}</b><p>{item.body}</p><button type="button" onClick={() => { setReplyingTo(item); setComment(""); }}>Reply</button></div>
        </div>)}
      </div>}
      {replyingTo && <div className="replying-to">Replying to <b>{replyingTo.authorName}</b><button type="button" onClick={() => setReplyingTo(null)}>×</button></div>}
      <form className="quick-comment" onSubmit={async form => {
        form.preventDefault();
        const body = comment.trim();
        if (!userId) { window.location.href = publicPath("/login"); return; }
        if (!body) return;
        const { error } = await supabase.from("event_comments").insert({event_key:event.id,author_id:userId,parent_id:replyingTo?.id ?? null,body});
        if (!error) { setCommentSent(true); setComment(""); setReplyingTo(null); }
      }}><span className="avatar blue">YOU</span><input value={comment} onChange={change => {setComment(change.target.value);setCommentSent(false);}} placeholder={userId ? (replyingTo ? `Reply to ${replyingTo.authorName}…` : "Write a comment…") : "Sign in to comment…"} aria-label="Comment"/><button aria-label="Send comment" disabled={!comment.trim()}>{commentSent ? <Check/> : <Send/>}</button></form>
    </motion.div>}</AnimatePresence>
    <AnimatePresence>{interested && <motion.div className="toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>We’ll remind you before it starts ✨</motion.div>}</AnimatePresence>
  </motion.article>;
}
