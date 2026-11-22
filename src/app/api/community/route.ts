import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token || !initData) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  return prisma.user.findUnique({
    where: { telegramId: BigInt(auth.user.id) },
    select: { id: true, telegramId: true, isAdmin: true, isBanned: true, xp: true, coins: true },
  });
}

function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

async function notify(userId: string, type: string, title: string, body: string, href?: string) {
  await prisma.appNotification.create({ data: { userId, type, title, body, href } });
}

export async function GET(req: NextRequest) {
  try {
    const me = await getUser(req.headers.get("x-init-data") || req.nextUrl.searchParams.get("initData") || "");
    if (!me || me.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    const type = req.nextUrl.searchParams.get("type") || "dashboard";
    if (type === "search") {
      const q = (req.nextUrl.searchParams.get("q") || "").trim().replace(/^@/, "");
      if (q.length < 2) return NextResponse.json({ users: [] });
      const users = await prisma.user.findMany({
        where: { id: { not: me.id }, isBanned: false, OR: [
          { username: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { settings: { is: { displayName: { contains: q, mode: "insensitive" } } } },
        ] },
        take: 12,
        select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true, settings: { select: { displayName: true, avatarUrl: true } } },
      });
      return NextResponse.json({ users: users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.settings?.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Игрок",
        avatar: user.settings?.avatarUrl || user.photoUrl,
      })) });
    }

    if (type === "dashboard") {
      const [friendships, challenges, memberships, notifications] = await Promise.all([
        prisma.friendship.findMany({
          where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
          include: {
            requester: { select: { id: true, username: true, firstName: true, photoUrl: true, lastActiveAt: true } },
            addressee: { select: { id: true, username: true, firstName: true, photoUrl: true, lastActiveAt: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.playerChallenge.findMany({
          where: { OR: [{ challengerId: me.id }, { challengedId: me.id }] },
          include: {
            challenger: { select: { id: true, username: true, firstName: true } },
            challenged: { select: { id: true, username: true, firstName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.clanMember.findMany({
          where: { userId: me.id },
          include: { clan: { include: { _count: { select: { members: true } } } } },
          orderBy: { joinedAt: "desc" },
        }),
        prisma.appNotification.findMany({
          where: { userId: me.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      ]);

      const person = (relation: typeof friendships[number]) => relation.requesterId === me.id ? relation.addressee : relation.requester;
      return NextResponse.json({
        friends: friendships.filter((item) => item.status === "ACCEPTED").map((item) => {
          const user = person(item);
          return { id: user.id, username: user.username, name: user.firstName || user.username || "Игрок", avatar: user.photoUrl, isOnline: Date.now() - user.lastActiveAt.getTime() < 90_000 };
        }),
        incomingRequests: friendships.filter((item) => item.status === "PENDING" && item.addresseeId === me.id).map((item) => ({ id: item.id, user: { id: item.requester.id, username: item.requester.username, name: item.requester.firstName || item.requester.username || "Игрок" } })),
        outgoingRequests: friendships.filter((item) => item.status === "PENDING" && item.requesterId === me.id).map((item) => ({ id: item.id, user: { id: item.addressee.id, username: item.addressee.username, name: item.addressee.firstName || item.addressee.username || "Игрок" } })),
        challenges: challenges.map((item) => {
          const opponent = item.challengerId === me.id ? item.challenged : item.challenger;
          return {
            id: item.id,
            gameId: item.gameId,
            status: item.status,
            incoming: item.challengedId === me.id,
            opponent: { id: opponent.id, username: opponent.username, name: opponent.firstName || opponent.username || "Игрок" },
            createdAt: item.createdAt,
          };
        }),
        clans: memberships.map((item) => ({ id: item.clan.id, name: item.clan.name, slug: item.clan.slug, emblem: item.clan.emblem, description: item.clan.description, role: item.role, members: item.clan._count.members })),
        notifications,
        unreadNotifications: notifications.filter((item) => !item.readAt).length,
      });
    }

    if (type === "clans") {
      const clans = await prisma.clan.findMany({
        where: { isPublic: true },
        include: { _count: { select: { members: true } } },
        orderBy: [{ members: { _count: "desc" } }, { createdAt: "desc" }],
        take: 30,
      });
      return NextResponse.json({ clans });
    }

    return NextResponse.json({ error: "Неизвестный запрос" }, { status: 400 });
  } catch (error) {
    console.error("Community GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить сообщество" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const me = await getUser(String(body.initData || ""));
    if (!me || me.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    if (body.action === "friend_request") {
      const targetId = String(body.playerId || "");
      if (!targetId || targetId === me.id) return NextResponse.json({ error: "Выбери другого игрока" }, { status: 400 });
      const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isBanned: true } });
      if (!target || target.isBanned) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      const existing = await prisma.friendship.findFirst({ where: { OR: [
        { requesterId: me.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: me.id },
      ] } });
      if (existing?.status === "ACCEPTED") return NextResponse.json({ error: "Вы уже друзья" }, { status: 409 });
      if (existing?.status === "PENDING") return NextResponse.json({ error: "Заявка уже существует" }, { status: 409 });
      if (existing) {
        await prisma.friendship.update({ where: { id: existing.id }, data: { requesterId: me.id, addresseeId: targetId, status: "PENDING" } });
      } else {
        await prisma.friendship.create({ data: { requesterId: me.id, addresseeId: targetId } });
      }
      await notify(targetId, "FRIEND_REQUEST", "Новая заявка в друзья", "Тебе отправили заявку в друзья", "/community");
      return NextResponse.json({ success: true });
    }

    if (body.action === "friend_accept" || body.action === "friend_decline") {
      const requestId = String(body.requestId || "");
      const request = await prisma.friendship.findFirst({ where: { id: requestId, addresseeId: me.id, status: "PENDING" } });
      if (!request) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
      const accepted = body.action === "friend_accept";
      await prisma.friendship.update({ where: { id: request.id }, data: { status: accepted ? "ACCEPTED" : "DECLINED" } });
      if (accepted) await notify(request.requesterId, "FRIEND_ACCEPTED", "Заявка принята", "Теперь вы друзья в GameHub", "/community");
      return NextResponse.json({ success: true });
    }

    if (body.action === "challenge_create") {
      const targetId = String(body.playerId || "");
      const gameId = String(body.gameId || "mafia");
      if (!targetId || targetId === me.id) return NextResponse.json({ error: "Некорректный игрок" }, { status: 400 });
      const friendship = await prisma.friendship.findFirst({ where: { status: "ACCEPTED", OR: [
        { requesterId: me.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: me.id },
      ] } });
      if (!friendship) return NextResponse.json({ error: "Вызовы доступны только друзьям" }, { status: 403 });
      const challenge = await prisma.playerChallenge.create({ data: { challengerId: me.id, challengedId: targetId, gameId } });
      await notify(targetId, "CHALLENGE", "Тебя вызывают на игру", "Прими или отклони вызов в сообществе", "/community");
      return NextResponse.json({ success: true, challengeId: challenge.id });
    }

    if (body.action === "challenge_respond") {
      const challengeId = String(body.challengeId || "");
      const accept = body.accept === true;
      const result = await prisma.playerChallenge.updateMany({
        where: { id: challengeId, challengedId: me.id, status: "PENDING" },
        data: { status: accept ? "ACCEPTED" : "DECLINED" },
      });
      if (!result.count) return NextResponse.json({ error: "Вызов уже обработан или не найден" }, { status: 409 });
      const challenge = await prisma.playerChallenge.findUnique({ where: { id: challengeId }, select: { challengerId: true, gameId: true } });
      if (challenge) await notify(challenge.challengerId, accept ? "CHALLENGE_ACCEPTED" : "CHALLENGE_DECLINED", accept ? "Вызов принят" : "Вызов отклонён", "Ответ на твой игровой вызов", "/community");
      return NextResponse.json({ success: true });
    }

    if (body.action === "clan_create") {
      const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 28);
      const description = String(body.description || "").trim().slice(0, 180);
      const emblem = String(body.emblem || "🛡️").slice(0, 8);
      if (name.length < 3) return NextResponse.json({ error: "Название должно содержать минимум 3 символа" }, { status: 400 });
      const slugBase = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 22) || "clan";
      const clan = await prisma.clan.create({
        data: { name, slug: slugBase + "-" + nanoid(5).toLowerCase(), description: description || null, emblem, ownerId: me.id, members: { create: { userId: me.id, role: "OWNER" } } },
      });
      return NextResponse.json({ success: true, clanId: clan.id });
    }

    if (body.action === "clan_join") {
      const clanId = String(body.clanId || "");
      const clan = await prisma.clan.findUnique({ where: { id: clanId }, select: { id: true, isPublic: true } });
      if (!clan || !clan.isPublic) return NextResponse.json({ error: "Клан не найден или закрыт" }, { status: 404 });
      await prisma.clanMember.create({ data: { clanId, userId: me.id } });
      await notify(me.id, "CLAN_JOINED", "Ты вступил в клан", "Добро пожаловать в новый клан", "/community");
      return NextResponse.json({ success: true });
    }

    if (body.action === "clan_leave") {
      const clanId = String(body.clanId || "");
      const membership = await prisma.clanMember.findUnique({ where: { clanId_userId: { clanId, userId: me.id } }, include: { clan: true } });
      if (!membership) return NextResponse.json({ error: "Ты не состоишь в этом клане" }, { status: 404 });
      if (membership.role === "OWNER") {
        const nextOwner = await prisma.clanMember.findFirst({ where: { clanId, userId: { not: me.id } }, orderBy: { joinedAt: "asc" } });
        if (!nextOwner) {
          await prisma.clan.delete({ where: { id: clanId } });
          return NextResponse.json({ success: true, deleted: true });
        }
        await prisma.$transaction([
          prisma.clan.update({ where: { id: clanId }, data: { ownerId: nextOwner.userId } }),
          prisma.clanMember.update({ where: { id: nextOwner.id }, data: { role: "OWNER" } }),
          prisma.clanMember.delete({ where: { id: membership.id } }),
        ]);
      } else {
        await prisma.clanMember.delete({ where: { id: membership.id } });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "notifications_read") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string").slice(0, 30) : [];
      await prisma.appNotification.updateMany({
        where: { userId: me.id, readAt: null, ...(ids.length ? { id: { in: ids } } : {}) },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === "season_create") {
      if (!me.isAdmin) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      const name = String(body.name || "").trim().slice(0, 40);
      if (name.length < 3) return NextResponse.json({ error: "Название сезона слишком короткое" }, { status: 400 });
      const now = new Date();
      const season = await prisma.$transaction(async (tx) => {
        await tx.season.updateMany({ where: { isActive: true }, data: { isActive: false } });
        return tx.season.create({ data: { name, startsAt: now, endsAt: new Date(now.getTime() + 30 * 86400000), isActive: true } });
      });
      return NextResponse.json({ success: true, season });
    }

    if (body.action === "season_finish") {
      if (!me.isAdmin) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      const seasonId = String(body.seasonId || "");
      await prisma.season.update({ where: { id: seasonId }, data: { isActive: false, endsAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "season_award") {
      if (!me.isAdmin) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      const season = await prisma.season.findUnique({ where: { id: String(body.seasonId || "") } });
      if (!season || season.isActive) return NextResponse.json({ error: "Сначала заверши сезон" }, { status: 409 });
      const rows = await prisma.matchHistory.groupBy({
        by: ["userId"],
        where: { playedAt: { gte: season.startsAt, lte: season.endsAt } },
        _sum: { xpEarned: true },
        orderBy: { _sum: { xpEarned: "desc" } },
        take: 10,
      });
      let awarded = 0;
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const existing = await tx.seasonReward.findUnique({ where: { seasonId_userId: { seasonId: season.id, userId: row.userId } } });
          if (existing) continue;
          const place = index + 1;
          const rewardXp = place === 1 ? 500 : place <= 3 ? 250 : 100;
          const rewardCoins = place === 1 ? 1500 : place <= 3 ? 750 : 300;
          const target = await tx.user.findUnique({ where: { id: row.userId }, select: { xp: true } });
          if (!target) continue;
          const balanceAfter = target.xp + rewardXp;
          await tx.seasonReward.create({ data: { seasonId: season.id, userId: row.userId, place, rewardXp, rewardCoins } });
          await tx.user.update({ where: { id: row.userId }, data: { xp: { increment: rewardXp }, coins: { increment: rewardCoins }, level: levelForXp(balanceAfter) } });
          await tx.xpTransaction.create({ data: { userId: row.userId, amount: rewardXp, balanceAfter, source: "SEASON_REWARD", reason: "Награда за сезонное место #" + place } });
          await tx.appNotification.create({ data: { userId: row.userId, type: "SEASON_REWARD", title: "Итоги сезона", body: "Место #" + place + ": +" + rewardXp + " XP и +" + rewardCoins + " монет", href: "/leaderboard" } });
          awarded += 1;
        }
      });
      return NextResponse.json({ success: true, awarded });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Такая запись уже существует" }, { status: 409 });
    }
    console.error("Community POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
