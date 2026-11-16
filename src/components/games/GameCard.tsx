"use client";

import Link from "next/link";
import {
  Skull,
  Shield,
  Eye,
  UserX,
  LayoutGrid,
  Scale,
  Moon,
  Fingerprint,
  Flame,
  Handshake,
  Target,
  MessageCircleQuestion,
  Lock,
} from "lucide-react";
import { GameInfo } from "@/lib/games";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Skull,
  Shield,
  Eye,
  UserX,
  LayoutGrid,
  Scale,
  Moon,
  Fingerprint,
  Flame,
  Handshake,
  Target,
  MessageCircleQuestion,
};

interface GameCardProps {
  game: GameInfo;
}

export function GameCard({ game }: GameCardProps) {
  const Icon = ICONS[game.icon] || Skull;
  const isActive = game.status === "active";

  const content = (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isActive
          ? "border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          : "border-white/5 opacity-70"
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-80",
          game.gradient
        )}
      />

      {/* Noise / overlay */}
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative p-4 flex items-center gap-4">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${game.accentColor}22` }}
        >
          <Icon size={28} className="text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-[17px] truncate">
              {game.name}
            </h3>
            {!isActive && (
              <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                Скоро
              </span>
            )}
          </div>
          <p className="text-sm text-white/50 mt-0.5 line-clamp-1">
            {game.description}
          </p>
          <div className="mt-1.5 text-xs text-white/40">
            {game.players} игроков
          </div>
        </div>

        {/* Lock for coming soon */}
        {!isActive && (
          <div className="flex-shrink-0 text-white/30">
            <Lock size={18} />
          </div>
        )}
      </div>
    </div>
  );

  if (isActive) {
    return <Link href={`/${game.id}`}>{content}</Link>;
  }

  return content;
}
