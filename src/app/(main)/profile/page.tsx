"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { formatNumber } from "@/lib/utils";
import { Coins, Gem, Trophy, Gamepad2, Ticket, Gift, Users, Star, History, Crown, Copy, Settings, ShieldCheck, MessageCircle } from "lucide-react";
import { PlayerBadges } from "@/components/players/PlayerBadges";
import { VerificationManager } from "@/components/players/VerificationManager";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";

type ProgressData = {
  profile: {
    coins: number; gems: number; gamesPlayed: number; gamesWon: number;
    xp: number; level: number; currentLevelXp: number; nextLevelXp: number;
    dailyStreak: number; referralCode: string; referrals: number;
  };
  achievements: { id: string; unlockedAt: string; achievement: { id: string; title: string; description: string; icon: string; xpReward: number; coinsReward: number } }[];
  xpTransactions: { id: string; amount: number; balanceAfter: number; source: string; reason: string; createdAt: string }[];
};

export default function ProfilePage() {
  const { user, initData, refreshUser, isLoading } = useTelegram();
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [promoMessage, setPromoMessage] = useState("");
  const [data, setData] = useState<ProgressData | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const [refCode, setRefCode] = useState("");
  const [refMessage, setRefMessage] = useState("");
  const [refBusy, setRefBusy] = useState(false);

  const loadProgress = async () => {
    if (!initData) return;
    setProgressLoading(true);
    try {
      const res = await fetch("/api/progression", { headers: { "x-init-data": initData }, cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Не удалось загрузить профиль");
      setData(result);
      setProgressError("");
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Ошибка загрузки профиля");
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => { loadProgress().catch(console.error); }, [initData]);

  const claimDaily = async () => {
    setDailyBusy(true);
    try {
      const res = await fetch("/api/progression", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action: "claim_daily" }) });
      const result = await res.json();
      setDailyMessage(result.success ? `Получено: +${result.coins} монет и +${result.xp} XP. Серия: ${result.streak} дн.` : (result.message || result.error));
      await Promise.all([loadProgress(), refreshUser()]);
    } catch { setDailyMessage("Ошибка сети"); }
    finally { setDailyBusy(false); }
  };

  const applyReferral = async () => {
    setRefBusy(true);
    try {
      const res = await fetch("/api/progression", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action: "apply_referral", code: refCode.trim() }) });
      const result = await res.json();
      setRefMessage(result.message || result.error || "Готово");
      if (result.success) { setRefCode(""); await Promise.all([loadProgress(), refreshUser()]); }
    } catch { setRefMessage("Ошибка сети"); }
    finally { setRefBusy(false); }
  };

  const handlePromo = async () => {
    if (!promoCode.trim() || !initData) return;
    setPromoStatus("loading");
    try {
      const res = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, code: promoCode.trim() }) });
      const result = await res.json();
      if (result.success) { setPromoStatus("success"); setPromoMessage(result.message); setPromoCode(""); await refreshUser(); }
      else { setPromoStatus("error"); setPromoMessage(result.message || "Ошибка"); }
    } catch { setPromoStatus("error"); setPromoMessage("Ошибка сети"); }
    setTimeout(() => setPromoStatus("idle"), 3000);
  };

  if (isLoading || !user) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  const p = data?.profile;
  const winrate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0;
  const progress = p ? Math.min(100, Math.round(((p.xp - p.currentLevelXp) / Math.max(1, p.nextLevelXp - p.currentLevelXp)) * 100)) : 0;
  const inviteLink = p ? `https://t.me/gamehubesbot?startapp=ref_${p.referralCode}` : "";

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={user.displayName || user.firstName || "Игрок"} imageUrl={user.avatarUrl || user.photoUrl} online sizeClassName="h-16 w-16 text-2xl font-bold" frame={user.profileFrame} animation={user.avatarAnimation} effect={user.profileEffect}/>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate" style={user.nicknameColor === "amethyst" ? { color: "#c4b5fd" } : undefined}>{user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim()}</h1>
          {user.username && <p className="text-white/40 text-sm">@{user.username}</p>}{user.profileTitle && <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-amber-300">{user.profileTitle}</p>}
          {user.profileBio && <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/55">{user.profileBio}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2"><PlayerBadges isAdmin={user.isAdmin} staffRole={user.staffRole} isVerified={user.isVerified} />{user.profileBadge === "winner" && <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-300">🏆 Победитель</span>}</div>
        </div>
      </div>

      {user.profileShowcase?.length ? <section className="glass rounded-2xl p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/40">Избранные достижения</p><div className="flex flex-wrap gap-2">{user.profileShowcase.map(id=>{const achievement=data?.achievements.find(a=>a.achievement.id===id)?.achievement;return achievement?<span key={id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">{achievement.icon} {achievement.title}</span>:null;})}</div></section>:null}
      <Link href="/shop" className="glass flex items-center justify-between rounded-2xl p-4"><div><p className="text-sm font-bold text-white">Мастерская профиля</p><p className="mt-1 text-xs text-white/45">Рамки, анимации, эффекты, титулы и коллекция</p></div><span className="rounded-xl bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-200">Открыть</span></Link>

      <section className="glass rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <div><p className="text-xs text-white/45">Уровень игрока</p><p className="text-2xl font-black text-white">Уровень {p?.level ?? 1}</p></div>
          <div className="text-right"><p className="text-xs text-white/45">Опыт</p><p className="font-bold text-white">{formatNumber(p?.xp ?? 0)} XP</p></div>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full" style={{ width: `${progress}%` }} /></div>
        <p className="text-[11px] text-white/35 mt-2">{p ? `${p.xp - p.currentLevelXp} / ${p.nextLevelXp - p.currentLevelXp} XP до следующего уровня` : progressLoading ? "Загружаем статистику..." : "Прогресс временно недоступен"}</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4"><div className="flex gap-2 text-xs text-white/40 mb-1"><Coins size={14} className="text-amber-400" />Монеты</div><div className="text-xl font-bold text-white">{formatNumber(user.coins)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="flex gap-2 text-xs text-white/40 mb-1"><Gem size={14} className="text-violet-400" />Гемы</div><div className="text-xl font-bold text-white">{formatNumber(user.gems)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="flex gap-2 text-xs text-white/40 mb-1"><Gamepad2 size={14} />Матчи</div><div className="text-xl font-bold text-white">{user.gamesPlayed}</div></div>
        <div className="glass rounded-2xl p-4"><div className="flex gap-2 text-xs text-white/40 mb-1"><Trophy size={14} className="text-yellow-400" />Победы</div><div className="text-xl font-bold text-white">{user.gamesWon} <span className="text-sm font-normal text-white/40">({winrate}%)</span></div></div>
      </div>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2"><Gift size={18} className="text-amber-400" /><h2 className="font-semibold text-white">Ежедневная награда</h2></div>
        <p className="text-xs text-white/45 mb-3">Заходи каждый день — награда растёт вместе с серией. Текущая серия: {p?.dailyStreak ?? 0} дн.</p>
        <button onClick={claimDaily} disabled={dailyBusy || !data} className="w-full rounded-xl bg-white text-black font-semibold py-3 disabled:opacity-50">{dailyBusy ? "Получаем..." : "Забрать награду"}</button>
        {dailyMessage && <p className="text-xs text-white/65 mt-2">{dailyMessage}</p>}
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2"><Users size={18} className="text-sky-400" /><h2 className="font-semibold text-white">Приглашай друзей</h2></div>
        <p className="text-xs text-white/45 mb-3">Друг получает 100 монет и 50 XP, ты — 200 монет и 100 XP за приглашённого игрока.</p>
        <div className="flex gap-2"><input readOnly value={inviteLink || "Загрузка..."} className="min-w-0 flex-1 bg-black/20 border border-white/10 rounded-xl px-3 text-xs text-white/70" /><button onClick={() => navigator.clipboard.writeText(inviteLink)} disabled={!inviteLink} className="px-3 rounded-xl bg-white/10 text-white"><Copy size={16} /></button></div>
        <p className="text-xs text-white/40 mt-2">Приглашено: {p?.referrals ?? 0}</p>
        <div className="flex gap-2 mt-3"><input value={refCode} onChange={e => setRefCode(e.target.value)} placeholder="Код друга" className="min-w-0 flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" /><button onClick={applyReferral} disabled={refBusy || !refCode.trim()} className="px-4 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-40">{refBusy ? "..." : "Применить"}</button></div>
        {refMessage && <p className="text-xs text-white/60 mt-2">{refMessage}</p>}
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Star size={18} className="text-yellow-400" /><h2 className="font-semibold text-white">Достижения</h2></div><span className="text-xs text-white/40">{data?.achievements.length ?? 0}</span></div>
        {progressLoading ? <p className="text-xs text-white/40">Загружаем достижения...</p> : data?.achievements.length ? <div className="space-y-2">{data.achievements.map(a => <div key={a.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3"><span className="text-2xl">{a.achievement.icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{a.achievement.title}</p><p className="text-xs text-white/40">{a.achievement.description}</p></div></div>)}</div> : <p className="text-xs text-white/40">Пока нет открытых достижений. Играй и выполняй условия!</p>}
      </section>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3"><History size={18} className="text-primary"/><h2 className="font-semibold text-white">История XP</h2></div>
        {data?.xpTransactions?.length ? <div className="space-y-2">{data.xpTransactions.map(tx=><div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3"><div className="min-w-0"><p className="text-sm text-white truncate">{tx.reason}</p><p className="text-[11px] text-white/40">{tx.source} · {new Date(tx.createdAt).toLocaleString("ru-RU")}</p></div><div className="text-right shrink-0"><p className={`text-sm font-bold ${tx.amount>=0?"text-emerald-400":"text-red-400"}`}>{tx.amount>0?"+":""}{tx.amount} XP</p><p className="text-[10px] text-white/35">Баланс: {tx.balanceAfter}</p></div></div>)}</div> : <p className="text-xs text-white/40">История начислений появится после первой операции XP через администрацию.</p>}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/quests" className="glass rounded-xl p-3 text-center text-xs font-semibold text-white"><Gift size={18} className="mx-auto mb-1 text-amber-300"/>Задания</Link>
        <Link href="/community" className="glass rounded-xl p-3 text-center text-xs font-semibold text-white"><Users size={18} className="mx-auto mb-1 text-sky-300"/>Сообщество</Link>
        <Link href="/seasons" className="glass rounded-xl p-3 text-center text-xs font-semibold text-white"><Crown size={18} className="mx-auto mb-1 text-yellow-300"/>Сезоны</Link>
      </div>
      {progressError && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-300">{progressError}</p>}
      <VerificationManager />
      <Link href="/admin" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><ShieldCheck size={17} className="text-red-400" />Панель администрации</Link>

      <Link href="/settings" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><Settings size={17}/>Настройки профиля</Link>
      <div className="grid grid-cols-2 gap-3"><Link href="/nft" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><Gem size={17} className="text-violet-300"/>Мои NFT</Link><Link href="/messages" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><MessageCircle size={17} className="text-sky-300"/>Сообщения</Link></div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/leaderboard" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><Crown size={17} className="text-yellow-400" />Рейтинг игроков</Link>
        <Link href="/history" className="glass rounded-xl p-3 flex items-center gap-2 text-sm text-white"><History size={17} />История матчей</Link>
      </div>

      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3"><Ticket size={18} className="text-white/60" /><h2 className="font-medium text-white">Промокод</h2></div>
        <div className="flex gap-2"><input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Введи код" className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none" maxLength={20} /><button onClick={handlePromo} disabled={!promoCode.trim() || promoStatus === "loading"} className="px-5 py-2.5 bg-white text-black font-medium rounded-xl disabled:opacity-40">{promoStatus === "loading" ? "..." : "OK"}</button></div>
        {promoMessage && <p className={`text-sm mt-2 ${promoStatus === "error" ? "text-red-400" : "text-emerald-400"}`}>{promoMessage}</p>}
      </section>
    </div>
  );
}
