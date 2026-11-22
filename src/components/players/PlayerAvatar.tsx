"use client";

type PlayerAvatarProps = {
  name: string;
  imageUrl?: string | null;
  online: boolean;
  sizeClassName?: string;
  frame?: string | null;
  animation?: string | null;
  effect?: string | null;
};

const frameStyles: Record<string, string> = {
  ruby: "ring-2 ring-rose-400 shadow-[0_0_16px_rgba(244,63,94,.55)]",
  amethyst: "ring-2 ring-violet-300 shadow-[0_0_18px_rgba(167,139,250,.65)]",
  cyber: "ring-2 ring-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.65)]",
  gold: "ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,.65)]",
  emerald: "ring-2 ring-emerald-300 shadow-[0_0_18px_rgba(52,211,153,.55)]",
  obsidian: "ring-2 ring-slate-300 shadow-[0_0_18px_rgba(148,163,184,.5)]",
};

export function PlayerAvatar({ name, imageUrl, online, sizeClassName = "h-11 w-11", frame, animation, effect }: PlayerAvatarProps) {
  const frameClass = frameStyles[frame || ""] || "";
  const motionClass = animation === "orbit" ? "avatar-orbit" : animation === "pulse" ? "avatar-pulse" : animation === "float" ? "avatar-float" : "";
  const effectClass = effect === "spark" ? "avatar-spark" : effect === "flame" ? "avatar-flame" : effect === "glitch" ? "avatar-glitch" : "";
  return (
    <div className={`relative shrink-0 ${sizeClassName} rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 ${frameClass} ${motionClass} ${effectClass}`}>
      <div className="h-full w-full rounded-full overflow-hidden grid place-items-center text-white">
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
      </div>
      <span title={online ? "Онлайн" : "Оффлайн"} aria-label={online ? "Онлайн" : "Оффлайн"} className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b0b0f] ${online ? "bg-emerald-400" : "bg-red-500"}`} />
    </div>
  );
}
