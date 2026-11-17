"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowRight, Plus, Shield, Users } from "lucide-react";

export default function BunkerLobbyPage() {
  const router = useRouter();
  const { user, initData } = useTelegram();
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const request = async (body: Record<string, unknown>) => {
    if (!initData || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bunker/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, initData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось выполнить действие");
      if (data.roomId) router.push(`/bunker/${data.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-400/20 bg-slate-700/30">
          <Shield size={32} className="text-slate-200" />
        </div>
        <h1 className="text-2xl font-bold text-white">Бункер</h1>
        <p className="mt-1 text-sm text-white/50">Кто достоин места в убежище?</p>
        <p className="mt-3 text-xs text-white/35">4–16 игроков · Карточки · Обсуждение · Голосование</p>
      </div>

      <div className="glass rounded-2xl p-4">
        <label className="mb-2 block text-sm text-white/60">Максимум игроков</label>
        <select value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-[#151923] px-4 py-3 text-white">
          {[4,5,6,7,8,9,10,11,12,13,14,15,16].map(n => <option key={n} value={n}>{n} игроков</option>)}
        </select>
        <button onClick={() => request({ action: "create", maxPlayers: Number(maxPlayers) })} disabled={!user || loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-800 py-4 font-semibold text-white transition active:scale-[.98] disabled:opacity-50">
          <Plus size={19} /> {loading ? "Создаём..." : "Создать комнату"}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wider text-white/30">или войти</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="glass rounded-2xl p-4">
        <label className="mb-2 block text-sm text-white/60">Код комнаты</label>
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={6} placeholder="ABC123" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-[.25em] text-white outline-none focus:border-slate-400/50" />
          <button onClick={() => request({ action: "join", code })} disabled={!user || loading || code.length < 4} className="rounded-xl bg-white/10 px-5 text-white disabled:opacity-40"><ArrowRight size={20}/></button>
        </div>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

      <div className="mt-8 rounded-2xl border border-white/5 bg-white/[.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-white"><Users size={17}/><h2 className="text-sm font-semibold">Правила</h2></div>
        <ul className="space-y-2 text-sm text-white/50">
          <li>• После старта каждый получает секретную карточку персонажа.</li>
          <li>• По очереди раскрываются профессия, здоровье, хобби, багаж и особый факт.</li>
          <li>• После обсуждения игроки голосуют, кто не попадёт в убежище.</li>
          <li>• Побеждают участники, оставшиеся к моменту заполнения бункера.</li>
        </ul>
      </div>
    </div>
  );
}
