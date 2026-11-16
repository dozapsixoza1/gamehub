"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { Skull, Plus, LogIn, Users } from "lucide-react";

export default function MafiaLobbyPage() {
  const router = useRouter();
  const { user, initData } = useTelegram();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createRoom = async () => {
    if (!initData || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mafia/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, action: "create" }),
      });

      const data = await res.json();

      if (data.roomId) {
        router.push(`/mafia/${data.roomId}`);
      } else {
        setError(data.error || "Не удалось создать комнату");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!initData || !code.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mafia/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          action: "join",
          code: code.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (data.roomId) {
        router.push(`/mafia/${data.roomId}`);
      } else {
        setError(data.error || "Комната не найдена");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-950/50 border border-red-900/50 mb-4">
          <Skull size={32} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Мафия</h1>
        <p className="text-white/50 text-sm mt-1">
          Классическая игра. День и ночь. Предательство и доверие.
        </p>
      </div>

      {/* Create */}
      <button
        onClick={createRoom}
        disabled={loading || !user}
        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-semibold py-4 rounded-2xl transition active:scale-[0.98] disabled:opacity-50 mb-4"
      >
        <Plus size={20} />
        Создать комнату
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs uppercase tracking-wider">
          или
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Join */}
      <div className="glass rounded-2xl p-4">
        <label className="text-sm text-white/50 mb-2 block">
          Код комнаты
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center tracking-[0.3em] font-mono text-lg placeholder:text-white/20 outline-none focus:border-red-500/50 transition uppercase"
          />
          <button
            onClick={joinRoom}
            disabled={loading || code.length < 4 || !user}
            className="px-5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition disabled:opacity-40 active:scale-95"
          >
            <LogIn size={20} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center mt-4">{error}</p>
      )}

      {/* Info */}
      <div className="mt-10 glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-white/50" />
          <h3 className="font-medium text-white text-sm">Как играть</h3>
        </div>
        <ul className="space-y-2 text-sm text-white/50">
          <li>• 4–12 игроков</li>
          <li>• Ночью мафия выбирает жертву</li>
          <li>• Доктор может спасти</li>
          <li>• Шериф проверяет подозреваемых</li>
          <li>• Днём — обсуждение и голосование</li>
        </ul>
      </div>
    </div>
  );
}
