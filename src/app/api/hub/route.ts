import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

async function auth(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const result = validateTelegramWebAppData(initData, token);
  if (!result.valid || !result.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(result.user.id) } });
  return user && !user.isBanned ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const me = await auth(req.headers.get("x-init-data") || req.nextUrl.searchParams.get("initData") || "");
    if (!me) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const type = req.nextUrl.searchParams.get("type") || "settings";

    if (type === "settings") {
      const settings = await prisma.userSettings.upsert({
        where: { userId: me.id }, create: { userId: me.id }, update: {},
      });
      return NextResponse.json({ settings });
    }

    if (type === "leaderboard") {
      const gameId = req.nextUrl.searchParams.get("game") || "all";
      const season = req.nextUrl.searchParams.get("season") === "1";
      let activeSeason = season ? await prisma.season.findFirst({ where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } } }) : null;
      if (season && !activeSeason) {
        const now = new Date();
        const existing = await prisma.season.findFirst({ where: { name: "Сезон 1" } });
        activeSeason = existing || await prisma.season.create({ data: { name: "Сезон 1", startsAt: now, endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), isActive: true } });
      }
      if (gameId === "all" && !season) {
        const users = await prisma.user.findMany({
          orderBy: [{ xp: "desc" }, { gamesWon: "desc" }], take: 100,
          select: { id: true, username: true, firstName: true, photoUrl: true, xp: true, level: true, gamesPlayed: true, gamesWon: true, isAdmin: true, isVerified: true },
        });
        return NextResponse.json({ users, season: null });
      }
      const grouped = await prisma.matchHistory.groupBy({
        by: ["userId"],
        where: {
          ...(gameId !== "all" ? { gameId } : {}),
          ...(activeSeason ? { playedAt: { gte: activeSeason.startsAt, lte: activeSeason.endsAt } } : {}),
        },
        _count: { id: true },
        _sum: { xpEarned: true },
      });
      const ids = grouped.sort((a,b) => (b._sum.xpEarned || 0) - (a._sum.xpEarned || 0)).slice(0,100);
      const profiles = await prisma.user.findMany({ where: { id: { in: ids.map(x => x.userId) } }, select: { id:true, username:true, firstName:true, photoUrl:true, level:true, gamesPlayed:true, gamesWon:true, isAdmin:true, isVerified:true } });
      const users = ids.map(x => ({ ...profiles.find(p => p.id === x.userId), xp: x._sum.xpEarned || 0, gamesInPeriod: x._count.id }));
      return NextResponse.json({ users, season: activeSeason });
    }

    if (type === "chat") {
      const roomId = req.nextUrl.searchParams.get("roomId") || "";
      const member = await prisma.mafiaPlayer.findFirst({ where: { roomId, userId: me.id } });
      if (!member) return NextResponse.json({ error: "Ты не участник комнаты" }, { status: 403 });
      const [messages, reactions] = await Promise.all([
        prisma.roomMessage.findMany({ where: { roomId }, include: { user: { select: { id:true, firstName:true, username:true, photoUrl:true } } }, orderBy: { createdAt: "desc" }, take: 60 }),
        prisma.roomReaction.findMany({ where: { roomId, createdAt: { gte: new Date(Date.now()-3600000) } }, include: { user: { select: { firstName:true, username:true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
      ]);
      return NextResponse.json({ messages: messages.reverse(), reactions });
    }

    if (type === "rooms") {
      const rooms = await prisma.mafiaRoom.findMany({
        where: { status: "WAITING", isPrivate: false, inviteOnly: false },
        include: { players: { select: { id:true } } }, orderBy: { createdAt: "desc" }, take: 40,
      });
      return NextResponse.json({ rooms: rooms.map(r => ({ id:r.id, code:r.code, name:r.name, players:r.players.length, minPlayers:r.minPlayers, maxPlayers:r.maxPlayers, createdAt:r.createdAt })) });
    }

    return NextResponse.json({ error: "Неизвестный запрос" }, { status: 400 });
  } catch (e) {
    console.error("Hub GET", e);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const me = await auth(String(body.initData || ""));
    if (!me) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    if (body.action === "save_settings") {
      const allowedThemes = ["dark", "midnight", "red", "light"];
      const allowedLanguages = ["ru", "en"];
      const settings = await prisma.userSettings.upsert({
        where: { userId: me.id },
        create: {
          userId: me.id,
          displayName: typeof body.displayName === "string" ? body.displayName.trim().slice(0,32) || null : null,
          avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl.trim().slice(0,500) || null : null,
          theme: allowedThemes.includes(body.theme) ? body.theme : "dark",
          soundEnabled: body.soundEnabled !== false,
          notifications: body.notifications !== false,
          language: allowedLanguages.includes(body.language) ? body.language : "ru",
        },
        update: {
          ...(typeof body.displayName === "string" ? { displayName: body.displayName.trim().slice(0,32) || null } : {}),
          ...(typeof body.avatarUrl === "string" ? { avatarUrl: body.avatarUrl.trim().slice(0,500) || null } : {}),
          ...(allowedThemes.includes(body.theme) ? { theme: body.theme } : {}),
          ...(typeof body.soundEnabled === "boolean" ? { soundEnabled: body.soundEnabled } : {}),
          ...(typeof body.notifications === "boolean" ? { notifications: body.notifications } : {}),
          ...(allowedLanguages.includes(body.language) ? { language: body.language } : {}),
        },
      });
      return NextResponse.json({ success: true, settings });
    }

    if (body.action === "chat_send") {
      const roomId = String(body.roomId || "");
      const content = String(body.content || "").trim().slice(0,500);
      if (!content) return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
      const member = await prisma.mafiaPlayer.findFirst({ where: { roomId, userId: me.id } });
      if (!member) return NextResponse.json({ error: "Ты не участник комнаты" }, { status: 403 });
      const message = await prisma.roomMessage.create({ data: { roomId, userId: me.id, content }, include: { user: { select: { id:true, firstName:true, username:true, photoUrl:true } } } });
      return NextResponse.json({ success: true, message });
    }

    if (body.action === "react") {
      const roomId = String(body.roomId || "");
      const emoji = String(body.emoji || "");
      if (!["👍","😂","❤️","🔥","😮","👎"].includes(emoji)) return NextResponse.json({ error: "Недопустимая реакция" }, { status: 400 });
      const member = await prisma.mafiaPlayer.findFirst({ where: { roomId, userId: me.id } });
      if (!member) return NextResponse.json({ error: "Ты не участник комнаты" }, { status: 403 });
      const reaction = await prisma.roomReaction.create({ data: { roomId, userId: me.id, emoji } });
      return NextResponse.json({ success: true, reaction });
    }

    if (body.action === "report") {
      const targetId = String(body.targetId || "");
      const roomId = String(body.roomId || "");
      const reason = String(body.reason || "").trim().slice(0,80);
      const details = String(body.details || "").trim().slice(0,1000);
      if (!targetId || !reason || targetId === me.id) return NextResponse.json({ error: "Проверь данные жалобы" }, { status: 400 });
      if (roomId) {
        const [authorMember, targetMember] = await Promise.all([
          prisma.mafiaPlayer.findFirst({ where: { roomId, userId: me.id } }),
          prisma.mafiaPlayer.findFirst({ where: { roomId, userId: targetId } }),
        ]);
        if (!authorMember || !targetMember) return NextResponse.json({ error: "Игроки должны состоять в этой комнате" }, { status: 403 });
      }
      const report = await prisma.playerReport.create({ data: { authorId: me.id, targetId, roomId: roomId || null, reason, details: details || null } });
      return NextResponse.json({ success: true, reportId: report.id });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error("Hub POST", e);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
