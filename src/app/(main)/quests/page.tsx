"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Gift, Target, Trophy } from "lucide-react";
import { useTelegram } from "@/components/layout/TelegramProvider";

type Quest = { code: string; title: string; description: string; target: number; progress: number; rewardXp: number; rewardCoins: number; completed: boolean; claimed: boolean };

export default function QuestsPage() {
  const { initData } = useTelegram();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!initData) return;
    try {
      const response = await fetch("/api/quests", { headers: { "x-init-data": initData }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить задания");
      setQuests(data.quests || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { load(); }, [load]);

  const claim = async (questCode: string) => {
    if (!initData || busy) return;
    setBusy(questCode);
    setMessage("");
    try {
      const response = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, questCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить награду");
      setMessage("Награда получена: +" + data.rewardXp + " XP и +" + data.rewardCoins + " монет");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-6">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/>Профиль</Link>
      <header className="flex items-center gap-3">
        <div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300"><Target size={24}/></div>
        <div><h1 className="text-2xl font-bold text-white">Ежедневные задания</h1><p className="text-xs text-white/40">Прогресс обновляется каждый день по UTC</p></div>
      </header>
      {loading ? <div className="space-y-3">{[1,2,3].map((item)=><div key={item} className="glass h-32 animate-pulse rounded-2xl"/> )}</div> : (
        <div className="space-y-3">
          {quests.map((quest) => (
            <section key={quest.code} className="glass space-y-3 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/5 p-2 text-amber-300"><Trophy size={19}/></div>
                <div className="min-w-0 flex-1"><h2 className="font-semibold text-white">{quest.title}</h2><p className="mt-1 text-xs text-white/45">{quest.description}</p></div>
                {quest.claimed && <span className="text-emerald-400"><Check size={20}/></span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{width: (quest.progress / quest.target * 100) + "%"}}/></div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/45">{quest.progress}/{quest.target} · +{quest.rewardXp} XP · +{quest.rewardCoins} монет</span>
                <button onClick={() => claim(quest.code)} disabled={!quest.completed || quest.claimed || !!busy} className="flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-35">
                  <Gift size={14}/>{quest.claimed ? "Получено" : busy === quest.code ? "..." : "Забрать"}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {message && <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">{message}</p>}
    </div>
  );
}
