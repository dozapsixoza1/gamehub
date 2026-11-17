"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { Check, Copy, Crown, DoorOpen, Shield, Users } from "lucide-react";

type Player = {
  userId: string;
  name: string;
  username?: string | null;
  photoUrl?: string | null;
  isHost: boolean;
  isActive: boolean;
  revealedFields: string[];
  character: Record<string, string>;
  isMe: boolean;
};
type Room = {
  id: string;
  code: string;
  name: string | null;
  status: string;
  maxPlayers: number;
  gameState: {
    apocalypse?: string;
    capacity?: number;
    round?: number;
    phase?: string;
    currentCategory?: string;
    eliminatedUserId?: string;
  };
  myVote?: string | null;
  players: Player[];
  categoryLabel: string;
};

const FIELD_LABELS: Record<string, string> = {
  profession: "Профессия",
  health: "Здоровье",
  hobby: "Хобби",
  baggage: "Багаж",
  fact: "Особый факт",
};

export default function BunkerRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const { initData } = useTelegram();
  const [room, setRoom] = useState<Room | null>(null);
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!initData || !roomId) return;
    try {
      const res = await fetch(`/api/bunker/room?roomId=${encodeURIComponent(roomId)}`, {
        headers: { "x-init-data": initData },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data.room);
        setMeId(data.meId);
        setError("");
      } else {
        setError(data.error || "Не удалось загрузить комнату");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [initData, roomId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!initData || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bunker/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, roomId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Действие не выполнено");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  const me = useMemo(() => room?.players.find(p => p.userId === meId), [room, meId]);
  const activePlayers = room?.players.filter(p => p.isActive) || [];
  const myVote = room?.myVote;
  const currentCategory = room?.gameState.currentCategory || "";
  const alreadyRevealed = !!me?.revealedFields.includes(currentCategory);

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Не удалось скопировать код");
    }
  };

  if (loading) return <div className="py-20 text-center text-white/45">Загрузка комнаты...</div>;
  if (!room) return <div className="mx-auto max-w-lg px-4 pt-10 text-center"><p className="text-red-400">{error || "Комната не найдена"}</p><Link href="/bunker" className="mt-4 inline-block text-sm text-white/60">Назад</Link></div>;

  const isHost = me?.isHost;
  const isWaiting = room.status === "WAITING";
  const isFinished = room.status === "FINISHED";
  const phase = room.gameState.phase;

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/bunker" className="text-sm text-white/45">← Бункер</Link>
        <button onClick={copyCode} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-white"><span>{room.code}</span>{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-300/10 bg-gradient-to-br from-slate-800/70 to-slate-950 p-5">
        <div className="mb-2 flex items-center gap-2 text-slate-200"><Shield size={19}/><span className="text-xs uppercase tracking-[.18em]">GameHub · Survival</span></div>
        <h1 className="text-2xl font-bold text-white">{room.name || "Бункер"}</h1>
        {isWaiting ? <p className="mt-2 text-sm text-white/45">Ожидание игроков · нужно минимум 4</p> : <><p className="mt-2 text-sm text-slate-200/70">{room.gameState.apocalypse}</p><p className="mt-3 text-xs text-white/45">Места в бункере: {room.gameState.capacity} · Раунд {room.gameState.round}</p></>}
      </div>

      {isWaiting && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-white">Участники</h2><span className="text-sm text-white/45">{room.players.length}/{room.maxPlayers}</span></div>
          <div className="space-y-2">
            {room.players.map(p => <div key={p.userId} className="flex items-center gap-3 rounded-xl bg-white/[.04] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-500/20 text-sm text-slate-200">{p.name.slice(0,1).toUpperCase()}</div>
              <span className="min-w-0 flex-1 truncate text-sm text-white">{p.name}{p.isMe ? " (вы)" : ""}</span>
              {p.isHost && <Crown size={15} className="text-amber-300"/>}
            </div>)}
          </div>
          {isHost && <button onClick={() => act("start")} disabled={busy || room.players.length < 4} className="mt-4 w-full rounded-xl bg-slate-200 py-3 font-semibold text-slate-950 disabled:opacity-40">{busy ? "Запускаем..." : "Начать игру"}</button>}
          {!isHost && <p className="mt-4 text-center text-xs text-white/35">Создатель комнаты начнёт игру, когда соберутся участники.</p>}
        </div>
      )}

      {!isWaiting && !isFinished && (
        <>
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-white">{phase === "VOTING" ? "Голосование" : FIELD_LABELS[currentCategory] || "Обсуждение"}</h2><span className="text-xs text-white/40">{activePlayers.length} в игре</span></div>
            {phase === "DISCUSSION" && <div className="mb-3 rounded-xl bg-slate-500/10 p-3"><p className="text-xs text-white/45">Твоя карточка</p><p className="mt-1 font-medium text-white">{alreadyRevealed ? me?.character[currentCategory] : "Эта характеристика пока скрыта"}</p><button onClick={() => act("reveal")} disabled={busy || !me?.isActive || alreadyRevealed} className="mt-3 w-full rounded-lg bg-slate-200 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{alreadyRevealed ? "Карточка открыта" : "Открыть характеристику"}</button></div>}
            {phase === "VOTING" && <p className="mb-3 text-sm text-white/50">Выберите участника, который не попадёт в бункер. Голос нельзя изменить.</p>}
            <div className="space-y-2">
              {room.players.map(p => <div key={p.userId} className={`rounded-xl border p-3 ${p.isActive ? "border-white/5 bg-white/[.035]" : "border-red-500/10 bg-red-500/[.04] opacity-50"}`}>
                <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{p.name}{p.isMe ? " (вы)" : ""}</span>{p.isHost && <Crown size={13} className="text-amber-300"/>}{!p.isActive && <span className="text-[10px] text-red-300">Вне бункера</span>}</div>
                {Object.entries(p.character).map(([key,value]) => <p key={key} className="mt-1 text-xs text-white/55"><span className="text-white/30">{FIELD_LABELS[key] || key}:</span> {value}</p>)}
                {phase === "VOTING" && p.isActive && !p.isMe && !myVote && me?.isActive && <button onClick={() => act("vote", { targetId: p.userId })} disabled={busy} className="mt-2 w-full rounded-lg bg-red-500/15 py-2 text-xs font-semibold text-red-200 disabled:opacity-40">Голосовать против</button>}
                {myVote === p.userId && <p className="mt-2 text-xs text-amber-300">Твой голос</p>}
              </div>)}
            </div>
            {phase === "VOTING" && myVote && <p className="mt-3 text-center text-xs text-white/40">Голос принят. Ожидаем остальных игроков…</p>}
            {phase === "DISCUSSION" && !alreadyRevealed && <p className="mt-3 text-center text-xs text-white/35">Каждый участник должен открыть характеристику, затем начнётся голосование.</p>}
          </div>
        </>
      )}

      {isFinished && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[.06] p-5">
          <div className="mb-2 flex items-center gap-2 text-emerald-300"><Shield size={20}/><h2 className="text-lg font-bold">Бункер заполнен!</h2></div>
          <p className="mb-4 text-sm text-white/55">Катастрофа: {room.gameState.apocalypse}</p>
          <h3 className="mb-2 text-sm font-semibold text-white">Выжившие</h3>
          <div className="space-y-2">{room.players.filter(p => p.isActive).map(p => <div key={p.userId} className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-100">{p.name}</div>)}</div>
          <p className="mt-4 text-xs text-white/40">Награды за партию начислены в общий профиль GameHub.</p>
          <Link href="/bunker" className="mt-4 block rounded-xl bg-white/10 py-3 text-center text-sm font-semibold text-white">В меню Бункера</Link>
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/25"><Users size={13}/>{room.players.length} участников <span>·</span><DoorOpen size={13}/>Комната {room.code}</div>
    </div>
  );
}
