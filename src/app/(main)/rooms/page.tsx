"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { Lock, Plus, RefreshCw, Users, Copy } from "lucide-react";

type RoomItem = { id:string; code:string; name:string|null; players:number; minPlayers:number; maxPlayers:number; createdAt:string };

export default function RoomsPage() {
  const router = useRouter();
  const { initData } = useTelegram();
  const [rooms,setRooms] = useState<RoomItem[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [code,setCode] = useState("");
  const [password,setPassword] = useState("");
  const [name,setName] = useState("");
  const [privateRoom,setPrivateRoom] = useState(false);
  const [roomPassword,setRoomPassword] = useState("");
  const [error,setError] = useState("");

  const load = useCallback(async () => {
    if (!initData) return;
    try {
      const r = await fetch("/api/hub?type=rooms",{headers:{"x-init-data":initData},cache:"no-store"});
      const d = await r.json();
      if (r.ok) setRooms(d.rooms || []); else setError(d.error || "Не удалось загрузить комнаты");
    } catch { setError("Ошибка сети"); } finally { setLoading(false); }
  },[initData]);

  useEffect(()=>{ load(); const t=setInterval(load,7000); return ()=>clearInterval(t); },[load]);

  const create = async () => {
    if (!initData || busy) return;
    setBusy(true); setError("");
    try {
      const r=await fetch("/api/mafia/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"create",name,isPrivate:privateRoom,password:roomPassword})});
      const d=await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось создать комнату");
      router.push("/mafia/"+d.roomId);
    } catch(e) { setError(e instanceof Error?e.message:"Ошибка сети"); } finally { setBusy(false); }
  };

  const join = async (roomCode:string, pass:string) => {
    if (!initData || busy) return;
    setBusy(true); setError("");
    try {
      const r=await fetch("/api/mafia/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"join",code:roomCode,password:pass})});
      const d=await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось войти");
      router.push("/mafia/"+d.roomId);
    } catch(e) { setError(e instanceof Error?e.message:"Ошибка сети"); } finally { setBusy(false); }
  };

  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
    <header><h1 className="text-2xl font-bold text-white">Комнаты</h1><p className="text-sm text-white/45 mt-1">Создавай приватные лобби или присоединяйся к открытым партиям.</p></header>
    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white flex items-center gap-2"><Plus size={18}/>Создать комнату</h2>
      <input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Название комнаты" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/>
      <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={privateRoom} onChange={e=>setPrivateRoom(e.target.checked)}/>Приватная комната (не показывать в списке)</label>
      {privateRoom && <div className="flex items-center gap-2"><Lock size={16} className="text-white/45"/><input value={roomPassword} onChange={e=>setRoomPassword(e.target.value)} minLength={4} maxLength={32} placeholder="Пароль (от 4 символов)" className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/></div>}
      <button onClick={create} disabled={busy || (privateRoom && roomPassword.length>0 && roomPassword.length<4)} className="w-full rounded-xl bg-red-800 py-3 text-white font-semibold disabled:opacity-40">{busy?"Создаём...":"Создать лобби"}</button>
    </section>
    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Войти по коду</h2>
      <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="КОД КОМНАТЫ" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center tracking-widest text-white outline-none"/>
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Пароль, если установлен" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/>
      <button onClick={()=>join(code,password)} disabled={busy || code.length<4} className="w-full rounded-xl bg-white/10 py-3 text-white disabled:opacity-40">Войти в комнату</button>
    </section>
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-white">Открытые комнаты</h2><button onClick={load} className="p-2 text-white/50"><RefreshCw size={16}/></button></div>
      {loading ? <p className="text-center text-sm text-white/40 py-6">Загрузка...</p> : rooms.length ? rooms.map(room=><div key={room.id} className="glass rounded-xl p-3 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-950/60 flex items-center justify-center"><Users size={18} className="text-red-300"/></div><div className="min-w-0 flex-1"><p className="font-medium text-white truncate">{room.name || "Комната Мафии"}</p><p className="text-xs text-white/40">{room.players}/{room.maxPlayers} игроков · код {room.code}</p></div><button onClick={()=>join(room.code,"")} disabled={busy || room.players>=room.maxPlayers} className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white disabled:opacity-40">Войти</button></div>) : <p className="text-center text-sm text-white/40 py-6">Сейчас нет открытых комнат.</p>}
    </section>
    {error && <p className="text-sm text-red-400">{error}</p>}
  </div>;
}
