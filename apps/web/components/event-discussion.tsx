"use client";

import { Heart, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { publicPath } from "@/lib/site";

interface CommentRow {
  id: number;
  author_id: string;
  parent_id: number | null;
  body: string;
  created_at: string;
  authorName: string;
}

export function EventDiscussion({ eventKey }: { eventKey: string }) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: auth }, { count }, { data: rows }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("event_interests").select("*", { count: "exact", head: true }).eq("event_key", eventKey),
      supabase.from("event_comments").select("id,author_id,parent_id,body,created_at").eq("event_key", eventKey).order("created_at"),
    ]);
    const id = auth.user?.id ?? null;
    setUserId(id);
    setInterestCount(count ?? 0);
    if (id) {
      const { data } = await supabase.from("event_interests").select("event_key").eq("event_key", eventKey).eq("user_id", id).maybeSingle();
      setInterested(Boolean(data));
    }
    const authorIds = [...new Set((rows ?? []).map(row => row.author_id))];
    const { data: profiles } = authorIds.length
      ? await supabase.from("profiles").select("id,name").in("id", authorIds)
      : { data: [] };
    const names = new Map((profiles ?? []).map(profile => [profile.id, profile.name]));
    setComments((rows ?? []).map(row => ({ ...row, authorName: names.get(row.author_id) ?? "Event Bazar user" })));
  }, [eventKey, supabase]);

  useEffect(() => {
    void refresh();
    const channel = supabase.channel(`detail-engagement:${eventKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_interests", filter: `event_key=eq.${eventKey}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comments", filter: `event_key=eq.${eventKey}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventKey, refresh, supabase]);

  async function toggleInterest() {
    if (!userId) { window.location.href = publicPath("/login"); return; }
    const next = !interested;
    setInterested(next);
    setInterestCount(value => Math.max(0, value + (next ? 1 : -1)));
    const { error } = next
      ? await supabase.from("event_interests").upsert({ event_key: eventKey, user_id: userId })
      : await supabase.from("event_interests").delete().eq("event_key", eventKey).eq("user_id", userId);
    if (error) {
      setInterested(!next);
      setInterestCount(value => Math.max(0, value + (next ? -1 : 1)));
    }
  }

  return <section className="event-discussion">
    <div className="discussion-heading"><div><h2>Community discussion</h2><span>{interestCount} interested · {comments.length} comments</span></div><button className={interested ? "active" : ""} onClick={toggleInterest}><Heart fill={interested ? "currentColor" : "none"}/>{interested ? "Interested" : "I'm interested"}</button></div>
    <div className="comment-list">
      {(showAll ? comments : comments.slice(0, 3)).map(item => <div className={`comment-item ${item.parent_id ? "reply" : ""}`} key={item.id}>
        <span className="avatar blue">{item.authorName.split(/\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase()}</span>
        <div><b>{item.authorName}</b><p>{item.body}</p><button type="button" onClick={() => setReplyTo(item)}>Reply</button></div>
      </div>)}
      {!comments.length && <p className="no-comments">No comments yet. Start the conversation.</p>}
      {comments.length > 3 && <button className="see-comments" type="button" onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer comments" : `See all ${comments.length} comments`}</button>}
    </div>
    {replyTo && <div className="replying-to">Replying to <b>{replyTo.authorName}</b><button type="button" onClick={() => setReplyTo(null)}>×</button></div>}
    <form className="comment-box" onSubmit={async submit => {
      submit.preventDefault();
      if (!userId) { window.location.href = publicPath("/login"); return; }
      if (!body.trim()) return;
      const { error } = await supabase.from("event_comments").insert({event_key:eventKey,author_id:userId,parent_id:replyTo?.id ?? null,body:body.trim()});
      if (!error) { setBody(""); setReplyTo(null); }
    }}><input value={body} onChange={change => setBody(change.target.value)} placeholder={userId ? (replyTo ? `Reply to ${replyTo.authorName}…` : "Ask a question or join the conversation…") : "Sign in to comment…"}/><button disabled={!body.trim()}><Send/> Send</button></form>
  </section>;
}
