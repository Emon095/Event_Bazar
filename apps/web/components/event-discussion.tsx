"use client";

import Image from "next/image";
import { Heart, Pencil, Send, Trash2 } from "lucide-react";
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
  avatarUrl: string | null;
}
type ReactionName = "like" | "love" | "helpful";
type ReactionSummary = Record<ReactionName, number> & { mine: ReactionName[] };

export function EventDiscussion({ eventKey }: { eventKey: string }) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<CommentRow | null>(null);
  const [editBody, setEditBody] = useState("");
  const [reactions, setReactions] = useState<Record<number, ReactionSummary>>({});

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
      ? await supabase.from("profiles").select("id,name,avatar_url").in("id", authorIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
    const mapped = (rows ?? []).map(row => ({
      ...row,
      authorName: profileMap.get(row.author_id)?.name ?? "Event Bazar user",
      avatarUrl: profileMap.get(row.author_id)?.avatar_url ?? null,
    }));
    setComments(mapped);
    const commentIds = mapped.map(row => row.id);
    const { data: reactionRows } = commentIds.length
      ? await supabase.from("event_comment_reactions").select("comment_id,user_id,reaction").in("comment_id", commentIds)
      : { data: [] };
    const summary: Record<number, ReactionSummary> = {};
    for (const row of reactionRows ?? []) {
      const item = summary[row.comment_id] ?? { like: 0, love: 0, helpful: 0, mine: [] };
      const reaction = row.reaction as ReactionName;
      item[reaction] += 1;
      if (row.user_id === id) item.mine.push(reaction);
      summary[row.comment_id] = item;
    }
    setReactions(summary);
  }, [eventKey, supabase]);

  useEffect(() => {
    void refresh();
    const channel = supabase.channel(`detail-engagement:${eventKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_interests", filter: `event_key=eq.${eventKey}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comments", filter: `event_key=eq.${eventKey}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_comment_reactions" }, refresh)
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
  async function deleteComment(item: CommentRow) {
    if (item.author_id !== userId || !window.confirm("Delete this comment and its replies?")) return;
    await supabase.from("event_comments").delete().eq("id", item.id).eq("author_id", userId);
  }
  async function saveEdit() {
    if (!editing || editing.author_id !== userId || !editBody.trim()) return;
    const { error } = await supabase.from("event_comments").update({body:editBody.trim(),updated_at:new Date().toISOString()}).eq("id",editing.id).eq("author_id",userId);
    if (!error) { setEditing(null); setEditBody(""); }
  }
  async function toggleReaction(commentId: number, reaction: ReactionName) {
    if (!userId) { window.location.href = publicPath("/login"); return; }
    const active = reactions[commentId]?.mine.includes(reaction);
    if (active) await supabase.from("event_comment_reactions").delete().eq("comment_id",commentId).eq("user_id",userId).eq("reaction",reaction);
    else await supabase.from("event_comment_reactions").upsert({comment_id:commentId,user_id:userId,reaction});
  }

  return <section className="event-discussion">
    <div className="discussion-heading"><div><h2>Community discussion</h2><span>{interestCount} interested · {comments.length} comments</span></div><button className={interested ? "active" : ""} onClick={toggleInterest}><Heart fill={interested ? "currentColor" : "none"}/>{interested ? "Interested" : "I'm interested"}</button></div>
    <div className="comment-list">
      {(showAll ? comments : comments.slice(0, 3)).map(item => <div className={`comment-item ${item.parent_id ? "reply" : ""}`} key={item.id}>
        <span className="avatar blue">{item.avatarUrl ? <Image src={item.avatarUrl} alt="" width={32} height={32} unoptimized/> : item.authorName.split(/\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase()}</span>
        <div><b>{item.authorName}</b>{editing?.id === item.id ? <div className="comment-edit"><input value={editBody} onChange={change => setEditBody(change.target.value)}/><button type="button" onClick={saveEdit}>Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div> : <p>{item.body}</p>}
          <div className="comment-controls"><button type="button" onClick={() => setReplyTo(item)}>Reply</button>{item.author_id === userId && <><button type="button" onClick={() => {setEditing(item);setEditBody(item.body);}}><Pencil/> Edit</button><button type="button" className="danger" onClick={() => deleteComment(item)}><Trash2/> Delete</button></>}</div>
          <div className="comment-reactions"><button type="button" className={reactions[item.id]?.mine.includes("like") ? "active" : ""} onClick={() => toggleReaction(item.id,"like")}>👍 {reactions[item.id]?.like || ""}</button><button type="button" className={reactions[item.id]?.mine.includes("love") ? "active" : ""} onClick={() => toggleReaction(item.id,"love")}>❤️ {reactions[item.id]?.love || ""}</button><button type="button" className={reactions[item.id]?.mine.includes("helpful") ? "active" : ""} onClick={() => toggleReaction(item.id,"helpful")}>💡 {reactions[item.id]?.helpful || ""}</button></div>
        </div>
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
