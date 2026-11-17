"use client";

type PlayerAvatarProps = {
  name: string;
  imageUrl?: string | null;
  online: boolean;
  sizeClassName?: string;
};

export function PlayerAvatar({ name, imageUrl, online, sizeClassName = "h-11 w-11" }: PlayerAvatarProps) {
  return (
    <div className={`relative shrink-0 ${sizeClassName} rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 overflow-visible grid place-items-center text-white`}>
      <div className="h-full w-full rounded-full overflow-hidden grid place-items-center">
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
      </div>
      <span
        title={online ? "Онлайн" : "Оффлайн"}
        aria-label={online ? "Онлайн" : "Оффлайн"}
        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b0b0f] ${online ? "bg-emerald-400" : "bg-red-500"}`}
      />
    </div>
  );
}
