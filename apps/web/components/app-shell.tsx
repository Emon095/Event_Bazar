"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BriefcaseBusiness, Code2, Heart, Home, LogIn, LogOut, MessageCircle, Moon, Plus, Search, ShieldCheck, Sparkles, Sun, UserRound, X, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCommunityEvents, fetchUpcoming } from "@/lib/api";
import { events } from "@/lib/data";
import type { Category } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import { notifyNewEvents } from "@/lib/native";
import { EventCard } from "./event-card";
import { Logo } from "./logo";

type SortMode = "recommended" | "soonest" | "popular";
type AccountSummary = { name: string; email: string; initials: string; avatarUrl: string | null };
type ActivityNotice = { id:string; title:string; body:string; link:string|null; read_at:string|null; created_at:string };

export function AppShell() {
  const [filter, setFilter] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [visible, setVisible] = useState(5);
  const [panel, setPanel] = useState<"notifications" | "account" | "sources" | "interested" | null>(null);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [notifications, setNotifications] = useState<ActivityNotice[]>([]);
  const [supabase] = useState(() => createClient());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const live = useQuery({ queryKey: ["upcoming-events"], queryFn: fetchUpcoming, refetchInterval: 15 * 60_000, retry: 1 });
  const community = useQuery({ queryKey: ["community-events"], queryFn: fetchCommunityEvents, refetchInterval: 60_000, retry: 1 });
  const allEvents = useMemo(() => {
    const liveEvents = live.data?.events.length ? live.data.events : events;
    const communityEvents = community.data ?? [];
    const seen = new Set(communityEvents.map(event => event.id));
    return [...communityEvents, ...liveEvents.filter(event => !seen.has(event.id))];
  }, [community.data, live.data?.events]);
  useEffect(() => {
    if (live.isFetched || community.isFetched) void notifyNewEvents(allEvents);
  }, [allEvents, community.isFetched, live.isFetched]);

  useEffect(() => {
    const saved = localStorage.getItem("event-bazar-theme-v2");
    const next = saved === "dark" || saved === "light" ? saved : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  useEffect(() => {
    const refreshAccount = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAccount(null);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("name,avatar_url").eq("id", user.id).maybeSingle();
      const name = profile?.name || user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0] || "Member";
      setAccount({
        name,
        email: user.email || "",
        initials: name.split(/\s+/).map((word: string) => word[0]).join("").slice(0, 2).toUpperCase(),
        avatarUrl: profile?.avatar_url || user.user_metadata.avatar_url || user.user_metadata.picture || null,
      });
    };
    void refreshAccount();
    window.addEventListener("event-bazar-auth-changed", refreshAccount);
    return () => window.removeEventListener("event-bazar-auth-changed", refreshAccount);
  }, [supabase]);
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const refreshNotifications = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setNotifications([]); return; }
      const { data } = await supabase.from("notifications").select("id,title,body,link,read_at,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(40);
      setNotifications((data??[]) as ActivityNotice[]);
      if (!channel) channel=supabase.channel(`notifications:${auth.user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${auth.user.id}`},refreshNotifications).subscribe();
    };
    void refreshNotifications();
    return ()=>{if(channel)void supabase.removeChannel(channel);};
  },[supabase]);
  const openNotifications = async () => {
    setPanel(panel === "notifications" ? null : "notifications");
    const unread=notifications.filter(item=>!item.read_at).map(item=>item.id);
    if(unread.length) await supabase.from("notifications").update({read_at:new Date().toISOString()}).in("id",unread);
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("event-bazar-user");
    setAccount(null);
    setPanel(null);
  };
  const toggleTheme = () => setTheme(current => {
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("event-bazar-theme-v2", next);
    return next;
  });

  const shown = useMemo(() => {
    const result = allEvents.filter(event => (filter === "All" || event.category === filter) && `${event.title} ${event.organizer} ${event.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "popular") return [...result].sort((a, b) => b.interested - a.interested);
    if (sort === "soonest") return [...result].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    return result;
  }, [allEvents, filter, query, sort]);

  useEffect(() => { setVisible(5); }, [filter, query, sort]);
  useEffect(() => {
    if (!location.hash.startsWith("#event-") || !allEvents.length) return;
    const encodedSlug = location.hash.slice("#event-".length);
    let targetSlug = encodedSlug;
    try {
      targetSlug = decodeURIComponent(encodedSlug);
    } catch {
      // Keep malformed links from crashing the entire client application.
    }
    const targetId = `event-${targetSlug}`;
    const targetIndex = shown.findIndex(event => event.slug === targetSlug);
    if (targetIndex >= 0) setVisible(value => Math.max(value, targetIndex + 1));
    const timer = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    return () => window.clearTimeout(timer);
  }, [allEvents.length, shown]);
  useEffect(() => {
    const refresh = () => setInterestedIds(new Set(allEvents.filter(event => localStorage.getItem(`interested:${event.id}`) === "1").map(event => event.id)));
    refresh();
    window.addEventListener("event-bazar-interest-changed", refresh);
    return () => window.removeEventListener("event-bazar-interest-changed", refresh);
  }, [allEvents]);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(value => Math.min(value + 5, shown.length)), { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown.length]);

  const selectCategory = (value: Category | "All") => { setFilter(value); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="neo-shell">
    <div className="ambient" aria-hidden="true"><i/><i/><i/><i/></div>
    <header className="neo-header">
      <Link href="/create-event" className="mobile-header-create" aria-label="Create an event"><Plus/></Link>
      <Link href="/" aria-label="Event Bazar home"><Logo /></Link>
      <label className="neo-search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search  events, platforms, organizers…"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X/></button>}</label>
      <div className="neo-actions">
        <button onClick={toggleTheme} aria-label="Change color theme">{theme === "dark" ? <Sun/> : <Moon/>}</button>
        <button onClick={() => void openNotifications()} aria-label="Notifications" className="bell"><Bell/>{notifications.some(item=>!item.read_at)&&<i>{notifications.filter(item=>!item.read_at).length}</i>}</button>
        <button onClick={() => void signOut()} aria-label="Log out" title="Log out" className="web-activity"><LogOut/></button>
        <button onClick={() => setPanel(panel === "account" ? null : "account")} aria-label="Account" className="account-orb">{account?.avatarUrl ? <Image src={account.avatarUrl} alt={account.name} width={39} height={39} unoptimized/> : account?.initials || <UserRound/>}</button>
      </div>
    </header>

    <AnimatePresence>{panel && <><motion.button className="panel-scrim" aria-label="Close panel" onClick={() => setPanel(null)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/><motion.aside className="quick-panel" initial={{opacity:0,y:-12,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:.97}}>
      <button className="panel-close" onClick={() => setPanel(null)}><X/></button>
      {panel === "notifications" && <><span className="panel-icon coral"><Bell/></span><h3>Notifications</h3>{notifications.length?notifications.map(item=><Link className={`notice notification-link ${item.read_at?"":"unread"}`} href={item.link||"/"} key={item.id} onClick={()=>setPanel(null)}><i className={item.read_at?"blue":"coral"}/><span><b>{item.title}</b><small>{item.body} · {new Date(item.created_at).toLocaleString()}</small></span></Link>):<div className="panel-empty"><Bell/><b>No notifications yet</b><p>Reactions, interests, comments, replies, and messages will appear here.</p></div>}</>}
      {panel === "account" && (account
        ? <><span className="panel-avatar">{account.avatarUrl ? <Image src={account.avatarUrl} alt={account.name} width={41} height={41} unoptimized/> : account.initials}</span><h3>{account.name}</h3><p>{account.email}</p><Link href="/account" onClick={() => setPanel(null)}>Open account <UserRound/></Link><button className="panel-signout" onClick={() => void signOut()}>Sign out <LogIn/></button></>
        : <><span className="panel-avatar">EB</span><h3>Welcome to Event Bazar</h3><p>Sign in to sync your events across devices, or continue as a guest.</p><Link href="/login" onClick={() => setPanel(null)}>Continue to login <LogIn/></Link></>)}
      {panel === "sources" && <><span className="panel-icon blue"><Zap/></span><h3>Live sources</h3>{Object.entries(live.data?.status ?? {}).map(([name,status]) => <div className="source-row" key={name}><i className={status.ok ? "online" : "offline"}/><b>{name}</b><span>{status.ok ? `${status.count} events` : "Unavailable"}</span></div>)}</>}
      {panel === "interested" && <><span className="panel-icon coral"><Heart/></span><h3>Interested events</h3>{interestedIds.size ? allEvents.filter(event => interestedIds.has(event.id)).map(event => <a className="interest-row" key={event.id} href={event.officialUrl ?? `/events/${event.slug}`} target={event.officialUrl ? "_blank" : undefined} rel={event.officialUrl ? "noopener noreferrer" : undefined}><span>{event.category}</span><b>{event.title}</b><small>{new Date(event.startsAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></a>) : <div className="panel-empty"><Heart/><b>Nothing here yet</b><p>Tap “I’m interested” on an event and it will appear here.</p></div>}</>}
    </motion.aside></>}</AnimatePresence>

    <main className="neo-main">
      <section className="feed-heading" id="event-feed"><div><span>CURATED FOR YOU</span><h2>{filter === "All" ? "Upcoming events" : filter}</h2></div><button className={`source-pill ${live.isError ? "error" : ""}`} onClick={() => setPanel("sources")}><i/>{live.isLoading ? "Connecting" : live.isError ? "Cached mode" : "Live & updated"}</button></section>
      <div className="sort-tabs">{([['recommended','For you'],['soonest','Starting soon'],['popular','Most popular']] as [SortMode,string][]).map(([value,label]) => <button key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)}>{label}</button>)}</div>

      <div className="feed-list">{live.isLoading && <div className="source-skeleton"><i/><i/><i/></div>}{shown.length ? shown.slice(0, visible).map((event, index) => <EventCard key={event.id} event={event} index={index}/>) : <div className="empty"><Search/><h2>No events found</h2><p>Try another search or category.</p></div>}<div ref={loadMoreRef} className="load-more">{visible < shown.length && <><i/><i/><i/></>}</div></div>
    </main>

    <nav className="floating-dock expanded-dock" aria-label="Main menu">
      <div className="dock-categories">
        <button className={filter === "All" ? "active" : ""} onClick={() => selectCategory("All")}><Home/><span>Home</span></button>
        <button className={filter === "CTF" ? "active" : ""} onClick={() => selectCategory("CTF")}><ShieldCheck/><span>CTF</span></button>
        <button className={filter === "Programming" ? "active" : ""} onClick={() => selectCategory("Programming")}><Code2/><span>Code</span></button>
        <button className={filter === "Hackathon" ? "active" : ""} onClick={() => selectCategory("Hackathon")}><Zap/><span>Hack</span></button>
        <button className={filter === "Workshop" ? "active" : ""} onClick={() => selectCategory("Workshop")}><Sparkles/><span>Workshop</span></button>
        <button className={filter === "Career" ? "active" : ""} onClick={() => selectCategory("Career")}><BriefcaseBusiness/><span>Career</span></button>
      </div>
      <div className="dock-actions">
        <Link href="/create-event" className="dock-create"><Plus/><span>Create</span></Link>
        <Link href="/messages"><MessageCircle/><span>Messages</span></Link>
        <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}><span className="dock-theme-icon">{theme === "dark" ? <Sun/> : <Moon/>}</span><span>{theme === "dark" ? "Day" : "Night"}</span></button>
        <button className={panel === "notifications" ? "active" : ""} onClick={() => void openNotifications()}><Bell/>{notifications.some(item=>!item.read_at)&&<i className="dock-count">{notifications.filter(item=>!item.read_at).length}</i>}<span>Alerts</span></button>
        <button className={panel === "interested" ? "active" : ""} onClick={() => setPanel(panel === "interested" ? null : "interested")}><Heart/><i className="dock-count">{interestedIds.size}</i><span>Saved</span></button>
        <Link href="/account"><UserRound/><span>Account</span></Link>
      </div>
    </nav>
  </div>;
}
