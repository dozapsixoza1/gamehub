"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Shield, Users, Ban, Star, ScrollText, UserPlus, Gift, PackageCheck, Gem } from "lucide-react";

type PanelData = {
  actor: { root: boolean; role: string | null; permissions: string[] };
  roles: { id: string; label: string; permissions: string[] }[];
  stats: { users: number; banned: number; verified: number; openReports: number };
  staff: { id: string; role: string; appointedAt: string; user: { username: string | null; firstName: string | null; isBanned: boolean } }[];
  logs: { id: string; action: string; reason: string | null; createdAt: string; targetUserId: string | null }[];
  users: { id: string; username: string | null; firstName: string | null; xp: number; level: number; isBanned: boolean; isVerified: boolean; isAdmin: boolean }[];
  reports: { id: string; reason: string; details: string | null; createdAt: string; author: { username: string | null; firstName: string | null }; target: { username: string | null; firstName: string | null } }[];
  warnings: { id: string; targetUserId: string | null; reason: string | null; createdAt: string }[];
  notes: { id: string; targetUserId: string | null; reason: string | null; metadata: { note?: string } | null; createdAt: string }[];
  nftOrders: { id: string; createdAt: string; buyerNote: string | null; user: { id: string; username: string | null; firstName: string | null }; gift: { id: string; name: string; rarity: string; imageUrl: string } }[];
  messageReports: { id: string; reason: string; createdAt: string; reporter: { username: string | null; firstName: string | null }; message: { content: string; sender: { username: string | null; firstName: string | null }; recipient: { username: string | null; firstName: string | null } } }[];
};

export default function AdminPage() {
  const { initData } = useTelegram();
  const [data, setData] = useState<PanelData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("moderator");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!initData) return;
    const res = await fetch("/api/admin", { headers: { "x-init-data": initData }, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Нет доступа");
    setData(json);
  };

  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : "Ошибка")); }, [initData]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!initData || busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action, username: username.trim().replace(/^@/, ""), role, amount: Number(amount), reason, ...extra }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Операция не выполнена");
      setMessage(json.message || "Готово");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети"); }
    finally { setBusy(false); }
  };

  const can = (p: string) => !!data?.actor.root || data?.actor.permissions.includes("*") || !!data?.actor.permissions.includes(p);

  if (error && !data) return <div className="max-w-lg mx-auto px-4 py-10 text-center"><Shield className="mx-auto text-red-400 mb-3" size={32}/><h1 className="text-xl font-bold text-white">Доступ закрыт</h1><p className="text-sm text-white/50 mt-2">{error}</p><Link href="/profile" className="inline-block mt-5 text-sm text-white/70">Вернуться в профиль</Link></div>;
  if (!data) return <div className="min-h-[50vh] flex items-center justify-center text-white/50">Загрузка панели...</div>;

  return <div className="max-w-lg mx-auto px-4 pt-6 pb-10 space-y-4">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-red-500/15 text-red-300"><Shield size={24}/></div><div><h1 className="text-2xl font-black text-white">Администрация</h1><p className="text-xs text-white/40">{data.actor.root ? "Владелец проекта" : data.actor.role || "Сотрудник"}</p></div></div>
    <div className="grid grid-cols-2 gap-2">
      {[["Игроки",data.stats.users,Users],["Блокировки",data.stats.banned,Ban],["Верификация",data.stats.verified,Star],["Открытые жалобы",data.stats.openReports,ScrollText]].map(([label,value,Icon]: any)=><div key={label} className="glass rounded-xl p-3"><div className="flex items-center gap-2 text-xs text-white/45"><Icon size={14}/>{label}</div><p className="text-2xl font-black text-white mt-1">{value}</p></div>)}
    </div>

    {data.actor.root && can("staff_manage") && <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-white"><UserPlus size={18}/><h2 className="font-semibold">Состав администрации</h2></div>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username игрока" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-[#171717] border border-white/10 rounded-xl p-3 text-sm text-white">{data.roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина назначения / снятия" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <div className="grid grid-cols-2 gap-2"><button disabled={busy||!username.trim()} onClick={()=>act("assign_staff")} className="rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-40">Назначить</button><button disabled={busy||!username.trim()} onClick={()=>act("remove_staff")} className="rounded-xl bg-white/10 py-3 text-sm text-white disabled:opacity-40">Снять должность</button></div>
      <div className="space-y-2 pt-2"><p className="text-xs uppercase tracking-wider text-white/40">Текущий состав</p>{data.staff.length?data.staff.map(s=><div key={s.id} className="flex justify-between gap-3 rounded-lg bg-white/5 p-3"><div><p className="text-sm text-white">@{s.user.username||"без username"}</p><p className="text-xs text-white/40">{data.roles.find(r=>r.id===s.role)?.label||s.role}</p></div><span className="text-xs text-white/40">{s.user.isBanned?"Заблокирован":"Активен"}</span></div>):<p className="text-xs text-white/40">Состав пока пуст</p>}</div>
    </section>}

    {can("reports_manage") && <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Жалобы на личные сообщения</h2>
      {data.messageReports.length ? data.messageReports.map(r=><div key={r.id} className="rounded-xl bg-white/5 p-3 space-y-2"><p className="text-xs text-white/50">{r.reporter.firstName||r.reporter.username||"Игрок"} пожаловался на {r.message.sender.firstName||r.message.sender.username||"игрока"}</p><p className="rounded-lg bg-black/20 p-3 text-sm text-white">{r.message.content}</p><p className="text-xs text-amber-200">{r.reason}</p><div className="flex gap-2"><button disabled={busy} onClick={()=>act("resolve_message_report",{reportId:r.id,status:"RESOLVED"})} className="flex-1 rounded-lg bg-emerald-600/80 py-2 text-xs text-white">Решено</button><button disabled={busy} onClick={()=>act("resolve_message_report",{reportId:r.id,status:"REJECTED"})} className="flex-1 rounded-lg bg-white/10 py-2 text-xs text-white">Отклонить</button></div></div>):<p className="text-xs text-white/40">Жалоб нет</p>}
    </section>}

    {data.actor.root && <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-white"><Gift size={18} className="text-violet-300"/><h2 className="font-semibold">Заявки на NFT-подарки</h2><span className="ml-auto rounded-full bg-violet-500/15 px-2 py-1 text-[10px] text-violet-200">{data.nftOrders.length}</span></div>
      <p className="text-xs text-white/40">Сначала согласуй оплату с покупателем в личных сообщениях. Затем выдай подарок кнопкой ниже.</p>
      {data.nftOrders.length ? data.nftOrders.map(o=><div key={o.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><img src={o.gift.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{o.gift.name}</p><p className="text-xs text-white/45">{o.user.firstName||"Игрок"} {o.user.username?"@"+o.user.username:""} · {o.gift.rarity}</p>{o.buyerNote&&<p className="text-[10px] text-white/35 mt-1">{o.buyerNote}</p>}<p className="text-[9px] text-white/25 mt-1">Заявка {o.id.slice(-8)}</p></div><button disabled={busy} onClick={()=>act("issue_nft",{orderId:o.id})} className="shrink-0 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"><PackageCheck size={15} className="mx-auto mb-1"/>Выдать</button></div>):<p className="py-5 text-center text-xs text-white/35">Новых заявок пока нет</p>}
    </section>}

    {can("xp_manage") && <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-white"><Star size={18} className="text-amber-300"/><h2 className="font-semibold">Управление XP</h2></div>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username игрока" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" placeholder="Например 500 или -100" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина начисления / снятия" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <button disabled={busy||!username.trim()||!reason.trim()} onClick={()=>act("adjust_xp")} className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-40">Изменить XP</button>
      <p className="text-[11px] text-white/35">Все операции сохраняются в журнале администрации.</p>
    </section>}

    {data.actor.root && <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Gem size={18} className="text-violet-300"/><h2 className="font-semibold text-white">NFT · заявки на выдачу</h2></div>
      <p className="text-xs text-white/40">Подтверждай только после проверки оплаты. Выдача добавляет предмет прямо в коллекцию игрока.</p>
      {data.nftOrders.length ? data.nftOrders.map(o=><div key={o.id} className="rounded-xl bg-white/5 p-3 space-y-2">
        <div className="flex items-center gap-3"><img src={o.gift.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{o.gift.name}</p><p className="text-[11px] text-white/40">{o.gift.rarity} · {o.user.username?"@"+o.user.username:o.user.firstName||"Игрок"}</p><p className="text-[10px] text-white/25">{o.id}</p></div></div>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>act("approve_nft_order",{orderId:o.id})} className="rounded-lg bg-emerald-500/20 py-2.5 text-xs font-bold text-emerald-200 disabled:opacity-40">Оплата получена · выдать</button><button disabled={busy||reason.trim().length<5} onClick={()=>act("reject_nft_order",{orderId:o.id})} className="rounded-lg bg-red-500/10 py-2.5 text-xs text-red-200 disabled:opacity-40">Отклонить</button></div>
      </div>) : <p className="text-xs text-white/40">Новых заявок нет</p>}
      <p className="text-[10px] text-white/30">Для отказа укажи причину в поле причины ниже.</p>
    </section>}

    {can("users_ban") && <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-white"><Ban size={18} className="text-red-400"/><h2 className="font-semibold">Модерация игроков</h2></div>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username игрока" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина блокировки / разблокировки" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <div className="grid grid-cols-2 gap-2"><button disabled={busy||!username.trim()||!reason.trim()} onClick={()=>act("set_ban",{banned:true})} className="rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-40">Заблокировать</button><button disabled={busy||!username.trim()||!reason.trim()} onClick={()=>act("set_ban",{banned:false})} className="rounded-xl bg-white/10 py-3 text-sm text-white disabled:opacity-40">Разблокировать</button></div>
    </section>}

    {can("reports_manage") && <section className="glass rounded-2xl p-4 space-y-3"><h2 className="font-semibold text-white">Очередь жалоб</h2>{data.reports.length?data.reports.map(report=><div key={report.id} className="rounded-xl bg-white/5 p-3 space-y-2"><p className="text-sm text-white">{report.author.firstName||report.author.username||"Игрок"} → {report.target.firstName||report.target.username||"Игрок"}</p><p className="text-xs text-white/65">{report.reason}</p>{report.details&&<p className="text-xs text-white/40">{report.details}</p>}<div className="flex gap-2"><button disabled={busy||!reason.trim()} onClick={()=>act("resolve_report",{reportId:report.id,status:"RESOLVED"})} className="flex-1 rounded-lg bg-emerald-600/80 py-2 text-xs text-white disabled:opacity-40">Решено</button><button disabled={busy||!reason.trim()} onClick={()=>act("resolve_report",{reportId:report.id,status:"REJECTED"})} className="flex-1 rounded-lg bg-white/10 py-2 text-xs text-white disabled:opacity-40">Отклонить</button></div></div>):<p className="text-xs text-white/40">Открытых жалоб нет</p>}<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина решения по жалобе (минимум 5 символов)" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/></section>}

    {can("users_ban") && <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Предупреждения</h2>
      <p className="text-xs text-white/40">Фиксируй нарушения игрока. Каждое предупреждение попадает в журнал.</p>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username игрока" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина предупреждения" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <button disabled={busy||!username.trim()||reason.trim().length<5} onClick={()=>act("issue_warning")} className="w-full rounded-xl bg-amber-500/20 text-amber-200 py-3 text-sm font-semibold disabled:opacity-40">Выдать предупреждение</button>
      <div className="space-y-2">{data.warnings.map(w=><div key={w.id} className="rounded-lg bg-white/5 p-3 text-xs"><p className="text-white">{w.reason}</p><p className="text-white/35 mt-1">{new Date(w.createdAt).toLocaleString("ru-RU")}</p></div>)}</div>
    </section>}

    {can("logs_view") && <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Внутренние заметки</h2>
      <p className="text-xs text-white/40">Заметки видны только сотрудникам с доступом к журналу администрации.</p>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username игрока" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Служебная заметка о ситуации" className="w-full min-h-20 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white"/>
      <button disabled={busy||!username.trim()||reason.trim().length<5} onClick={()=>act("add_note")} className="w-full rounded-xl bg-white/10 py-3 text-sm text-white disabled:opacity-40">Сохранить заметку</button>
      <div className="space-y-2">{data.notes.map(n=><div key={n.id} className="rounded-lg bg-white/5 p-3"><p className="text-xs text-white">{n.metadata?.note||n.reason}</p><p className="text-[11px] text-white/35 mt-1">{new Date(n.createdAt).toLocaleString("ru-RU")}</p></div>)}</div>
    </section>}

    {can("users_view") && <section className="glass rounded-2xl p-4 space-y-2"><h2 className="font-semibold text-white">Последние игроки</h2>{data.users.map(u=><div key={u.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-2"><div className="min-w-0"><p className="text-sm text-white truncate">{u.firstName||u.username||"Игрок"} <span className="text-white/35">{u.username?"@"+u.username:""}</span></p><p className="text-xs text-white/40">Уровень {u.level} · {u.xp} XP</p></div><span className={u.isBanned?"text-red-400":"text-emerald-400"}>{u.isBanned?"БАН":"OK"}</span></div>)}</section>}

    {can("logs_view") && <section className="glass rounded-2xl p-4 space-y-2"><h2 className="font-semibold text-white">Журнал действий</h2>{data.logs.length?data.logs.map(l=><div key={l.id} className="rounded-lg bg-white/5 p-3"><p className="text-xs text-white">{l.action}</p><p className="text-[11px] text-white/40">{l.reason||"Без причины"} · {new Date(l.createdAt).toLocaleString("ru-RU")}</p></div>):<p className="text-xs text-white/40">Записей пока нет</p>}</section>}
    {(message||error)&&<div className={`rounded-xl p-3 text-sm ${error?"text-red-300 bg-red-500/10":"text-emerald-300 bg-emerald-500/10"}`}>{error||message}</div>}
  </div>;
}
