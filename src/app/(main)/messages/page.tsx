"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Search, Send, MessageCircle, Ban, ShieldAlert, X } from "lucide-react";

type Person = { id:string; username:string|null; firstName:string|null; photoUrl?:string|null };
type Message = { id:string; senderId:string; recipientId:string; content:string; createdAt:string; sender?:{id:string;firstName:string|null;username:string|null} };
type Conversation = { user:Person; lastMessage:Message; unread:number };

export default function MessagesPage() {
  const { initData, user } = useTelegram();
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [target,setTarget]=useState<Person|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Person[]>([]);
  const [content,setContent]=useState("");
  const [blockedByMe,setBlockedByMe]=useState(false);
  const [blockedMe,setBlockedMe]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const headers={"x-init-data":initData};
  const loadConversations=useCallback(async()=>{
    if(!initData)return;
    const r=await fetch("/api/messages",{headers,cache:"no-store"});
    const d=await r.json();if(r.ok)setConversations(d.conversations||[]);
  },[initData]);

  const loadThread=useCallback(async(id:string)=>{
    if(!initData)return;
    const r=await fetch("/api/messages?with="+encodeURIComponent(id),{headers,cache:"no-store"});
    const d=await r.json();
    if(!r.ok){setError(d.error||"Не удалось открыть диалог");return;}
    setTarget(d.target);setMessages(d.messages||[]);setBlockedByMe(!!d.blockedByMe);setBlockedMe(!!d.blockedMe);setError("");
  },[initData]);

  useEffect(()=>{
    if(!initData)return;
    loadConversations();
    const id=new URLSearchParams(window.location.search).get("with");
    if(id)loadThread(id);
  },[initData,loadConversations,loadThread]);

  useEffect(()=>{
    if(!target||blockedByMe||blockedMe)return;
    const timer=window.setInterval(()=>loadThread(target.id),5000);
    return ()=>window.clearInterval(timer);
  },[target,blockedByMe,blockedMe,loadThread]);

  useEffect(()=>{
    if(query.trim().length<2){setResults([]);return;}
    const timer=window.setTimeout(async()=>{
      try{const r=await fetch("/api/messages?search="+encodeURIComponent(query.trim()),{headers,cache:"no-store"});const d=await r.json();setResults(d.users||[]);}catch{}
    },250);
    return ()=>window.clearTimeout(timer);
  },[query,initData]);

  const open=(p:Person)=>{setTarget(p);setQuery("");setResults([]);setMessages([]);history.replaceState(null,"","/messages?with="+encodeURIComponent(p.id));loadThread(p.id);};
  const send=async()=>{
    if(!target||!content.trim()||busy||blockedByMe||blockedMe)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"send",recipientId:target.id,content:content.trim()})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Не удалось отправить");
      setMessages(old=>[...old,d.message]);setContent("");loadConversations();
    }catch(e){setError(e instanceof Error?e.message:"Ошибка сети");}
    finally{setBusy(false);}
  };
  const block=async(action:"block"|"unblock")=>{
    if(!target)return;
    const r=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action,targetId:target.id})});
    if(r.ok){setBlockedByMe(action==="block");loadConversations();}
  };
  const report=async(m:Message)=>{
    const reason=window.prompt("Почему ты жалуешься на это сообщение?");
    if(!reason||reason.trim().length<5)return;
    const r=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"report",messageId:m.id,reason})});
    const d=await r.json();setError(r.ok?"Жалоба отправлена администрации":d.error||"Ошибка");
  };
  const personName=(p:Person)=>p.firstName||p.username||"Игрок";

  return <div className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-4">
    <div className="flex items-center gap-3"><Link href="/profile" className="rounded-xl bg-white/5 p-2 text-white/60"><ArrowLeft size={18}/></Link><div><h1 className="text-2xl font-black text-white">Личные сообщения</h1><p className="text-xs text-white/40">Переписки игроков GameHub</p></div></div>
    <div className="relative"><Search size={17} className="absolute left-3 top-3.5 text-white/35"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти игрока по нику..." className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm text-white outline-none"/>{query&&<button onClick={()=>setQuery("")} className="absolute right-3 top-3 text-white/40"><X size={17}/></button>}</div>
    {results.length>0&&<div className="glass rounded-xl p-2 space-y-1">{results.map(p=><button key={p.id} onClick={()=>open(p)} className="w-full flex items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5"><div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden grid place-items-center text-white">{p.photoUrl?<img src={p.photoUrl} alt="" className="w-full h-full object-cover"/>:personName(p).slice(0,1)}</div><div><p className="text-sm text-white">{personName(p)}</p><p className="text-xs text-white/40">{p.username?"@"+p.username:"Игрок GameHub"}</p></div></button>)}</div>}
    {!target?<section className="glass rounded-2xl p-3 space-y-2"><div className="flex items-center gap-2 px-2 py-1 text-white/55"><MessageCircle size={17}/><h2 className="text-sm font-semibold">Диалоги</h2></div>{conversations.length?conversations.map(c=><button key={c.user.id} onClick={()=>open(c.user)} className="w-full flex items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"><div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 overflow-hidden grid place-items-center text-white">{c.user.photoUrl?<img src={c.user.photoUrl} alt="" className="w-full h-full object-cover"/>:personName(c.user).slice(0,1)}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{personName(c.user)}</p><p className="text-xs text-white/40 truncate">{c.lastMessage.content}</p></div>{c.unread>0&&<span className="rounded-full bg-primary px-2 py-1 text-[10px] text-white">{c.unread}</span>}</button>):<p className="py-10 text-center text-sm text-white/35">Пока нет диалогов. Найди игрока выше и напиши ему.</p>}</section>:<section className="glass rounded-2xl overflow-hidden flex flex-col min-h-[65vh]">
      <div className="flex items-center gap-3 border-b border-white/10 p-3"><button onClick={()=>{setTarget(null);history.replaceState(null,"","/messages");loadConversations();}} className="text-white/50"><ArrowLeft size={18}/></button><div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden grid place-items-center text-white">{target.photoUrl?<img src={target.photoUrl} alt="" className="w-full h-full object-cover"/>:personName(target).slice(0,1)}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{personName(target)}</p><p className="text-[11px] text-white/40">{target.username?"@"+target.username:"GameHub"}</p></div><button title={blockedByMe?"Разблокировать":"Заблокировать"} onClick={()=>block(blockedByMe?"unblock":"block")} className="p-2 text-white/45"><Ban size={17}/></button></div>
      <div className="flex-1 space-y-2 p-3 overflow-y-auto max-h-[55vh]">{blockedByMe||blockedMe?<div className="rounded-xl bg-amber-500/10 p-4 text-center text-xs text-amber-200">{blockedByMe?"Ты заблокировал этого пользователя.":"Этот пользователь ограничил сообщения."}</div>:messages.map(m=><div key={m.id} className={`flex ${m.senderId===user?.id?"justify-end":"justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.senderId===user?.id?"bg-primary/25 text-white":"bg-white/10 text-white"}`}><p className="text-sm whitespace-pre-wrap break-words">{m.content}</p><div className="mt-1 flex items-center justify-end gap-2"><span className="text-[9px] text-white/35">{new Date(m.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span>{m.senderId!==user?.id&&<button onClick={()=>report(m)} className="text-white/30" title="Пожаловаться"><ShieldAlert size={12}/></button>}</div></div></div>)}</div>
      {!blockedByMe&&!blockedMe&&<div className="flex items-end gap-2 border-t border-white/10 p-3"><textarea value={content} onChange={e=>setContent(e.target.value.slice(0,1000))} rows={1} placeholder="Написать сообщение..." className="min-h-11 max-h-28 flex-1 resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/><button onClick={send} disabled={busy||!content.trim()} className="rounded-xl bg-primary p-3 text-white disabled:opacity-40"><Send size={18}/></button></div>}
    </section>}
    {error&&<p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
    <p className="text-[10px] text-center text-white/25">Не отправляй незнакомым людям личные данные, пароли или платёжные реквизиты. Используй блокировку и жалобы при необходимости.</p>
  </div>;
}
