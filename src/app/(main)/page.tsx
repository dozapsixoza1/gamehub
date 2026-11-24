"use client";

import { useTelegram } from "@/components/layout/TelegramProvider";
import { GameCard } from "@/components/games/GameCard";
import { GAMES } from "@/lib/games";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { Coins, Gem, Crown, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

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

      <section className="mb-5 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-950/55 via-slate-900/70 to-cyan-950/40 p-4">
        <div className="flex items-center gap-2 text-violet-200"><Sparkles size={16}/><span className="text-[10px] font-black uppercase tracking-[.22em]">Global Update</span></div>
        <h2 className="mt-2 text-lg font-black text-white">GameHub выходит на новый уровень</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/55">Новые игровые режимы, развитие кланов и больше возможностей для твоего профиля.</p>
        <Link href="/bunker" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700/80 px-3 py-2 text-xs font-bold text-white"><ShieldCheck size={15}/>Играть в Бункер <ArrowRight size={14}/></Link>
      </section>

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

      <Link href="/battle-pass" className="mb-5 flex items-center justify-between overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-500/15 to-orange-500/5 p-4 transition hover:border-amber-300/40">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-300/15 p-2.5 text-amber-200"><Crown size={21}/></div>
          <div><p className="text-sm font-black text-white">Боевой пропуск</p><p className="mt-0.5 text-[11px] text-white/45">50 уровней · награды · сезонные задания</p></div>
        </div>
        <ArrowRight size={18} className="text-amber-200"/>
      </Link>

      {/* Games grid */}
      <div className="space-y-3">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
