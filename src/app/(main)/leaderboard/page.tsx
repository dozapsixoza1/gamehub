"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Crown, Trophy } from "lucide-react";

type Entry = { id: string; username: string | null; firstName: string | null; xp: number; level: number; gamesPlayed: number; gamesWon: number };

export default function LeaderboardPage() {
  const { initData } = useTelegram();
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!initData) return;
    fetch("/api/progression", { headers: { "x-init-data": initData }, cache: "no-store" })
      .then(r => r.json()).then(d => setItems(d.leaderboard || []))
      .catch(console.error).finally(() => setLoading(false));
  }, [initData]);
  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/55 mb-5"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3 mb-5"><Crown className="text-yellow-400" size={25}/><div><h1 className="text-2xl font-bold text-white">Рейтинг игроков</h1><p className="text-xs text-white/40">Топ по опыту</p></div></div>
    {loading ? <p className="text-white/40 text-center py-10">Загрузка...</p> : items.length ? <div className="space-y-2">{items.map((p,i) => <div key={p.id} className="glass rounded-xl p-3 flex items-center gap-3"><div className="w-8 text-center font-black text-white/55">{i===0?<Crown size={20} className="text-yellow-400 mx-auto"/>:i+1}</div><div className="min-w-0 flex-1"><p className="font-semibold text-white truncate">{p.firstName || p.username || "Игрок"} {p.username ? <span className="text-white/35 text-xs">@{p.username}</span> : ""}</p><p className="text-xs text-white/40">Уровень {p.level} · {p.gamesWon} побед из {p.gamesPlayed}</p></div><div className="text-right"><p className="font-bold text-white">{p.xp} XP</p><p className="text-[10px] text-white/35">опыт</p></div></div>)}</div> : <p className="text-white/40 text-center py-10">Рейтинг пока пуст</p>}
  </div>;
}
