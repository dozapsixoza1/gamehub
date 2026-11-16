import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { generateRoomCode } from "@/lib/utils";
import { getDefaultRolesConfig, assignRoles } from "@/lib/mafia/roles";

async function getUserFromInitData(initData: string) {
  const botToken = process.env.BOT_TOKEN!;
  const { valid, user: tgUser } = validateTelegramWebAppData(initData, botToken);
  if (!valid || !tgUser) return null;

  return prisma.user.findUnique({
    where: { telegramId: BigInt(tgUser.id) },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData, action } = body;

    if (!initData || !action) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const user = await getUserFromInitData(initData);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ======================
    // CREATE ROOM
    // ======================
    if (action === "create") {
      let code = generateRoomCode();
      // Убеждаемся, что код уникален
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.mafiaRoom.findUnique({ where: { code } });
        if (!exists) break;
        code = generateRoomCode();
      }

      const room = await prisma.mafiaRoom.create({
        data: {
          code,
          hostId: user.id,
          maxPlayers: 12,
          minPlayers: 4,
          isPrivate: false,
          rolesConfig: getDefaultRolesConfig(8),
          players: {
            create: {
              userId: user.id,
              isHost: true,
              seatNumber: 1,
            },
          },
        },
        include: {
          players: {
            include: { user: { select: { id: true, firstName: true, username: true, photoUrl: true } } },
          },
        },
      });

      return NextResponse.json({ roomId: room.id, code: room.code, room });
    }

    // ======================
    // JOIN ROOM
    // ======================
    if (action === "join") {
      const { code } = body;
      if (!code) {
        return NextResponse.json({ error: "Код комнаты обязателен" }, { status: 400 });
      }

      const room = await prisma.mafiaRoom.findUnique({
        where: { code: code.toUpperCase() },
        include: { players: true },
      });

      if (!room) {
        return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
      }

      if (room.status !== "WAITING") {
        return NextResponse.json({ error: "Игра уже началась" }, { status: 400 });
      }

      if (room.players.length >= room.maxPlayers) {
        return NextResponse.json({ error: "Комната заполнена" }, { status: 400 });
      }

      const alreadyIn = room.players.find((p) => p.userId === user.id);
      if (alreadyIn) {
        return NextResponse.json({ roomId: room.id, code: room.code });
      }

      await prisma.mafiaPlayer.create({
        data: {
          roomId: room.id,
          userId: user.id,
          isHost: false,
          seatNumber: room.players.length + 1,
        },
      });

      return NextResponse.json({ roomId: room.id, code: room.code });
    }

    // ======================
    // START GAME
    // ======================
    if (action === "start") {
      const { roomId } = body;
      if (!roomId) {
        return NextResponse.json({ error: "roomId required" }, { status: 400 });
      }

      const room = await prisma.mafiaRoom.findUnique({
        where: { id: roomId },
        include: { players: true },
      });

      if (!room) {
        return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
      }

      if (room.hostId !== user.id) {
        return NextResponse.json({ error: "Только хост может начать игру" }, { status: 403 });
      }

      if (room.status !== "WAITING") {
        return NextResponse.json({ error: "Игра уже началась" }, { status: 400 });
      }

      if (room.players.length < room.minPlayers) {
        return NextResponse.json(
          { error: `Нужно минимум ${room.minPlayers} игроков` },
          { status: 400 }
        );
      }

      const config = getDefaultRolesConfig(room.players.length);
      const roleMap = assignRoles(
        room.players.map((p) => p.id),
        config
      );

      // Обновляем роли игроков
      await Promise.all(
        Array.from(roleMap.entries()).map(([playerId, role]) =>
          prisma.mafiaPlayer.update({
            where: { id: playerId },
            data: { role },
          })
        )
      );

      const updated = await prisma.mafiaRoom.update({
        where: { id: roomId },
        data: {
          status: "NIGHT",
          currentPhase: "NIGHT_MAFIA",
          dayNumber: 1,
          rolesConfig: config,
          startedAt: new Date(),
          phaseEndsAt: new Date(Date.now() + 60_000), // 60 сек на ночь
        },
        include: {
          players: {
            include: {
              user: {
                select: { id: true, firstName: true, username: true, photoUrl: true },
              },
            },
          },
        },
      });

      return NextResponse.json({ success: true, room: updated });
    }

    // ======================
    // LEAVE ROOM
    // ======================
    if (action === "leave") {
      const { roomId } = body;
      if (!roomId) {
        return NextResponse.json({ error: "roomId required" }, { status: 400 });
      }

      const player = await prisma.mafiaPlayer.findFirst({
        where: { roomId, userId: user.id },
      });

      if (!player) {
        return NextResponse.json({ error: "Ты не в этой комнате" }, { status: 400 });
      }

      const room = await prisma.mafiaRoom.findUnique({ where: { id: roomId } });

      if (room?.status !== "WAITING") {
        return NextResponse.json({ error: "Нельзя выйти во время игры" }, { status: 400 });
      }

      await prisma.mafiaPlayer.delete({ where: { id: player.id } });

      // Если хост вышел — передаём хоста или удаляем комнату
      if (player.isHost) {
        const remaining = await prisma.mafiaPlayer.findMany({
          where: { roomId },
          orderBy: { joinedAt: "asc" },
        });

        if (remaining.length === 0) {
          await prisma.mafiaRoom.delete({ where: { id: roomId } });
        } else {
          await prisma.mafiaPlayer.update({
            where: { id: remaining[0].id },
            data: { isHost: true },
          });
          await prisma.mafiaRoom.update({
            where: { id: roomId },
            data: { hostId: remaining[0].userId },
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Mafia room error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Получить состояние комнаты
export async function GET(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get("roomId");
    const initData = req.nextUrl.searchParams.get("initData");

    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }

    const room = await prisma.mafiaRoom.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { seatNumber: "asc" },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    // Если есть initData — скрываем чужие роли
    let myPlayerId: string | null = null;
    let myRole: string | null = null;

    if (initData) {
      const user = await getUserFromInitData(initData);
      if (user) {
        const me = room.players.find((p) => p.userId === user.id);
        if (me) {
          myPlayerId = me.id;
          myRole = me.role;
        }
      }
    }

    // Санитизация: другим не показываем роли (кроме своей и мёртвых после раскрытия)
    const sanitizedPlayers = room.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      isAlive: p.isAlive,
      isHost: p.isHost,
      seatNumber: p.seatNumber,
      user: p.user,
      // Роль видна только себе или если игрок мёртв (для простоты)
      role: p.id === myPlayerId || !p.isAlive ? p.role : null,
    }));

    return NextResponse.json({
      room: {
        ...room,
        players: sanitizedPlayers,
        myPlayerId,
        myRole,
      },
    });
  } catch (error) {
    console.error("Mafia GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
