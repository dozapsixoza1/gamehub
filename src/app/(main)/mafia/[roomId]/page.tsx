"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTelegram } from "@/components/layout/TelegramProvider";
import {
  Skull,
  Users,
  Copy,
  Check,
  Play,
  LogOut,
  Crown,
  Moon,
  Sun,
} from "lucide-react";
import { ROLE_INFO } from "@/lib/mafia/roles";
import type { MafiaRole } from "@prisma/client";
import { cn } from "@/lib/utils";

interface RoomPlayer {
  id: string;
  userId: string;
  isAlive: boolean;
  isHost: boolean;
  seatNumber: number | null;
  role: MafiaRole | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
  };
}

interface RoomData {
  id: string;
  code: string;
  status: string;
  currentPhase: string | null;
  dayNumber: number;
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  winner: string | null;
  players: RoomPlayer[];
  myPlayerId: string | null;
  myRole: MafiaRole | null;
}

export default function MafiaRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, initData } = useTelegram();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const qs = new URLSearchParams({ roomId });
      if (initData) qs.set("initData", initData);

      const res = await fetch(`/api/mafia/room?${qs}`);
      const data = await res.json();

      if (data.room) {
        setRoom(data.room);
      } else {
        setError(data.error || "Комната не найдена");
      }
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [roomId, initData]);

  useEffect(() => {
    fetchRoom();
    // Polling каждые 3 секунды (в проде лучше Realtime)
    const interval = setInterval(fetchRoom, 3000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!initData || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/mafia/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, action: "start", roomId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchRoom();
      } else {
        setError(data.error || "Не удалось начать");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setActionLoading(false);
    }
  };

  const leaveRoom = async () => {
    if (!initData || actionLoading) return;
    setActionLoading(true);
    try {
      await fetch("/api/mafia/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, action: "leave", roomId }),
      });
      router.push("/mafia");
    } catch {
      setError("Ошибка выхода");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-white/60 mb-4">{error || "Комната не найдена"}</p>
        <button
          onClick={() => router.push("/mafia")}
          className="px-6 py-2.5 bg-white/10 rounded-xl text-white"
        >
          Назад
        </button>
      </div>
    );
  }

  const isHost = room.hostId === user?.id;
  const isWaiting = room.status === "WAITING";
  const isFinished = room.status === "FINISHED";
  const myRoleInfo = room.myRole ? ROLE_INFO[room.myRole] : null;

  return (
    <div className="px-4 pt-5 max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-900/40 flex items-center justify-center">
            <Skull size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Мафия</h1>
            <div className="flex items-center gap-1.5 text-sm text-white/40">
              <span className="font-mono tracking-wider text-white/70">
                {room.code}
              </span>
              <button onClick={copyCode} className="p-0.5 hover:text-white/70">
                {copied ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </div>

        {isWaiting && (
          <button
            onClick={leaveRoom}
            disabled={actionLoading}
            className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 transition"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Phase banner */}
      {!isWaiting && (
        <div
          className={cn(
            "rounded-2xl p-4 mb-5 flex items-center gap-3",
            room.status === "NIGHT"
              ? "bg-indigo-950/50 border border-indigo-900/40"
              : "bg-amber-950/40 border border-amber-900/30"
          )}
        >
          {room.status === "NIGHT" ? (
            <Moon size={22} className="text-indigo-300" />
          ) : (
            <Sun size={22} className="text-amber-300" />
          )}
          <div>
            <div className="font-medium text-white">
              {room.status === "NIGHT" && "Ночь"}
              {room.status === "DAY" && "День"}
              {room.status === "VOTING" && "Голосование"}
              {isFinished && "Игра окончена"}
              {room.dayNumber > 0 && ` · День ${room.dayNumber}`}
            </div>
            <div className="text-sm text-white/50">
              {room.currentPhase === "NIGHT_MAFIA" && "Мафия выбирает жертву..."}
              {room.currentPhase === "NIGHT_DOCTOR" && "Доктор лечит..."}
              {room.currentPhase === "NIGHT_SHERIFF" && "Шериф проверяет..."}
              {room.currentPhase === "DAY_DISCUSSION" && "Обсуждение"}
              {room.currentPhase === "DAY_VOTING" && "Голосуйте!"}
              {isFinished &&
                (room.winner === "mafia"
                  ? "Победа мафии"
                  : room.winner === "maniac"
                    ? "Победа маньяка"
                    : "Победа мирных")}
            </div>
          </div>
        </div>
      )}

      {/* My role card */}
      {myRoleInfo && !isWaiting && (
        <div className="glass rounded-2xl p-4 mb-5 border-l-4 border-red-500">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
            Твоя роль
          </div>
          <div className="text-lg font-bold text-white">{myRoleInfo.name}</div>
          <p className="text-sm text-white/50 mt-1">{myRoleInfo.description}</p>
        </div>
      )}

      {/* Players */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-white/40" />
          <span className="text-sm text-white/50">
            Игроки · {room.players.length}/{room.maxPlayers}
          </span>
        </div>

        <div className="space-y-2">
          {room.players.map((p) => (
            <div
              key={p.id}
              className={cn(
                "glass rounded-xl px-4 py-3 flex items-center gap-3",
                !p.isAlive && "opacity-50"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                {p.user.firstName?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-white truncate">
                    {p.user.firstName}
                    {p.user.lastName ? ` ${p.user.lastName}` : ""}
                  </span>
                  {p.isHost && (
                    <Crown size={14} className="text-amber-400 flex-shrink-0" />
                  )}
                  {p.id === room.myPlayerId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                      ты
                    </span>
                  )}
                </div>
                {!p.isAlive && (
                  <span className="text-xs text-red-400">Убит</span>
                )}
                {p.role && !p.isAlive && (
                  <span className="text-xs text-white/40 ml-2">
                    {ROLE_INFO[p.role]?.name}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/30 font-mono">
                #{p.seatNumber}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {isWaiting && isHost && (
        <button
          onClick={startGame}
          disabled={
            actionLoading || room.players.length < room.minPlayers
          }
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-semibold py-4 rounded-2xl transition active:scale-[0.98] disabled:opacity-40"
        >
          <Play size={20} />
          Начать игру
          {room.players.length < room.minPlayers && (
            <span className="text-sm font-normal opacity-70">
              (мин. {room.minPlayers})
            </span>
          )}
        </button>
      )}

      {isWaiting && !isHost && (
        <div className="text-center text-white/40 text-sm py-4">
          Ожидание хоста...
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center mt-4">{error}</p>
      )}

      {/* Hint */}
      {isWaiting && (
        <p className="text-center text-white/30 text-xs mt-6">
          Отправь код <span className="font-mono text-white/50">{room.code}</span> друзьям
        </p>
      )}
    </div>
  );
}
