"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Gamepad2,Trophy,MessageCircle,Gem,PackageCheck} from "lucide-react";
import {useTelegram} from "@/components/layout/TelegramProvider";
import {PlayerBadges} from "@/components/players/PlayerBadges";
import {PlayerAvatar} from "@/components/players/PlayerAvatar";
type Nft={id:string;serialNumber:number;acquiredAt:string;gift:{id:string;name:string;rarity:string;imageUrl:string}};
type Player={id:string;username:string|null;displayName:string;avatar:string|null;xp:number;level:number;gamesPlayed:number;gamesWon:number;winRate:number;isAdmin:boolean;staffRole:string|null;isVerified:boolean;isOnline:boolean;profileFrame:string|null;avatarAnimation:string|null;profileEffect:string|null;nicknameColor:string|null;profileBadge:string|null;profileTitle:string|null;profileBio:string|null;nftOwnerships:Nft[]};
export default function PublicPlayerProfile(){
 const params=useParams<{id:string}>(),{initData}=useTelegram();
 const [player,setPlayer]=useState<Player|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!initData||!params.id)return;fetch("/api/players/"+encodeURIComponent(params.id),{headers:{"x-init-data":initData},cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Ошибка загрузки");setPlayer(d.player);}).catch(e=>setError(e instanceof Error?e.message:"Ошибка сети")).finally(()=>setLoading(false));},[initData,params.id]);
 if(loading)return <div className="min-h-[55vh] grid place-items-center text-white/45">Загрузка профиля...</div>;
 if(error||!player)return <div className="px-4 py-10 max-w-lg mx-auto"><p className="text-red-400">{error||"Игрок не найден"}</p><Link href="/leaderboard" className="text-white/60 text-sm mt-4 inline-block">Вернуться в рейтинг</Link></div>;
 return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
  <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/>К рейтингу</Link>
  <section className="glass rounded-2xl p-5">
   <div className="flex items-center gap-4"><PlayerAvatar name={player.displayName} imageUrl={player.avatar} online={player.isOnline} sizeClassName="h-20 w-20 text-2xl font-black" frame={player.profileFrame} animation={player.avatarAnimation} effect={player.profileEffect}/><div className="min-w-0"><h1 className="text-xl font-bold break-words" style={player.nicknameColor==="amethyst"?{color:"#c4b5fd"}:undefined}>{player.displayName}</h1>{player.profileTitle&&<p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-amber-300">{player.profileTitle}</p>}{player.profileBio&&<p className="mt-2 text-xs leading-relaxed text-white/55">{player.profileBio}</p>}{player.profileBadge==="winner"&&<span className="mt-2 inline-flex rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">🏆 Победитель</span>}{player.username&&<p className="text-sm text-white/40">@{player.username}</p>}<p className="text-xs mt-1 text-white/45">{player.isOnline?"В сети":"Не в сети"}</p><div className="mt-2"><PlayerBadges isAdmin={player.isAdmin} staffRole={player.staffRole} isVerified={player.isVerified}/></div></div></div>
   <Link href={"/messages?with="+encodeURIComponent(player.id)} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black"><MessageCircle size={16}/>Написать сообщение</Link>
   <div className="grid grid-cols-2 gap-3 mt-5"><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/40">Уровень</p><p className="text-2xl font-black text-white">{player.level}</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/40">Опыт</p><p className="text-2xl font-black text-white">{player.xp} XP</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/40 flex gap-1"><Gamepad2 size={13}/>Матчи</p><p className="text-xl font-bold text-white">{player.gamesPlayed}</p></div><div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/40 flex gap-1"><Trophy size={13}/>Победы</p><p className="text-xl font-bold text-white">{player.gamesWon} ({player.winRate}%)</p></div></div>
  </section>
  <section className="glass rounded-2xl p-4 space-y-3">
   <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-white"><Gem size={18} className="text-violet-300"/><h2 className="font-bold">NFT-коллекция</h2></div><span className="text-xs text-white/40">{player.nftOwnerships?.length||0}</span></div>
   {player.nftOwnerships?.length?<div className="grid grid-cols-3 gap-2">{player.nftOwnerships.map(n=><div key={n.id} className="rounded-xl bg-white/5 p-2"><img src={n.gift.imageUrl} alt={n.gift.name} className="w-full aspect-square rounded-lg object-cover"/><p className="mt-2 text-[11px] font-semibold text-white truncate">{n.gift.name}</p><p className="text-[9px] text-white/35">{n.gift.rarity} · #{n.serialNumber}</p></div>)}</div>:<div className="py-7 text-center"><PackageCheck size={24} className="mx-auto text-white/20"/><p className="mt-2 text-xs text-white/35">Пока нет выданных NFT-подарков</p></div>}
  </section>
 </div>;
}
