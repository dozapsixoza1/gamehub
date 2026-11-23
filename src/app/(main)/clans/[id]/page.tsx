"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Shield, Users, Crown, CalendarDays, LogOut, UserPlus, Trophy } from "lucide-react";

type Member={id:string;role:string;joinedAt:string;name:string;username:string|null;avatar:string|null;level:number;staffRole:string|null;nicknameColor:string|null};
type Clan={id:string;name:string;tag:string;description:string|null;avatarUrl:string|null;bannerUrl:string|null;createdAt:string;memberCount:number;owner:{id:string;firstName:string|null;username:string|null};members:Member[]};
export default function ClanProfilePage(){
 const params=useParams<{id:string}>(),router=useRouter(),{initData}=useTelegram();
 const [clan,setClan]=useState<Clan|null>(null),[myRole,setMyRole]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=()=>{if(!initData||!params.id)return;fetch("/api/clans/"+encodeURIComponent(params.id),{headers:{"x-init-data":initData},cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Клан не найден");setClan(d.clan);setMyRole(d.myRole);}).catch(e=>setError(e instanceof Error?e.message:"Ошибка загрузки")).finally(()=>setLoading(false));};
 useEffect(()=>{load();},[initData,params.id]);
 const action=async(actionName:"join"|"leave")=>{if(!initData||!clan)return;setBusy(true);setError("");try{const r=await fetch("/api/clans/"+clan.id,{method:"POST",headers:{"Content-Type":"application/json","x-init-data":initData},body:JSON.stringify({action:actionName})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Не удалось выполнить действие");load();}catch(e){setError(e instanceof Error?e.message:"Ошибка");}finally{setBusy(false);}};
 if(loading)return <div className="grid min-h-[50vh] place-items-center text-white/40">Загружаем клан...</div>;
 if(!clan)return <main className="mx-auto max-w-lg px-4 py-8 text-white"><p className="text-red-400">{error||"Клан не найден"}</p><Link href="/clans" className="mt-4 inline-flex text-sm text-white/60">← К списку кланов</Link></main>;
 return <main className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-6 text-white">
  <Link href="/clans" className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft size={16}/>Все кланы</Link>
  <section className="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/20 via-[#171526] to-[#11111a] p-5">
   {clan.bannerUrl&&<img src={clan.bannerUrl} className="absolute inset-0 h-full w-full object-cover opacity-20"/>}
   <div className="relative flex items-center gap-4">{clan.avatarUrl?<img src={clan.avatarUrl} className="h-20 w-20 rounded-2xl border border-white/15 object-cover"/>:<div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-violet-200"><Shield size={34}/></div>}<div className="min-w-0"><div className="mb-1 inline-flex rounded-lg bg-violet-300/15 px-2 py-1 text-xs font-black tracking-widest text-violet-200">[{clan.tag}]</div><h1 className="break-words text-2xl font-black">{clan.name}</h1><p className="mt-1 text-xs text-white/45">Клан GameHub</p></div></div>
   {clan.description&&<p className="relative mt-4 text-sm leading-relaxed text-white/65">{clan.description}</p>}
   <div className="relative mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35"><Users size={12}/>Участники</p><p className="mt-1 text-xl font-black">{clan.memberCount}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35"><CalendarDays size={12}/>Создан</p><p className="mt-1 text-sm font-bold">{new Date(clan.createdAt).toLocaleDateString("ru-RU")}</p></div></div>
   <div className="relative mt-4 flex items-center gap-2 rounded-xl bg-black/20 p-3"><Crown size={16} className="text-amber-300"/><div><p className="text-[10px] text-white/35">Лидер клана</p><p className="text-sm font-bold">{clan.owner.firstName||clan.owner.username||"Игрок"}</p></div></div>
   {myRole?<button disabled={busy||myRole==="LEADER"} onClick={()=>action("leave")} className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold disabled:opacity-40"><LogOut size={16}/>{myRole==="LEADER"?"Ты лидер клана":"Покинуть клан"}</button>:<button disabled={busy} onClick={()=>action("join")} className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-300 py-3 text-sm font-black text-black disabled:opacity-50"><UserPlus size={16}/>{busy?"Подождите...":"Вступить в клан"}</button>}
  </section>
  <section className="rounded-2xl border border-white/8 bg-white/[.03] p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Состав клана</h2><span className="text-xs text-white/35">{clan.members.length} игроков</span></div><div className="space-y-2">{clan.members.map(m=><Link key={m.id} href={"/players/"+m.id} className="flex items-center gap-3 rounded-xl bg-white/[.035] p-2.5">{m.avatar?<img src={m.avatar} className="h-10 w-10 rounded-full object-cover"/>:<div className="grid h-10 w-10 place-items-center rounded-full bg-white/10">{m.name.slice(0,1)}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold" style={m.nicknameColor==="amethyst"?{color:"#c4b5fd"}:undefined}>{m.name}</p><p className="text-[10px] text-white/35">Уровень {m.level}{m.staffRole?" · Сотрудник GameHub":""}</p></div><span className={`rounded-lg px-2 py-1 text-[9px] font-black ${m.role==="LEADER"?"bg-amber-300/15 text-amber-200":"bg-white/5 text-white/45"}`}>{m.role==="LEADER"?"ЛИДЕР":m.role==="OFFICER"?"ОФИЦЕР":"УЧАСТНИК"}</span></Link>)}</div></section>
  {error&&<p className="text-xs text-red-400">{error}</p>}
 </main>;
}
