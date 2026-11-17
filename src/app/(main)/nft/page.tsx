"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Gem, Crown, Sparkles, LockKeyhole, PackageCheck, Send, X } from "lucide-react";

type Gift={id:string;slug:string;name:string;description:string;rarity:string;imageUrl:string;supply:number|null;issued:number;remaining:number|null};
type Owned={id:string;acquiredAt:string;gift:Gift};
type Order={id:string;status:string;createdAt:string;gift:Gift};
const categories=[
 {id:"ALL",label:"Все подарки",tone:"text-white"},
 {id:"RARE",label:"Rare",tone:"text-sky-300"},
 {id:"EPIC",label:"Epic",tone:"text-violet-300"},
 {id:"MYTHIC",label:"Mythic",tone:"text-amber-300"},
 {id:"LIMITED",label:"Limited",tone:"text-pink-300"}
];
const rarityStyle:Record<string,string>={RARE:"from-sky-500/25 to-blue-950/50 border-sky-300/20",EPIC:"from-violet-500/25 to-purple-950/50 border-violet-300/25",MYTHIC:"from-amber-500/25 to-red-950/50 border-amber-300/25",LIMITED:"from-fuchsia-500/25 to-cyan-950/50 border-fuchsia-300/25"};
const rarityName:Record<string,string>={RARE:"RARE",EPIC:"EPIC",MYTHIC:"MYTHIC",LIMITED:"LIMITED EDITION"};

export default function NftPage(){
 const {initData}=useTelegram();
 const [gifts,setGifts]=useState<Gift[]>([]);
 const [owned,setOwned]=useState<Owned[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [category,setCategory]=useState("ALL");
 const [selected,setSelected]=useState<Gift|null>(null);
 const [note,setNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [contactUrl,setContactUrl]=useState<string|null>(null);
 const [tab,setTab]=useState<"shop"|"collection">("shop");

 const load=async()=>{
  if(!initData)return;
  const r=await fetch("/api/nft",{headers:{"x-init-data":initData},cache:"no-store"});
  const d=await r.json();if(r.ok){setGifts(d.gifts||[]);setOwned(d.owned||[]);setOrders(d.orders||[]);}
 };
 useEffect(()=>{load().catch(console.error);},[initData]);
 const filtered=useMemo(()=>category==="ALL"?gifts:gifts.filter(g=>g.rarity===category),[gifts,category]);
 const request=async()=>{
  if(!selected||!initData||busy)return;
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/nft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"create_order",giftId:selected.id,note})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Не удалось создать заявку");
   setMessage("Заявка №"+d.orderId.slice(-8)+" создана. Владелец получил уведомление в Telegram. Согласуй с ним оплату в личных сообщениях.");
   setContactUrl(d.contactUrl||null);setSelected(null);setNote("");await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Ошибка сети");}
  finally{setBusy(false);}
 };
 const statusLabel:Record<string,string>={PENDING:"Ожидает оплаты / проверки",DELIVERED:"Выдан",CANCELLED:"Отменён"};
 return <div className="max-w-lg mx-auto px-4 pt-6 pb-28 space-y-4">
  <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft size={16}/>Обычный магазин</Link>
  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#17132b] via-[#11101d] to-[#07151e] p-5">
   <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl"/><div className="relative flex items-center gap-3"><div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-violet-200"><Gem size={27}/></div><div><p className="text-[10px] uppercase tracking-[.28em] text-violet-200/70">GameHub collectibles</p><h1 className="text-2xl font-black text-white">NFT Gifts</h1><p className="text-xs text-white/45">Коллекционные подарки с уникальными артами</p></div></div>
   <div className="relative mt-5 grid grid-cols-4 gap-2">{categories.slice(1).map(c=><div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-2 text-center"><p className={`text-[10px] font-black ${c.tone}`}>{c.label}</p><p className="text-[9px] text-white/35">6 gifts</p></div>)}</div>
  </div>
  <div className="grid grid-cols-2 gap-2"><button onClick={()=>setTab("shop")} className={`rounded-xl py-3 text-sm font-semibold ${tab==="shop"?"bg-white text-black":"bg-white/5 text-white/55"}`}>Коллекция магазина</button><button onClick={()=>setTab("collection")} className={`rounded-xl py-3 text-sm font-semibold ${tab==="collection"?"bg-white text-black":"bg-white/5 text-white/55"}`}>Мои подарки · {owned.length}</button></div>
  {tab==="shop"?<>
   <div className="flex gap-2 overflow-x-auto pb-1">{categories.map(c=><button key={c.id} onClick={()=>setCategory(c.id)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${category===c.id?"border-white bg-white text-black":"border-white/10 bg-white/5 text-white/55"}`}>{c.label}</button>)}</div>
   <div className="grid grid-cols-2 gap-3">{filtered.map(g=><article key={g.id} className={`overflow-hidden rounded-2xl border bg-gradient-to-br ${rarityStyle[g.rarity]||"from-white/10 to-black border-white/10"}`}>
    <div className="aspect-square p-2"><img src={g.imageUrl} alt={g.name} className="h-full w-full rounded-xl object-cover"/></div>
    <div className="space-y-2 p-3"><div className="flex items-center justify-between"><span className={`text-[9px] font-black tracking-[.18em] ${categories.find(c=>c.id===g.rarity)?.tone||"text-white"}`}>{rarityName[g.rarity]}</span><Sparkles size={13} className="text-white/45"/></div><h3 className="text-sm font-bold leading-tight text-white">{g.name}</h3><p className="min-h-8 text-[10px] leading-relaxed text-white/45">{g.description}</p>{g.supply!==null&&<p className="text-[10px] text-amber-200/70">Осталось {g.remaining} из {g.supply}</p>}<button onClick={()=>setSelected(g)} className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"><LockKeyhole size={13} className="mr-1 inline"/>Запросить покупку</button></div>
   </article>)}</div>
  </>:<section className="glass rounded-2xl p-4 space-y-3"><h2 className="font-bold text-white">Моя коллекция</h2>{owned.length?owned.map(n=><div key={n.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2"><img src={n.gift.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover"/><div><p className="text-sm font-semibold text-white">{n.gift.name}</p><p className="text-[10px] text-white/40">{rarityName[n.gift.rarity]} · Получен {new Date(n.acquiredAt).toLocaleDateString("ru-RU")}</p></div><PackageCheck size={17} className="ml-auto text-emerald-300"/></div>):<p className="py-10 text-center text-sm text-white/40">Коллекция пока пуста. Запроси свой первый подарок в магазине.</p>}
   {orders.length>0&&<div className="space-y-2 pt-3"><h3 className="text-xs font-semibold text-white/60">Заявки на покупку</h3>{orders.map(o=><div key={o.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><img src={o.gift.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{o.gift.name}</p><p className="text-[10px] text-white/40">{statusLabel[o.status]||o.status}</p></div></div>)}</div>}
  </section>}
  {message&&<div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">{message}{contactUrl&&<a href={contactUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 font-semibold text-primary"><Send size={14}/>Написать владельцу в Telegram</a>}</div>}
  {selected&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4"><div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-[#11111a] shadow-2xl"><div className="flex items-center justify-between p-4"><h2 className="font-bold text-white">Заявка на NFT</h2><button onClick={()=>setSelected(null)} className="text-white/45"><X size={19}/></button></div><img src={selected.imageUrl} alt={selected.name} className="mx-auto h-48 w-48 rounded-2xl object-cover"/><div className="space-y-3 p-4"><div><p className="font-bold text-white">{selected.name}</p><p className="text-xs text-white/45">{selected.description}</p></div><p className="rounded-xl bg-white/5 p-3 text-[11px] text-white/50">Оплата проходит напрямую с владельцем после согласования. В приложении деньги не списываются.</p><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={300} placeholder="Комментарий владельцу (необязательно)" className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none"/><button onClick={request} disabled={busy} className="w-full rounded-xl bg-white py-3 text-sm font-bold text-black disabled:opacity-50">{busy?"Отправляем заявку...":"Отправить заявку"}</button></div></div></div>}
  <p className="text-center text-[10px] text-white/25">Каждый подарок имеет отдельный арт. Выдача происходит после ручного подтверждения владельцем.</p>
 </div>;
}
