"use client";

import { useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { formatNumber } from "@/lib/utils";
import { Coins, Gem, Trophy, Gamepad2, Ticket } from "lucide-react";

export default function ProfilePage() {
  const { user, initData, refreshUser, isLoading } = useTelegram();
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  const handlePromo = async () => {
    if (!promoCode.trim() || !initData) return;

    setPromoStatus("loading");
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, code: promoCode.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setPromoStatus("success");
        setPromoMessage(data.message);
        setPromoCode("");
        await refreshUser();
      } else {
        setPromoStatus("error");
        setPromoMessage(data.message || "Ошибка");
      }
    } catch {
      setPromoStatus("error");
      setPromoMessage("Ошибка сети");
    }

    setTimeout(() => setPromoStatus("idle"), 3000);
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const winrate =
    user.gamesPlayed > 0
      ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
      : 0;

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-2xl font-bold text-white">
          {user.firstName?.[0] || "?"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            {user.firstName} {user.lastName || ""}
          </h1>
          {user.username && (
            <p className="text-white/40 text-sm">@{user.username}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/40 text-xs mb-1">
            <Coins size={14} className="text-amber-400" />
            Монеты
          </div>
          <div className="text-xl font-bold text-white">
            {formatNumber(user.coins)}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/40 text-xs mb-1">
            <Gem size={14} className="text-violet-400" />
            Гемы
          </div>
          <div className="text-xl font-bold text-white">
            {formatNumber(user.gems)}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/40 text-xs mb-1">
            <Gamepad2 size={14} />
            Игр сыграно
          </div>
          <div className="text-xl font-bold text-white">
            {user.gamesPlayed}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/40 text-xs mb-1">
            <Trophy size={14} className="text-yellow-400" />
            Побед
          </div>
          <div className="text-xl font-bold text-white">
            {user.gamesWon}{" "}
            <span className="text-sm font-normal text-white/40">
              ({winrate}%)
            </span>
          </div>
        </div>
      </div>

      {/* Promo code */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ticket size={18} className="text-white/60" />
          <h2 className="font-medium text-white">Промокод</h2>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Введи код"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-white/25 transition"
            maxLength={20}
          />
          <button
            onClick={handlePromo}
            disabled={!promoCode.trim() || promoStatus === "loading"}
            className="px-5 py-2.5 bg-white text-black font-medium rounded-xl disabled:opacity-40 transition active:scale-95"
          >
            {promoStatus === "loading" ? "..." : "OK"}
          </button>
        </div>

        {promoStatus === "success" && (
          <p className="text-emerald-400 text-sm mt-2">{promoMessage}</p>
        )}
        {promoStatus === "error" && (
          <p className="text-red-400 text-sm mt-2">{promoMessage}</p>
        )}
      </div>
    </div>
  );
}
