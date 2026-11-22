"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Award, CalendarDays, Crown, Trophy } from "lucide-react";
import { useTelegram } from "@/components/layout/TelegramProvider";

type Entry = { id: string; username: string | null; firstName: string | null; xp: number; level: number; gamesInPeriod?: number };

export default function SeasonsPage() {
  const { initData, user } = useTelegram();
  const [items, setItems] = useState<Entry[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!initData) return;
    try {
      const response = await fetch("/api/hub?type=leaderboard&game=all&season=1", { headers: { "x-init-data": initData }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка загрузки");
      setItems(data.users || []);
      setSeason(data.season || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { load(); }, [load]);

  const action = async (actionName: string, extra: Record<string, unknown> = {}) => {
    if (!initData || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action: actionName, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка");
      setMessage("Готово");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-6">
      <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/>Рейтинг</Link>
      <header className="flex items-center gap-3"><div className="rounded-2xl bg-amber-400/10 p-3 text-amber-300"><Trophy size={24}/></div><div><h1 className="text-2xl font-bold text-white">Сезон GameHub</h1><p className="text-xs text-white/40">Соревнуйся за место в сезонном топе</p></div></header>
      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2"><CalendarDays size={17} className="text-amber-300"/><h2 className="font-semibold text-white">{season?.name || "Сезон не найден"}</h2></div>
        {season ? <p className="mt-2 text-xs text-white/45">{new Date(season.startsAt).toLocaleDateString("ru-RU")} — {new Date(season.endsAt).toLocaleDateString("ru-RU")} · {season.isActive ? "Активен" : "Завершён"}</p> : <p className="mt-2 text-xs text-white/45">Новый сезон появится после запуска администрацией.</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/5 p-3"><Award size={17} className="mx-auto text-amber-300"/><p className="mt-1 text-[10px] text-white/40">1 место</p><p className="text-xs font-bold text-white">500 XP</p></div><div className="rounded-xl bg-white/5 p-3"><Award size={17} className="mx-auto text-slate-300"/><p className="mt-1 text-[10px] text-white/40">2–3 место</p><p className="text-xs font-bold text-white">250 XP</p></div><div className="rounded-xl bg-white/5 p-3"><Award size={17} className="mx-auto text-orange-300"/><p className="mt-1 text-[10px] text-white/40">4–10 место</p><p className="text-xs font-bold text-white">100 XP</p></div></div>
      </section>
      {loading ? <p className="py-8 text-center text-sm text-white/40">Загрузка рейтинга...</p> : items.length ? <section className="space-y-2">{items.map((item, index) => <div key={item.id} className="glass flex items-center gap-3 rounded-xl p-3"><div className="w-7 text-center font-black text-white/55">{index === 0 ? <Crown size={19} className="mx-auto text-amber-300"/> : index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{item.firstName || item.username || "Игрок"}</p><p className="text-xs text-white/40">Уровень {item.level} · {item.gamesInPeriod || 0} матчей</p></div><p className="text-sm font-bold text-white">{item.xp} XP</p></div>)}</section> : <p className="py-8 text-center text-sm text-white/40">В этом сезоне пока нет результатов.</p>}
      {user?.isAdmin && <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold text-white">Управление сезоном</h2><input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Название следующего сезона" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/><button onClick={() => action("season_create", { name })} disabled={busy || name.trim().length < 3} className="w-full rounded-xl bg-white py-3 text-sm font-bold text-black disabled:opacity-40">Запустить сезон на 30 дней</button>{season?.isActive && <button onClick={() => action("season_finish", { seasonId: season.id })} disabled={busy} className="w-full rounded-xl bg-white/10 py-3 text-sm text-white">Завершить текущий сезон</button>}{season && !season.isActive && <button onClick={() => action("season_award", { seasonId: season.id })} disabled={busy} className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-black">Выдать сезонные награды</button>}</section>}
      {message && <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">{message}</p>}
    </div>
  );
}
