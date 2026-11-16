"use client";

import { useTelegram } from "@/components/layout/TelegramProvider";
import { GameCard } from "@/components/games/GameCard";
import { GAMES } from "@/lib/games";
import { formatNumber } from "@/lib/utils";
import { Coins, Gem } from "lucide-react";

export default function HomePage() {
  const { user, isLoading } = useTelegram();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Игровой Хаб
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Выбери игру и зови друзей
        </p>
      </div>

      {/* Balance */}
      {user && (
        <div className="flex gap-3 mb-6">
          <div className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Coins size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-white/40">Монеты</div>
              <div className="font-semibold text-white">
                {formatNumber(user.coins)}
              </div>
            </div>
          </div>
          <div className="flex-1 glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Gem size={18} className="text-violet-400" />
            </div>
            <div>
              <div className="text-xs text-white/40">Гемы</div>
              <div className="font-semibold text-white">
                {formatNumber(user.gems)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games grid */}
      <div className="space-y-3">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
