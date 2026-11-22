"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, History, Trophy, XCircle } from "lucide-react";

type Match = { id: string; gameId: string; result: string; winner: string | null; summary: string | null; playersCount: number; xpEarned: number; coinsEarned: number; playedAt: string };

const gameNames: Record<string,string> = { mafia: "Мафия", bunker: "Бункер", spy: "Шпион" };

export default function HistoryPage() {
  const { initData } = useTelegram();
  const [items, setItems] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!initData) return;
    fetch("/api/progression?view=history", { headers: { "x-init-data": initData }, cache: "no-store" })
      .then(r => r.json()).then(d => setItems(d.history || []))
      .catch(console.error).finally(() => setLoading(false));
  }, [initData]);
  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/55 mb-5"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3 mb-5"><History className="text-white/70" size={24}/><div><h1 className="text-2xl font-bold text-white">История матчей</h1><p className="text-xs text-white/40">Последние 20 игр</p></div></div>
    {loading ? <p className="text-white/40 text-center py-10">Загрузка...</p> : items.length ? <div className="space-y-2">{items.map(m => <div key={m.id} className="glass rounded-xl p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-white">{gameNames[m.gameId] || m.gameId}</p><span className={`text-xs flex items-center gap-1 ${m.result === "WIN" ? "text-emerald-400" : "text-white/45"}`}>{m.result === "WIN" ? <Trophy size={13}/> : <XCircle size={13} />}{m.result === "WIN" ? "Победа" : "Участие"}</span></div><p className="text-xs text-white/40 mt-1">{new Date(m.playedAt).toLocaleString("ru-RU")} · {m.playersCount} игроков</p>{m.summary && <p className="text-sm text-white/65 mt-2">{m.summary}</p>}<p className="text-xs text-amber-300/80 mt-2">+{m.xpEarned} XP · +{m.coinsEarned} монет</p></div>)}</div> : <p className="text-white/40 text-center py-10">Матчей пока нет. Сыграй первую игру!</p>}
  </div>;
}
