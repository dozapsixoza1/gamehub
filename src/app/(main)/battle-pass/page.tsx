"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Crown, Gem, Lock } from "lucide-react";
import { useTelegram } from "@/components/layout/TelegramProvider";

type PassReward = { key: string; label: string; type: string; amount: number; claimed: boolean };
type Tier = { tier: number; requiredXp: number; unlocked: boolean; free: PassReward; premium: PassReward };
type PassData = {
  season: { id: string; name: string; startsAt: string; endsAt: string } | null;
  passXp: number;
  maxTier: number;
  xpPerTier: number;
  premiumPrice: number;
  premiumUnlocked: boolean;
  balances?: { coins: number; gems: number };
  tiers: Tier[];
};

export default function BattlePassPage() {
  const { initData, user } = useTelegram();
  const [data, setData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!initData) { setLoading(false); return; }
    try {
      const response = await fetch("/api/battle-pass", { headers: { "x-init-data": initData }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить пропуск");
      setData(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { load(); }, [load]);

  const currentTier = useMemo(() => data ? Math.min(data.maxTier, Math.floor(data.passXp / data.xpPerTier)) : 0, [data]);
  const progress = data ? Math.min(100, (data.passXp % data.xpPerTier) / data.xpPerTier * 100) : 0;

  const action = async (payload: Record<string, unknown>) => {
    if (!initData || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/battle-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Действие не выполнено");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="mx-auto flex min-h-[55vh] max-w-lg items-center justify-center text-sm text-white/50">Загружаем боевой пропуск…</div>;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-5">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/>Назад к играм</Link>

      <section className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-zinc-950 p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 text-8xl opacity-10">👑</div>
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-amber-200"><Crown size={13}/>GameHub Pass</div>
          <h1 className="text-3xl font-black tracking-tight text-white">БОЕВОЙ ПРОПУСК</h1>
          <p className="mt-1 text-sm text-white/60">{data?.season?.name || "Сезон ещё не запущен"}</p>
          {data?.season ? <>
            <div className="mt-5 flex items-end justify-between">
              <div><p className="text-xs text-white/50">Твой прогресс</p><p className="text-2xl font-black text-white">{currentTier}<span className="text-sm font-semibold text-white/40"> / 50</span></p></div>
              <p className="text-xs font-semibold text-amber-100">{data.passXp.toLocaleString("ru-RU")} XP</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-300 transition-all" style={{ width: progress + "%" }}/></div>
            <p className="mt-2 text-[11px] text-white/45">До следующего уровня: {data.xpPerTier - (data.passXp % data.xpPerTier)} XP</p>
          </> : <p className="mt-3 text-xs text-white/55">Администратор может запустить сезон в разделе «Сезоны». После запуска здесь появятся 50 уровней наград.</p><Link href="/seasons" className="mt-3 inline-flex rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white">Перейти к сезонам</Link>}
        </div>
      </section>

      {data?.season && <>
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-bold text-white">Премиум-пропуск</p><p className="mt-1 text-xs text-white/45">Открывает вторую линию наград. Без преимуществ в матчах.</p></div>
            {data.premiumUnlocked ? <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">Открыт</span> : <button onClick={() => action({ action: "unlock_premium" })} disabled={busy} className="shrink-0 rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-black disabled:opacity-50"><span className="inline-flex items-center gap-1"><Gem size={13}/>{data.premiumPrice}</span></button>}
          </div>
          {!data.premiumUnlocked && <p className="mt-2 text-[10px] text-white/35">Баланс: {data.balances?.gems ?? user?.gems ?? 0} гемов</p>}
        </section>

        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-white">Линия наград</h2>
          <span className="text-[10px] text-white/40">50 уровней · 2 дорожки</span>
        </div>

        <div className="space-y-2">
          {data.tiers.map((tier) => (
            <section key={tier.tier} className={`glass rounded-2xl p-3 ${tier.unlocked ? "border-amber-300/15" : "opacity-80"}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><div className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black ${tier.unlocked ? "bg-amber-300 text-black" : "bg-white/10 text-white/60"}`}>{tier.tier}</div><div><p className="text-xs font-bold text-white">Уровень {tier.tier}</p><p className="text-[10px] text-white/35">{tier.requiredXp} XP</p></div></div>
                {tier.unlocked ? <span className="text-[10px] font-semibold text-emerald-300">Открыт</span> : <span className="inline-flex items-center gap-1 text-[10px] text-white/35"><Lock size={11}/>Закрыт</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-white/8 bg-white/[.035] p-2.5">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/35">Бесплатно</p>
                  <p className="min-h-8 text-[11px] font-semibold leading-snug text-white">{tier.free.label}</p>
                  <button onClick={() => action({ action: "claim", tier: tier.tier, track: "free" })} disabled={!tier.unlocked || tier.free.claimed || busy} className="mt-2 w-full rounded-lg bg-white/10 py-2 text-[10px] font-bold text-white disabled:opacity-35">{tier.free.claimed ? <span className="inline-flex items-center gap-1"><Check size={12}/>Получено</span> : "Забрать"}</button>
                </div>
                <div className="min-w-0 rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-2.5">
                  <p className="mb-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-200/60"><Crown size={10}/>Премиум</p>
                  <p className="min-h-8 text-[11px] font-semibold leading-snug text-amber-100">{tier.premium.label}</p>
                  <button onClick={() => action({ action: "claim", tier: tier.tier, track: "premium" })} disabled={!tier.unlocked || !data.premiumUnlocked || tier.premium.claimed || busy} className="mt-2 w-full rounded-lg bg-amber-300/15 py-2 text-[10px] font-bold text-amber-100 disabled:opacity-35">{tier.premium.claimed ? <span className="inline-flex items-center gap-1"><Check size={12}/>Получено</span> : !data.premiumUnlocked ? "Нужен премиум" : "Забрать"}</button>
                </div>
              </div>
            </section>
          ))}
        </div>
      </>}

      {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
      <p className="text-center text-[10px] leading-relaxed text-white/30">Награды выдаются один раз за уровень. XP для пропуска считается по записям журнала XP, полученным в течение текущего сезона.</p>
    </div>
  );
}
