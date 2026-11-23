"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Crown } from "lucide-react";
import { PlayerBadges } from "@/components/players/PlayerBadges";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";

type Entry = { id:string; username:string|null; firstName:string|null; xp:number; level:number; gamesPlayed:number; gamesWon:number; gamesInPeriod?:number; isAdmin:boolean; isVerified:boolean; staffRole?:string|null; photoUrl?:string|null; isOnline?:boolean; profileFrame?:string|null; avatarAnimation?:string|null; profileEffect?:string|null; nicknameColor?:string|null };
const filters = [{id:"all",label:"Общий"},{id:"mafia",label:"Мафия"},{id:"bunker",label:"Бункер"},{id:"spy",label:"Шпион"}];

export default function LeaderboardPage() {
  const { initData } = useTelegram();
  const [items,setItems] = useState<Entry[]>([]);
  const [game,setGame] = useState("all");
  const [season,setSeason] = useState(false);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    if(!initData)return; setLoading(true);
    fetch(`/api/hub?type=leaderboard&game=${game}&season=${season?1:0}`,{headers:{"x-init-data":initData},cache:"no-store"})
      .then(r=>r.json()).then(d=>setItems(d.users||[])).catch(console.error).finally(()=>setLoading(false));
  },[initData,game,season]);
  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/55 mb-5"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3 mb-5"><Crown className="text-yellow-400" size={25}/><div><h1 className="text-2xl font-bold text-white">Рейтинг игроков</h1><p className="text-xs text-white/40">Глобальный топ и рейтинг по играм</p></div></div>
    <div className="flex gap-2 overflow-x-auto pb-2">{filters.map(f=><button key={f.id} onClick={()=>setGame(f.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs ${game===f.id?"bg-white text-black":"bg-white/5 text-white/60"}`}>{f.label}</button>)}</div>
    <button onClick={()=>setSeason(!season)} className={`mb-4 rounded-xl px-3 py-2 text-xs ${season?"bg-amber-400 text-black":"bg-white/5 text-white/60"}`}>{season?"Сезонный рейтинг включён":"Показать сезонный рейтинг"}</button>
    {loading?<p className="text-white/40 text-center py-10">Загрузка...</p>:items.length?<div className="space-y-2">{items.map((p,i)=><Link key={p.id} href={`/players/${p.id}`} className="glass rounded-xl p-3 flex items-center gap-3 active:scale-[.99] transition-transform"><PlayerAvatar name={p.firstName||p.username||"Игрок"} imageUrl={p.photoUrl} online={!!p.isOnline} sizeClassName="h-10 w-10 text-sm font-bold" frame={p.profileFrame} animation={p.avatarAnimation} effect={p.profileEffect}/><div className="w-8 text-center font-black text-white/55">{i===0?<Crown size={20} className="text-yellow-400 mx-auto"/>:i+1}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><p className="font-semibold truncate" style={p.nicknameColor==="amethyst"?{color:"#c4b5fd"}:undefined}>{p.firstName||p.username||"Игрок"} {p.username?<span className="text-white/35 text-xs">@{p.username}</span>:""}</p><PlayerBadges isAdmin={p.isAdmin} staffRole={p.staffRole} isVerified={p.isVerified} /></div><p className="text-xs text-white/40">Уровень {p.level} · {p.gamesWon} побед · {p.gamesInPeriod??p.gamesPlayed} игр</p></div><div className="text-right"><p className="font-bold text-white">{p.xp} XP</p><p className="text-[10px] text-white/35">очки</p></div></Link>)}</div>:<p className="text-white/40 text-center py-10">Пока нет данных для этого рейтинга.</p>}
  </div>;
}
