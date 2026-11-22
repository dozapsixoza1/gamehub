"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, Check, CircleUserRound, Crown, Gamepad2, Plus, Search, Shield, Swords, Users } from "lucide-react";
import { useTelegram } from "@/components/layout/TelegramProvider";

type Person = { id: string; username: string | null; name: string; avatar?: string | null; isOnline?: boolean };
type Dashboard = {
  friends: Person[];
  incomingRequests: { id: string; user: Person }[];
  outgoingRequests: { id: string; user: Person }[];
  challenges: { id: string; gameId: string; status: string; incoming: boolean; opponent: Person; createdAt: string }[];
  clans: { id: string; name: string; slug: string; emblem: string | null; description: string | null; role: string; members: number }[];
  notifications: { id: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string }[];
  unreadNotifications: number;
};

const empty: Dashboard = { friends: [], incomingRequests: [], outgoingRequests: [], challenges: [], clans: [], notifications: [], unreadNotifications: 0 };

export default function CommunityPage() {
  const { initData } = useTelegram();
  const [data, setData] = useState<Dashboard>(empty);
  const [publicClans, setPublicClans] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [clanName, setClanName] = useState("");
  const [clanDescription, setClanDescription] = useState("");
  const [tab, setTab] = useState("friends");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!initData) return;
    try {
      const response = await fetch("/api/community", { headers: { "x-init-data": initData }, cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Ошибка загрузки");
      setData({ ...empty, ...json });
      const clansResponse = await fetch("/api/community?type=clans", { headers: { "x-init-data": initData }, cache: "no-store" });
      const clansJson = await clansResponse.json();
      setPublicClans(clansJson.clans || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [initData]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!initData || query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    fetch("/api/community?type=search&q=" + encodeURIComponent(query.trim()), { headers: { "x-init-data": initData }, signal: controller.signal })
      .then((response) => response.json()).then((json) => setResults(json.users || [])).catch(() => {});
    return () => controller.abort();
  }, [initData, query]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!initData || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action, ...extra }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Не удалось выполнить действие");
      setMessage("Готово");
      setQuery("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: "friends", label: "Друзья", icon: Users },
    { id: "challenges", label: "Вызовы", icon: Swords },
    { id: "clans", label: "Кланы", icon: Shield },
    { id: "notifications", label: "Уведомления", icon: Bell },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8 pt-6">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/55"><ArrowLeft size={16}/>Профиль</Link>
      <header><h1 className="text-2xl font-bold text-white">Сообщество</h1><p className="text-xs text-white/40">Друзья, игровые вызовы, кланы и уведомления</p></header>
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1">
        {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={"flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] " + (tab === item.id ? "bg-white text-black" : "text-white/55")}><Icon size={17}/><span className="truncate">{item.label}</span></button>; })}
      </div>

      {tab === "friends" && <div className="space-y-3">
        <section className="glass space-y-3 rounded-2xl p-4">
          <h2 className="flex items-center gap-2 font-semibold text-white"><Search size={17}/>Найти игрока</h2>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ник или @username" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/>
          {results.map((person) => <div key={person.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><CircleUserRound size={22} className="text-white/45"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{person.name}</p><p className="text-xs text-white/35">{person.username ? "@" + person.username : "Игрок GameHub"}</p></div><button onClick={() => act("friend_request", { playerId: person.id })} disabled={busy} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-40">Добавить</button></div>)}
        </section>
        {data.incomingRequests.length > 0 && <section className="glass space-y-2 rounded-2xl p-4"><h2 className="font-semibold text-white">Входящие заявки</h2>{data.incomingRequests.map((item) => <div key={item.id} className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-sm text-white">{item.user.name}</p><button onClick={() => act("friend_accept", { requestId: item.id })} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300"><Check size={16}/></button><button onClick={() => act("friend_decline", { requestId: item.id })} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">Отклонить</button></div>)}</section>}
        <section className="glass space-y-2 rounded-2xl p-4"><h2 className="font-semibold text-white">Мои друзья · {data.friends.length}</h2>{data.friends.length ? data.friends.map((person) => <div key={person.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className={"h-2 w-2 rounded-full " + (person.isOnline ? "bg-emerald-400" : "bg-white/20")}/><p className="min-w-0 flex-1 truncate text-sm text-white">{person.name}</p><button onClick={() => act("challenge_create", { playerId: person.id, gameId: "mafia" })} className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">Вызвать</button><Link href={"/messages?with=" + encodeURIComponent(person.id)} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/65">Чат</Link></div>) : <p className="text-xs text-white/40">Пока нет друзей. Найди игроков выше.</p>}</section>
      </div>}

      {tab === "challenges" && <section className="glass space-y-3 rounded-2xl p-4"><h2 className="font-semibold text-white">Игровые вызовы</h2>{data.challenges.length ? data.challenges.map((challenge) => <div key={challenge.id} className="rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2"><Gamepad2 size={17} className="text-red-300"/><p className="min-w-0 flex-1 truncate text-sm text-white">{challenge.opponent.name}</p><span className="text-[10px] text-white/40">{challenge.status}</span></div>{challenge.incoming && challenge.status === "PENDING" && <div className="mt-3 flex gap-2"><button onClick={() => act("challenge_respond", { challengeId: challenge.id, accept: true })} className="flex-1 rounded-lg bg-emerald-500/15 py-2 text-xs text-emerald-300">Принять</button><button onClick={() => act("challenge_respond", { challengeId: challenge.id, accept: false })} className="flex-1 rounded-lg bg-white/5 py-2 text-xs text-white/60">Отклонить</button></div>}</div>) : <p className="text-xs text-white/40">Пока нет вызовов. Вызови друга из списка друзей.</p>}</section>}

      {tab === "clans" && <div className="space-y-3">
        <section className="glass space-y-3 rounded-2xl p-4"><h2 className="flex items-center gap-2 font-semibold text-white"><Plus size={17}/>Создать клан</h2><input value={clanName} onChange={(event) => setClanName(event.target.value)} maxLength={28} placeholder="Название клана" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/><input value={clanDescription} onChange={(event) => setClanDescription(event.target.value)} maxLength={180} placeholder="Описание (необязательно)" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/><button onClick={async () => { await act("clan_create", { name: clanName, description: clanDescription }); setClanName(""); setClanDescription(""); }} disabled={busy || clanName.trim().length < 3} className="w-full rounded-xl bg-white py-3 text-sm font-bold text-black disabled:opacity-40">Создать клан</button></section>
        <section className="glass space-y-2 rounded-2xl p-4"><h2 className="font-semibold text-white">Мои кланы</h2>{data.clans.length ? data.clans.map((clan) => <div key={clan.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className="text-2xl">{clan.emblem || "🛡️"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{clan.name}</p><p className="text-xs text-white/40">{clan.members} участников · {clan.role}</p></div><button onClick={() => act("clan_leave", { clanId: clan.id })} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">Выйти</button></div>) : <p className="text-xs text-white/40">Ты пока не состоишь в клане.</p>}</section>
        <section className="glass space-y-2 rounded-2xl p-4"><h2 className="font-semibold text-white">Открытые кланы</h2>{publicClans.map((clan) => <div key={clan.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className="text-xl">{clan.emblem || "🛡️"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm text-white">{clan.name}</p><p className="text-xs text-white/40">{clan._count?.members || 0} участников</p></div><button onClick={() => act("clan_join", { clanId: clan.id })} disabled={busy || data.clans.some((own) => own.id === clan.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-35">{data.clans.some((own) => own.id === clan.id) ? "Участник" : "Вступить"}</button></div>)}</section>
      </div>}

      {tab === "notifications" && <section className="glass space-y-3 rounded-2xl p-4"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Уведомления</h2><button onClick={() => act("notifications_read")} className="text-xs text-white/45">Прочитать все</button></div>{data.notifications.length ? data.notifications.map((item) => <div key={item.id} className={"rounded-xl p-3 " + (item.readAt ? "bg-white/5" : "bg-red-500/10")}><div className="flex items-start gap-2"><Bell size={15} className="mt-0.5 shrink-0 text-red-300"/><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{item.title}</p>{item.body && <p className="mt-1 text-xs text-white/50">{item.body}</p>}<p className="mt-1 text-[10px] text-white/30">{new Date(item.createdAt).toLocaleString("ru-RU")}</p></div>{item.href && <Link href={item.href} className="text-xs text-white/55">Открыть</Link>}</div></div>) : <p className="text-xs text-white/40">Новых уведомлений пока нет.</p>}</section>}

      {message && <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">{message}</p>}
      {loading && <p className="text-center text-xs text-white/40">Загрузка сообщества...</p>}
    </div>
  );
}
