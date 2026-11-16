"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, Flag } from "lucide-react";
import { useTelegram } from "@/components/layout/TelegramProvider";

type Player = { userId:string; user:{ firstName:string|null; username:string|null } };
type Message = { id:string; content:string; createdAt:string; user:{id:string;firstName:string|null;username:string|null} };
type Reaction = { id:string; emoji:string; createdAt:string; user:{firstName:string|null;username:string|null} };

export function RoomSocial({roomId,players}:{roomId:string;players:Player[]}) {
  const {initData,user}=useTelegram();
  const [messages,setMessages]=useState<Message[]>([]);
  const [reactions,setReactions]=useState<Reaction[]>([]);
  const [content,setContent]=useState("");
  const [targetId,setTargetId]=useState("");
  const [reason,setReason]=useState("Нарушение правил");
  const [details,setDetails]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    if(!initData)return;
    try{const r=await fetch(`/api/hub?type=chat&roomId=${encodeURIComponent(roomId)}`,{headers:{"x-init-data":initData},cache:"no-store"});const d=await r.json();if(r.ok){setMessages(d.messages||[]);setReactions(d.reactions||[]);}}catch{}
  },[initData,roomId]);
  useEffect(()=>{load();const t=setInterval(load,3000);return()=>clearInterval(t)},[load]);

  const post=async(action:string,extra:Record<string,unknown>)=>{
    if(!initData||busy)return;setBusy(true);setNotice("");
    try{const r=await fetch("/api/hub",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action,roomId,...extra})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Ошибка");if(action==="chat_send"){setContent("");await load();}setNotice(action==="report"?"Жалоба отправлена модерации":"");}
    catch(e){setNotice(e instanceof Error?e.message:"Ошибка сети")}finally{setBusy(false)}
  };

  return <section className="glass rounded-2xl p-4 mt-5 space-y-3">
    <div className="flex items-center gap-2"><MessageCircle size={18} className="text-white/60"/><h2 className="font-semibold text-white">Чат комнаты</h2><span className="text-xs text-white/35 ml-auto">доступен и после игры</span></div>
    <div className="max-h-64 overflow-y-auto space-y-2">
      {messages.length?messages.map(m=><div key={m.id} className="rounded-xl bg-white/5 p-2"><p className="text-[11px] text-white/40">{m.user.firstName||m.user.username||"Игрок"} · {new Date(m.createdAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</p><p className="text-sm text-white/80 break-words">{m.content}</p></div>):<p className="text-xs text-white/35 py-4 text-center">Сообщений пока нет.</p>}
    </div>
    <div className="flex gap-2"><input value={content} onChange={e=>setContent(e.target.value)} maxLength={500} placeholder="Написать сообщение..." className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"/><button onClick={()=>post("chat_send",{content})} disabled={busy||!content.trim()} className="px-3 rounded-xl bg-white text-black disabled:opacity-40"><Send size={16}/></button></div>
    <div className="flex flex-wrap gap-2">{["👍","😂","❤️","🔥","😮","👎"].map(emoji=><button key={emoji} onClick={()=>post("react",{emoji})} disabled={busy} className="rounded-lg bg-white/5 px-3 py-2 text-lg">{emoji}</button>)}</div>
    {reactions.length>0&&<div className="flex flex-wrap gap-1">{reactions.map(r=><span key={r.id} className="rounded-full bg-white/5 px-2 py-1 text-xs">{r.emoji} <span className="text-white/35">{r.user.firstName||r.user.username||"Игрок"}</span></span>)}</div>}
    <details className="pt-2 border-t border-white/10"><summary className="cursor-pointer flex items-center gap-2 text-xs text-white/50"><Flag size={14}/>Пожаловаться на игрока</summary>
      <div className="space-y-2 pt-3"><select value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"><option value="">Выбери игрока</option>{players.filter(p=>p.userId!==user?.id).map(p=><option key={p.userId} value={p.userId}>{p.user.firstName||p.user.username||"Игрок"}</option>)}</select>
      <select value={reason} onChange={e=>setReason(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"><option>Нарушение правил</option><option>Оскорбления</option><option>Спам</option><option>Нечестная игра</option><option>Другое</option></select>
      <textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={1000} placeholder="Подробности (необязательно)" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"/>
      <button onClick={()=>post("report",{targetId,reason,details})} disabled={busy||!targetId} className="w-full rounded-xl bg-red-900/70 py-2 text-sm text-white disabled:opacity-40">Отправить жалобу</button></div>
    </details>
    {notice&&<p className="text-xs text-white/55">{notice}</p>}
  </section>;
}
