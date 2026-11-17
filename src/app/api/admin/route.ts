import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const ROLE_PERMISSIONS: Record<string, string[]> = {
  deputy_owner: ["admin_access", "staff_manage", "users_view", "users_ban", "reports_manage", "xp_manage", "verification_manage", "rooms_manage", "events_manage", "economy_manage", "logs_view"],
  admin_head: ["admin_access", "staff_manage", "users_view", "users_ban", "reports_manage", "xp_manage", "verification_manage", "rooms_manage", "logs_view"],
  deputy_head: ["admin_access", "users_view", "users_ban", "reports_manage", "xp_manage", "verification_manage", "rooms_manage", "logs_view"],
  chief_admin: ["admin_access", "users_view", "users_ban", "reports_manage", "xp_manage", "verification_manage", "rooms_manage", "logs_view"],
  senior_admin: ["admin_access", "users_view", "users_ban", "reports_manage", "xp_manage", "verification_manage", "rooms_manage"],
  admin: ["admin_access", "users_view", "users_ban", "reports_manage", "verification_manage"],
  junior_admin: ["admin_access", "users_view", "reports_manage"],
  moderator: ["admin_access", "users_view", "reports_manage"],
  support: ["admin_access", "users_view"],
  event_manager: ["admin_access", "users_view", "events_manage"],
  trainee: ["admin_access", "users_view"],
};

const ROLE_LABELS: Record<string, string> = {
  deputy_owner: "Заместитель владельца",
  admin_head: "Руководитель администрации",
  deputy_head: "Заместитель руководителя",
  chief_admin: "Главный администратор",
  senior_admin: "Старший администратор",
  admin: "Администратор",
  junior_admin: "Младший администратор",
  moderator: "Модератор",
  support: "Специалист поддержки",
  event_manager: "Менеджер мероприятий",
  trainee: "Стажёр администрации",
};

function rootIds() {
  return (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(v => v.trim()).filter(v => /^\d+$/.test(v));
}

async function getActor(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  const telegramId = BigInt(auth.user.id);
  const user = await prisma.user.findUnique({ where: { telegramId }, include: { adminStaff: true } });
  if (!user || user.isBanned) return null;
  const root = rootIds().includes(telegramId.toString());
  const role = user.adminStaff?.role || null;
  const permissions = root ? ["*"] : (user.adminStaff?.permissions as string[] | null) || ROLE_PERMISSIONS[role || ""] || [];
  return { user, telegramId, root, role, permissions };
}

function allowed(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>, permission: string) {
  return actor.root || actor.permissions.includes("*") || actor.permissions.includes(permission);
}

async function logAction(actorTelegramId: bigint, action: string, targetUserId?: string | null, reason?: string | null, metadata?: object) {
  await prisma.adminActionLog.create({
    data: { actorTelegramId, action, targetUserId: targetUserId || null, reason: reason || null, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined },
  });
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req.headers.get("x-init-data") || req.nextUrl.searchParams.get("initData") || "");
    if (!actor || !allowed(actor, "admin_access")) return NextResponse.json({ error: "Нет доступа к администрации" }, { status: 403 });
    const canViewUsers = allowed(actor, "users_view");
    const [usersCount, bannedCount, verifiedCount, openReports, reports, staff, logs, users, warnings, notes, nftOrders, messageReports] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.playerReport.count({ where: { status: "OPEN" } }),
      allowed(actor, "reports_manage") ? prisma.playerReport.findMany({ where: { status: "OPEN" }, include: { author: { select: { username: true, firstName: true } }, target: { select: { username: true, firstName: true } } }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
      prisma.adminStaff.findMany({ include: { user: { select: { id: true, username: true, firstName: true, isBanned: true } } }, orderBy: { appointedAt: "desc" }, take: 100 }),
      allowed(actor, "logs_view") ? prisma.adminActionLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
      canViewUsers ? prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, username: true, firstName: true, xp: true, level: true, isBanned: true, isVerified: true, isAdmin: true } }) : Promise.resolve([]),
      allowed(actor, "users_ban") ? prisma.adminActionLog.findMany({ where: { action: "warning_issued" }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
      allowed(actor, "logs_view") ? prisma.adminActionLog.findMany({ where: { action: "admin_note_added" }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
      actor.root ? prisma.nftOrder.findMany({ where: { status: "PENDING" }, include: { user: { select: { id: true, username: true, firstName: true } }, gift: true }, orderBy: { createdAt: "asc" }, take: 100 }) : Promise.resolve([]),
      allowed(actor, "reports_manage") ? prisma.messageReport.findMany({ where: { status: "OPEN" }, include: { reporter: { select: { username: true, firstName: true } }, message: { include: { sender: { select: { username: true, firstName: true } }, recipient: { select: { username: true, firstName: true } } } } }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
    ]);
    const nftOrders = actor.root ? await prisma.nftOrder.findMany({ where: { status: "PENDING" }, include: { gift: true, user: { select: { id: true, username: true, firstName: true } } }, orderBy: { createdAt: "asc" }, take: 50 }) : [];
    return NextResponse.json({
      actor: { root: actor.root, role: actor.role, permissions: actor.permissions },
      roles: Object.entries(ROLE_LABELS).map(([id, label]) => ({ id, label, permissions: ROLE_PERMISSIONS[id] })),
      stats: { users: usersCount, banned: bannedCount, verified: verifiedCount, openReports },
      staff, logs, users, reports, warnings, notes, nftOrders, messageReports, nftOrders,
    });
  } catch (error) {
    console.error("Admin GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить панель" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actor = await getActor(String(body.initData || ""));
    if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const action = String(body.action || "");
    const username = String(body.username || "").trim().replace(/^@/, "").toLowerCase();
    const reason = String(body.reason || "").trim().slice(0, 300);

    if (action === "assign_staff" || action === "remove_staff") {
      if (!actor.root) return NextResponse.json({ error: "Назначать и снимать сотрудников может только владелец проекта" }, { status: 403 });
      if (!/^[a-z0-9_]{5,32}$/.test(username)) return NextResponse.json({ error: "Укажи корректный Telegram username" }, { status: 400 });
      const target = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } }, select: { id: true, username: true, telegramId: true, isAdmin: true } });
      if (!target) return NextResponse.json({ error: "Игрок не найден. Он должен хотя бы один раз войти в GameHub" }, { status: 404 });
      if (rootIds().includes(target.telegramId.toString()) || target.isAdmin) return NextResponse.json({ error: "Нельзя менять статус владельца" }, { status: 403 });
      if (action === "remove_staff") {
        await prisma.adminStaff.deleteMany({ where: { userId: target.id } });
        await logAction(actor.telegramId, "staff_removed", target.id, reason || "Снятие с должности");
        return NextResponse.json({ success: true, message: "Сотрудник снят с должности" });
      }
      const role = String(body.role || "");
      if (!ROLE_PERMISSIONS[role]) return NextResponse.json({ error: "Неизвестная должность" }, { status: 400 });
      await prisma.adminStaff.upsert({
        where: { userId: target.id },
        create: { userId: target.id, role, permissions: ROLE_PERMISSIONS[role], appointedBy: actor.telegramId },
        update: { role, permissions: ROLE_PERMISSIONS[role], appointedBy: actor.telegramId },
      });
      await logAction(actor.telegramId, "staff_assigned", target.id, reason || "Назначение на должность", { role, roleLabel: ROLE_LABELS[role] });
      return NextResponse.json({ success: true, message: `@${target.username} назначен: ${ROLE_LABELS[role]}` });
    }

    if (action === "resolve_message_report") {
      if (!allowed(actor, "reports_manage")) return NextResponse.json({ error: "Нет права разбирать жалобы" }, { status: 403 });
      const reportId = String(body.reportId || "");
      const status = body.status === "REJECTED" ? "REJECTED" : "RESOLVED";
      if (!reportId) return NextResponse.json({ error: "Не указана жалоба" }, { status: 400 });
      await prisma.messageReport.update({ where: { id: reportId }, data: { status } });
      await logAction(actor.telegramId, "message_report_" + status.toLowerCase(), null, reason || "Жалоба на личное сообщение", { reportId });
      return NextResponse.json({ success: true, message: "Жалоба на сообщение обработана" });
    }

    if (action === "issue_nft") {
      if (!actor.root) return NextResponse.json({ error: "Выдавать NFT может только владелец проекта" }, { status: 403 });
      const orderId = String(body.orderId || "");
      const order = await prisma.nftOrder.findUnique({ where: { id: orderId }, include: { gift: true } });
      if (!order || order.status !== "PENDING") return NextResponse.json({ error: "Заявка не найдена или уже обработана" }, { status: 404 });
      const serialNumber = (await prisma.userNft.count({ where: { giftId: order.giftId } })) + 1;
      await prisma.$transaction([
        prisma.userNft.create({ data: { userId: order.userId, giftId: order.giftId, orderId: order.id, serialNumber } }),
        prisma.nftOrder.update({ where: { id: order.id }, data: { status: "DELIVERED", adminNote: reason || "Выдано владельцем" } }),
        prisma.adminActionLog.create({ data: { actorTelegramId: actor.telegramId, targetUserId: order.userId, action: "nft_issued", reason: reason || "NFT выдан", metadata: { orderId, giftId: order.giftId, serialNumber } } })
      ]);
      return NextResponse.json({ success: true, message: order.gift.name + " выдан игроку" });
    }

    if (action === "adjust_xp") {
      if (!allowed(actor, "xp_manage")) return NextResponse.json({ error: "Нет права управлять XP" }, { status: 403 });
      if (!/^[a-z0-9_]{5,32}$/.test(username)) return NextResponse.json({ error: "Укажи корректный username" }, { status: 400 });
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 100000 || reason.length < 5) return NextResponse.json({ error: "Укажи XP от -100000 до 100000 и причину от 5 символов" }, { status: 400 });
      const target = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
      if (!target) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      if (target.isAdmin || rootIds().includes(target.telegramId.toString())) return NextResponse.json({ error: "Нельзя менять XP владельца проекта" }, { status: 403 });
      const xp = Math.max(0, target.xp + amount);
      const applied = xp - target.xp;
      const level = Math.floor(Math.sqrt(xp / 100)) + 1;
      await prisma.$transaction([
        prisma.user.update({ where: { id: target.id }, data: { xp, level } }),
        prisma.xpTransaction.create({ data: { userId: target.id, amount: applied, balanceAfter: xp, source: "ADMIN", reason, actorTelegramId: actor.telegramId } }),
        prisma.adminActionLog.create({ data: { actorTelegramId: actor.telegramId, targetUserId: target.id, action: "xp_adjusted", reason, metadata: { requestedAmount: amount, appliedAmount: applied, balanceAfter: xp } } }),
      ]);
      return NextResponse.json({ success: true, message: `XP обновлён. Текущий баланс: ${xp}` });
    }

    if (action === "set_ban") {
      if (!allowed(actor, "users_ban")) return NextResponse.json({ error: "Нет права блокировать игроков" }, { status: 403 });
      if (!/^[a-z0-9_]{5,32}$/.test(username) || typeof body.banned !== "boolean" || reason.length < 5) return NextResponse.json({ error: "Проверь username, статус и причину" }, { status: 400 });
      const target = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
      if (!target) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      if (target.id === actor.user.id || rootIds().includes(target.telegramId.toString()) || target.isAdmin) return NextResponse.json({ error: "Нельзя применить это действие к владельцу или самому себе" }, { status: 403 });
      await prisma.$transaction([
        prisma.user.update({ where: { id: target.id }, data: { isBanned: body.banned } }),
        prisma.adminActionLog.create({ data: { actorTelegramId: actor.telegramId, targetUserId: target.id, action: body.banned ? "user_banned" : "user_unbanned", reason } }),
      ]);
      return NextResponse.json({ success: true, message: body.banned ? "Игрок заблокирован" : "Блокировка снята" });
    }

    if (action === "issue_warning") {
      if (!allowed(actor, "users_ban")) return NextResponse.json({ error: "Нет права выдавать предупреждения" }, { status: 403 });
      if (!/^[a-z0-9_]{5,32}$/.test(username) || reason.length < 5) return NextResponse.json({ error: "Укажи username и причину предупреждения" }, { status: 400 });
      const target = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
      if (!target) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      if (target.isAdmin || rootIds().includes(target.telegramId.toString()) || target.id === actor.user.id) return NextResponse.json({ error: "Нельзя выдать предупреждение владельцу или себе" }, { status: 403 });
      await logAction(actor.telegramId, "warning_issued", target.id, reason, { points: 1 });
      return NextResponse.json({ success: true, message: "Предупреждение выдано и записано в историю" });
    }

    if (action === "add_note") {
      if (!allowed(actor, "logs_view")) return NextResponse.json({ error: "Нет права добавлять внутренние заметки" }, { status: 403 });
      if (!/^[a-z0-9_]{5,32}$/.test(username) || reason.length < 5) return NextResponse.json({ error: "Укажи username и текст заметки" }, { status: 400 });
      const target = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
      if (!target) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      await logAction(actor.telegramId, "admin_note_added", target.id, "Внутренняя заметка", { note: reason });
      return NextResponse.json({ success: true, message: "Внутренняя заметка сохранена" });
    }

    if (action === "approve_nft_order") {
      if (!actor.root) return NextResponse.json({ error: "Выдавать NFT может только владелец проекта" }, { status: 403 });
      const orderId = String(body.orderId || "");
      if (!orderId) return NextResponse.json({ error: "Не указана заявка" }, { status: 400 });
      const order = await prisma.nftOrder.findUnique({ where: { id: orderId }, include: { gift: true, user: true } });
      if (!order || order.status !== "PENDING") return NextResponse.json({ error: "Заявка уже обработана или не найдена" }, { status: 404 });
      if (order.gift.supply !== null && order.gift.issued >= order.gift.supply) return NextResponse.json({ error: "Лимитированная серия закончилась" }, { status: 409 });
      await prisma.$transaction(async (tx) => {
        const changed = await tx.nftOrder.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "DELIVERED", adminNote: reason || "Оплата подтверждена владельцем" } });
        if (changed.count !== 1) throw new Error("Заявка уже обработана");
        await tx.userNft.create({ data: { userId: order.userId, giftId: order.giftId, orderId: order.id, serialNumber: order.gift.issued + 1 } });
        await tx.nftGift.update({ where: { id: order.giftId }, data: { issued: { increment: 1 } } });
        await tx.adminActionLog.create({ data: { actorTelegramId: actor.telegramId, targetUserId: order.userId, action: "nft_gift_delivered", reason: reason || "NFT выдан после подтверждения оплаты", metadata: { orderId: order.id, giftId: order.giftId, giftName: order.gift.name } } });
      });
      return NextResponse.json({ success: true, message: "NFT выдан игроку в коллекцию" });
    }

    if (action === "reject_nft_order") {
      if (!actor.root) return NextResponse.json({ error: "Управлять NFT-заявками может только владелец проекта" }, { status: 403 });
      const orderId = String(body.orderId || "");
      if (!orderId || reason.length < 5) return NextResponse.json({ error: "Укажи заявку и причину отказа" }, { status: 400 });
      const changed = await prisma.nftOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED", adminNote: reason } });
      if (!changed.count) return NextResponse.json({ error: "Заявка уже обработана или не найдена" }, { status: 404 });
      await logAction(actor.telegramId, "nft_order_cancelled", null, reason, { orderId });
      return NextResponse.json({ success: true, message: "Заявка отклонена" });
    }

    if (action === "resolve_report") {
      if (!allowed(actor, "reports_manage")) return NextResponse.json({ error: "Нет права разбирать жалобы" }, { status: 403 });
      const reportId = String(body.reportId || "");
      const status = body.status === "REJECTED" ? "REJECTED" : "RESOLVED";
      if (!reportId || reason.length < 5) return NextResponse.json({ error: "Укажи жалобу и причину решения" }, { status: 400 });
      const report = await prisma.playerReport.update({ where: { id: reportId }, data: { status } });
      await logAction(actor.telegramId, "report_" + status.toLowerCase(), report.targetId, reason, { reportId });
      return NextResponse.json({ success: true, message: "Решение по жалобе сохранено" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Admin POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
