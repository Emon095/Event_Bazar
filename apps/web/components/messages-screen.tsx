"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MessageCircle, Search, Send, UserRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "./logo";
import { createClient } from "@/utils/supabase/client";

type Member = { id:string; name:string; avatar_url:string|null };
type Message = { id:number; sender_id:string; recipient_id:string; body:string; read_at:string|null; created_at:string };

export function MessagesScreen() {
  const [supabase] = useState(()=>createClient());
  const [me,setMe] = useState<string|null>(null);
  const [members,setMembers] = useState<Member[]>([]);
  const [messages,setMessages] = useState<Message[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [query,setQuery] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  const refresh = useCallback(async(userId:string)=>{
    const [{data:people},{data:rows}] = await Promise.all([
      supabase.from("profiles").select("id,name,avatar_url").neq("id",userId).order("name"),
      supabase.from("direct_messages").select("*").or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order("created_at"),
    ]);
    setMembers((people??[]) as Member[]); setMessages((rows??[]) as Message[]);
  },[supabase]);

  useEffect(()=>{supabase.auth.getUser().then(async({data})=>{
    if(!data.user){setError("Sign in to message Event Bazar members.");return;}
    setMe(data.user.id);
    const requested=new URLSearchParams(location.search).get("with"); if(requested)setSelected(requested);
    await refresh(data.user.id);
    const channel=supabase.channel(`messages:${data.user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"direct_messages"},()=>void refresh(data.user!.id)).subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  }).finally(()=>setLoading(false));},[refresh,supabase]);

  const conversations=useMemo(()=>members.map(member=>{
    const thread=messages.filter(row=>(row.sender_id===me&&row.recipient_id===member.id)||(row.sender_id===member.id&&row.recipient_id===me));
    return {member,last:thread.at(-1),unread:thread.filter(row=>row.recipient_id===me&&!row.read_at).length};
  }).filter(item=>item.last||item.member.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>+(new Date(b.last?.created_at||0))-+(new Date(a.last?.created_at||0))),[me,members,messages,query]);
  const active=members.find(member=>member.id===selected);
  const thread=messages.filter(row=>(row.sender_id===me&&row.recipient_id===selected)||(row.sender_id===selected&&row.recipient_id===me));

  async function choose(id:string){setSelected(id);if(me)await supabase.from("direct_messages").update({read_at:new Date().toISOString()}).eq("sender_id",id).eq("recipient_id",me).is("read_at",null);}
  async function send(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!me||!selected)return;const form=event.currentTarget;const body=String(new FormData(form).get("body")||"").trim();if(!body)return;const {error:sendError}=await supabase.from("direct_messages").insert({sender_id:me,recipient_id:selected,body});if(sendError)setError(sendError.message);else form.reset();}
  const avatar=(member:Member,size:number)=>member.avatar_url?<Image src={member.avatar_url} alt={member.name} width={size} height={size} unoptimized/>:<UserRound/>;

  return <main className="messages-page"><header className="messages-nav"><Link href="/"><ArrowLeft/></Link><Logo/><span/></header><section className="messages-shell">
    <aside className={`chat-list ${selected?"has-selection":""}`}><h1>Messages</h1><label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search members"/></label>
      {loading?<LoaderCircle className="spin"/>:error&&!me?<div className="chat-empty"><MessageCircle/><p>{error}</p><Link href="/login">Sign in</Link></div>:conversations.map(({member,last,unread})=><button className={selected===member.id?"active":""} onClick={()=>void choose(member.id)} key={member.id}><span>{avatar(member,46)}</span><div><b>{member.name}</b><small>{last?.body||"Start a conversation"}</small></div>{unread>0&&<i>{unread}</i>}</button>)}
    </aside><section className={`chat-thread ${!selected?"empty":""}`}>{!active?<div className="chat-empty"><MessageCircle/><h2>Your messages</h2><p>Select a member to start a private realtime chat.</p></div>:<><header><button onClick={()=>setSelected(null)}><ArrowLeft/></button><span>{avatar(active,42)}</span><div><b>{active.name}</b><small>Event Bazar member</small></div></header><div className="chat-messages">{thread.map(row=><div className={row.sender_id===me?"mine":"theirs"} key={row.id}><p>{row.body}</p><small>{new Date(row.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small></div>)}</div><form onSubmit={send}><input name="body" placeholder={`Message ${active.name}…`} autoComplete="off"/><button aria-label="Send"><Send/></button></form></>}</section>
  </section></main>;
}
