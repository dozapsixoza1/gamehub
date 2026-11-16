import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { MafiaRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { generateRoomCode } from "@/lib/utils";
import {
  assignRoles,
  checkWinCondition,
  getDefaultRolesConfig
} from "@/lib/mafia/roles";

const jsonError = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;

  if (!token) return null;

  const result = validateTelegramWebAppData(initData, token);

  if (!result.valid || !result.user) return null;

  return prisma.user.findUnique({
    where: {
      telegramId: BigInt(result.user.id)
    }
  });
}

async function finishIfWinner(roomId: string) {
  const room = await prisma.mafiaRoom.findUnique({ where: { id: roomId } });
  if (!room) return null;
  if (room.status === "FINISHED") return room.winner;
  const players = await prisma.mafiaPlayer.findMany({ where: { roomId } });
  const winner = checkWinCondition(players);
  if (!winner) return null;
  const locked = await prisma.mafiaRoom.updateMany({
    where: { id: roomId, status: { not: "FINISHED" } },
    data: { status: "FINISHED", winner, finishedAt: new Date(), phaseEndsAt: null },
  });
  if (locked.count === 0) return winner;
  const defs = [
    { id: "first_game", title: "Первый матч", description: "Сыграть первую партию", icon: "🎮", xpReward: 25, coinsReward: 25, test: (g: number) => g >= 1 },
    { id: "games_10", title: "Постоянный игрок", description: "Сыграть 10 матчей", icon: "🔥", xpReward: 75, coinsReward: 75, test: (g: number) => g >= 10 },
    { id: "wins_5", title: "Победитель", description: "Одержать 5 побед", icon: "🏆", xpReward: 100, coinsReward: 100, test: (_g: number, w: number) => w >= 5 },
    { id: "games_50", title: "Ветеран", description: "Сыграть 50 матчей", icon: "⭐", xpReward: 250, coinsReward: 250, test: (g: number) => g >= 50 },
    { id: "wins_25", title: "Легенда", description: "Одержать 25 побед", icon: "👑", xpReward: 500, coinsReward: 500, test: (_g: number, w: number) => w >= 25 },
  ];
  for (const player of players) {
    const won = (winner === "mafia" && (player.role === "MAFIA" || player.role === "DON")) || (winner === "civilians" && player.role !== "MAFIA" && player.role !== "DON" && player.role !== "MANIAC") || (winner === "maniac" && player.role === "MANIAC");
    const xp = won ? 100 : 50;
    const coins = won ? 100 : 30;
    const current = await prisma.user.findUnique({ where: { id: player.userId } });
    if (!current) continue;
    const gamesPlayed = current.gamesPlayed + 1;
    const gamesWon = current.gamesWon + (won ? 1 : 0);
    let totalXp = current.xp + xp;
    await prisma.user.update({ where: { id: current.id }, data: { gamesPlayed: { increment: 1 }, ...(won ? { gamesWon: { increment: 1 } } : {}), xp: { increment: xp }, coins: { increment: coins }, level: Math.floor(Math.sqrt(totalXp / 100)) + 1 } });
    await prisma.matchHistory.create({ data: { userId: current.id, gameId: "mafia", roomId, result: won ? "WIN" : "PLAYED", winner, summary: won ? "Команда победила в партии Мафии" : "Партия завершена", playersCount: players.length, xpEarned: xp, coinsEarned: coins } });
    for (const a of defs) {
      if (!a.test(gamesPlayed, gamesWon)) continue;
      await prisma.achievement.upsert({ where: { id: a.id }, create: { id: a.id, title: a.title, description: a.description, icon: a.icon, xpReward: a.xpReward, coinsReward: a.coinsReward }, update: {} });
      const created = await prisma.userAchievement.createMany({ data: [{ userId: current.id, achievementId: a.id }], skipDuplicates: true });
      if (created.count > 0) {
        totalXp += a.xpReward;
        await prisma.user.update({ where: { id: current.id }, data: { xp: { increment: a.xpReward }, coins: { increment: a.coinsReward }, level: Math.floor(Math.sqrt(totalXp / 100)) + 1 } });
      }
    }
  }
  return winner;
}
async function resolveNight(roomId: string, dayNumber: number) {
  const [players, actions] = await Promise.all([
    prisma.mafiaPlayer.findMany({
      where: { roomId, isAlive: true }
    }),
    prisma.mafiaAction.findMany({
      where: { roomId, dayNumber }
    })
  ]);

  const blockedTargets = new Set(
    actions
      .filter(a => a.action === "seduce" && a.targetId)
      .map(a => a.targetId!)
  );

  const valid = actions.filter(
    a => !blockedTargets.has(a.actorId)
  );

  const countTargets = (kind: string) => {
    const counts = new Map<string, number>();

    valid
      .filter(a => a.action === kind && a.targetId)
      .forEach(a => {
        counts.set(
          a.targetId!,
          (counts.get(a.targetId!) ?? 0) + 1
        );
      });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const mafiaTarget = countTargets("kill");
  const maniacTarget = countTargets("maniac_kill");
  const doctorTarget = countTargets("heal");

  const sheriffAction = valid.find(
    a => a.action === "check"
  );

  const killIds = new Set(
    [mafiaTarget, maniacTarget].filter(
      (x): x is string => Boolean(x)
    )
  );

  if (doctorTarget) {
    killIds.delete(doctorTarget);
  }

  const deaths = [...killIds].filter(id =>
    players.some(p => p.id === id)
  );

  if (deaths.length) {
    await prisma.mafiaPlayer.updateMany({
      where: {
        id: { in: deaths },
        roomId
      },
      data: { isAlive: false }
    });
  }

  const sheriffResult = sheriffAction?.targetId
    ? players.find(p => p.id === sheriffAction.targetId)
    : null;

  await prisma.mafiaRoom.update({
    where: { id: roomId },
    data: {
      status: "DAY",
      currentPhase: "DAY_DISCUSSION",
      phaseEndsAt: new Date(Date.now() + 60_000)
    }
  });

  const winner = await finishIfWinner(roomId);

  return {
    deaths,
    sheriffActorId: sheriffAction?.actorId ?? null,
    sheriffTargetId: sheriffAction?.targetId ?? null,
    sheriffIsMafia: sheriffResult
      ? sheriffResult.role === "MAFIA" ||
        sheriffResult.role === "DON"
      : null,
    winner
  };
}

async function resolveVoting(roomId: string, dayNumber: number) {
  const votes = await prisma.mafiaVote.findMany({
    where: {
      roomId,
      dayNumber,
      targetId: { not: null }
    }
  });

  const tally = new Map<string, number>();

  votes.forEach(v => {
    tally.set(
      v.targetId!,
      (tally.get(v.targetId!) ?? 0) + 1
    );
  });

  const sorted = [...tally.entries()]
    .sort((a, b) => b[1] - a[1]);

  const eliminated =
    sorted.length &&
    (sorted.length === 1 ||
      sorted[0][1] > sorted[1][1])
      ? sorted[0][0]
      : null;

  if (eliminated) {
    await prisma.mafiaPlayer.updateMany({
      where: {
        id: eliminated,
        roomId,
        isAlive: true
      },
      data: { isAlive: false }
    });
  }

  const winner = await finishIfWinner(roomId);

  if (!winner) {
    await prisma.mafiaRoom.update({
      where: { id: roomId },
      data: {
        status: "NIGHT",
        currentPhase: "NIGHT_MAFIA",
        dayNumber: { increment: 1 },
        phaseEndsAt: new Date(Date.now() + 90_000)
      }
    });
  }

  return {
    eliminated,
    winner,
    tied:
      sorted.length > 1 &&
      sorted[0][1] === sorted[1][1]
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { initData, action, roomId } = body;

    if (!initData || !action) {
      return jsonError("Не хватает данных");
    }

    const user = await getUser(initData);

    if (!user || user.isBanned) {
      return jsonError(
        "Не удалось подтвердить Telegram-пользователя",
        401
      );
    }

    if (action === "create") {
      let code = generateRoomCode();

      for (
        let i = 0;
        i < 10 &&
        await prisma.mafiaRoom.findUnique({
          where: { code }
        });
        i++
      ) {
        code = generateRoomCode();
      }

      const room = await prisma.mafiaRoom.create({
        data: {
          code,
          hostId: user.id,
          name: typeof body.name === "string" ? body.name.trim().slice(0, 40) || "Комната Мафии" : "Комната Мафии",
          isPrivate: body.isPrivate === true,
          inviteOnly: body.inviteOnly === true,
          passwordHash: typeof body.password === "string" && body.password.length >= 4 ? createHash("sha256").update(body.password).digest("hex") : null,
          maxPlayers: 12,
          minPlayers: 4,
          rolesConfig: getDefaultRolesConfig(8),
          players: {
            create: {
              userId: user.id,
              isHost: true,
              seatNumber: 1
            }
          }
        }
      });

      return NextResponse.json({
        roomId: room.id,
        code: room.code
      });
    }

    if (action === "join") {
      const code = String(body.code ?? "")
        .trim()
        .toUpperCase();

      if (!code) {
        return jsonError("Введи код комнаты");
      }

      const room = await prisma.mafiaRoom.findUnique({
        where: { code },
        include: { players: true }
      });

      if (!room) {
        return jsonError("Комната не найдена", 404);
      }

      if (room.status !== "WAITING") {
        return jsonError("Игра уже началась");
      }

      if (room.passwordHash) {
        const supplied = typeof body.password === "string" ? createHash("sha256").update(body.password).digest("hex") : "";
        if (supplied !== room.passwordHash) return jsonError("Неверный пароль", 403);
      }
      if (room.inviteOnly && !body.inviteAccepted) return jsonError("Вход только по приглашению", 403);

      if (room.players.length >= room.maxPlayers) {
        return jsonError("Комната заполнена");
      }

      if (!room.players.some(p => p.userId === user.id)) {
        await prisma.mafiaPlayer.create({
          data: {
            roomId: room.id,
            userId: user.id,
            seatNumber: room.players.length + 1
          }
        });
      }

      return NextResponse.json({
        roomId: room.id,
        code: room.code
      });
    }

    if (!roomId) {
      return jsonError("Не указан roomId");
    }

    const room = await prisma.mafiaRoom.findUnique({
      where: { id: roomId },
      include: { players: true }
    });

    if (!room) {
      return jsonError("Комната не найдена", 404);
    }

    const me = room.players.find(
      p => p.userId === user.id
    );

    if (!me) {
      return jsonError(
        "Ты не участник этой комнаты",
        403
      );
    }

    const host = room.hostId === user.id;

    if (action === "start") {
      if (!host) {
        return jsonError(
          "Начать игру может только ведущий",
          403
        );
      }

      if (room.status !== "WAITING") {
        return jsonError("Игра уже началась");
      }

      if (room.players.length < room.minPlayers) {
        return jsonError(
          `Нужно минимум ${room.minPlayers} игрока`
        );
      }

      const config = getDefaultRolesConfig(
        room.players.length
      );

      const roles = assignRoles(
        room.players.map(p => p.id),
        config
      );

      await prisma.$transaction(
        [...roles.entries()].map(([id, role]) =>
          prisma.mafiaPlayer.update({
            where: { id },
            data: {
              role,
              isAlive: true,
              nightTarget: null
            }
          })
        )
      );

      await prisma.mafiaRoom.update({
        where: { id: roomId },
        data: {
          status: "NIGHT",
          currentPhase: "NIGHT_MAFIA",
          dayNumber: 1,
          rolesConfig: config,
          startedAt: new Date(),
          phaseEndsAt: new Date(Date.now() + 90_000),
          winner: null
        }
      });

      return NextResponse.json({ success: true });
    }

    if (action === "leave") {
      if (room.status !== "WAITING") {
        return jsonError(
          "Во время игры выйти нельзя"
        );
      }

      await prisma.mafiaPlayer.delete({
        where: { id: me.id }
      });

      const rest = room.players
        .filter(p => p.id !== me.id)
        .sort(
          (a, b) =>
            a.joinedAt.getTime() -
            b.joinedAt.getTime()
        );

      if (!rest.length) {
        await prisma.mafiaRoom.delete({
          where: { id: roomId }
        });
      } else if (host) {
        await prisma.mafiaPlayer.update({
          where: { id: rest[0].id },
          data: { isHost: true }
        });

        await prisma.mafiaRoom.update({
          where: { id: roomId },
          data: { hostId: rest[0].userId }
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "night_action") {
      if (
        room.status !== "NIGHT" ||
        !me.isAlive ||
        !me.role
      ) {
        return jsonError(
          "Сейчас нельзя выполнить ночное действие"
        );
      }

      const targetId = String(body.targetId ?? "");

      const target = room.players.find(
        p => p.id === targetId && p.isAlive
      );

      if (!target) {
        return jsonError("Выбери живого игрока");
      }

      if (
        target.id === me.id &&
        me.role !== "DOCTOR"
      ) {
        return jsonError("Нельзя выбрать себя");
      }

      const roleAction: Partial<
        Record<MafiaRole, string>
      > = {
        MAFIA: "kill",
        DON: "kill",
        DOCTOR: "heal",
        SHERIFF: "check",
        MANIAC: "maniac_kill",
        COURTESAN: "seduce"
      };

      const kind = roleAction[me.role];

      if (!kind) {
        return jsonError(
          "У твоей роли нет ночного действия"
        );
      }

      if (
        (me.role === "MAFIA" || me.role === "DON") &&
        (target.role === "MAFIA" ||
          target.role === "DON")
      ) {
        return jsonError(
          "Нельзя выбирать союзника"
        );
      }

      const previous = await prisma.mafiaAction.findFirst({
        where: {
          roomId,
          actorId: me.id,
          dayNumber: room.dayNumber
        }
      });

      if (previous) {
        await prisma.mafiaAction.update({
          where: { id: previous.id },
          data: {
            targetId,
            action: kind,
            phase: "NIGHT_MAFIA"
          }
        });
      } else {
        await prisma.mafiaAction.create({
          data: {
            roomId,
            actorId: me.id,
            targetId,
            action: kind,
            dayNumber: room.dayNumber,
            phase: "NIGHT_MAFIA"
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: "Действие принято"
      });
    }

    if (action === "resolve_night") {
      if (!host) {
        return jsonError(
          "Завершить ночь может ведущий",
          403
        );
      }

      if (room.status !== "NIGHT") {
        return jsonError("Сейчас не ночь");
      }

      const result = await resolveNight(
        roomId,
        room.dayNumber
      );

      return NextResponse.json({
        success: true,
        ...result
      });
    }

    if (action === "start_voting") {
      if (!host) {
        return jsonError(
          "Начать голосование может ведущий",
          403
        );
      }

      if (room.status !== "DAY") {
        return jsonError(
          "Сейчас нельзя начать голосование"
        );
      }

      await prisma.mafiaRoom.update({
        where: { id: roomId },
        data: {
          status: "VOTING",
          currentPhase: "DAY_VOTING",
          phaseEndsAt: new Date(Date.now() + 60_000)
        }
      });

      return NextResponse.json({ success: true });
    }

    if (action === "vote") {
      if (
        room.status !== "VOTING" ||
        !me.isAlive
      ) {
        return jsonError(
          "Сейчас голосовать нельзя"
        );
      }

      const targetId = body.targetId
        ? String(body.targetId)
        : null;

      if (
        targetId &&
        !room.players.some(
          p => p.id === targetId && p.isAlive
        )
      ) {
        return jsonError("Цель недоступна");
      }

      if (targetId === me.id) {
        return jsonError(
          "Нельзя голосовать за себя"
        );
      }

      await prisma.mafiaVote.upsert({
        where: {
          roomId_voterId_dayNumber: {
            roomId,
            voterId: me.id,
            dayNumber: room.dayNumber
          }
        },
        create: {
          roomId,
          voterId: me.id,
          targetId,
          dayNumber: room.dayNumber
        },
        update: { targetId }
      });

      return NextResponse.json({ success: true });
    }

    if (action === "resolve_voting") {
      if (!host) {
        return jsonError(
          "Завершить голосование может ведущий",
          403
        );
      }

      if (room.status !== "VOTING") {
        return jsonError(
          "Сейчас нет голосования"
        );
      }

      const result = await resolveVoting(
        roomId,
        room.dayNumber
      );

      return NextResponse.json({
        success: true,
        ...result
      });
    }

    return jsonError("Неизвестное действие");
  } catch (error) {
    console.error("Mafia API:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError(
        "Это действие уже выполнено"
      );
    }

    return jsonError(
      "Внутренняя ошибка сервера",
      500
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const roomId =
      req.nextUrl.searchParams.get("roomId");

    const initData =
      req.nextUrl.searchParams.get("initData") ?? "";

    if (!roomId || !initData) {
      return jsonError(
        "Не хватает данных",
        400
      );
    }

    const user = await getUser(initData);

    if (!user || user.isBanned) {
      return jsonError("Нет доступа", 401);
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
                photoUrl: true
              }
            }
          },
          orderBy: { seatNumber: "asc" }
        }
      }
    });

    if (!room) {
      return jsonError(
        "Комната не найдена",
        404
      );
    }

    const me = room.players.find(
      p => p.userId === user.id
    );

    if (!me) {
      return jsonError(
        "Ты не участник этой комнаты",
        403
      );
    }

    const [
      myAction,
      myVote,
      voteCount,
      myCheck
    ] = await Promise.all([
      prisma.mafiaAction.findFirst({
        where: {
          roomId,
          actorId: me.id,
          dayNumber: room.dayNumber
        }
      }),
      prisma.mafiaVote.findFirst({
        where: {
          roomId,
          voterId: me.id,
          dayNumber: room.dayNumber
        }
      }),
      prisma.mafiaVote.count({
        where: {
          roomId,
          dayNumber: room.dayNumber
        }
      }),
      prisma.mafiaAction.findFirst({
        where: {
          roomId,
          actorId: me.id,
          dayNumber: room.dayNumber,
          action: "check"
        }
      })
    ]);

    const isMafia =
      me.role === "MAFIA" ||
      me.role === "DON";

    const players = room.players.map(p => ({
      id: p.id,
      userId: p.userId,
      isAlive: p.isAlive,
      isHost: p.isHost,
      seatNumber: p.seatNumber,
      user: p.user,
      role:
        p.id === me.id ||
        !p.isAlive ||
        room.status === "FINISHED" ||
        (isMafia &&
          (p.role === "MAFIA" || p.role === "DON"))
          ? p.role
          : null
    }));

    let sheriffResult: boolean | null = null;

    if (myCheck?.targetId) {
      const target = room.players.find(
        p => p.id === myCheck.targetId
      );

      sheriffResult = target
        ? target.role === "MAFIA" ||
          target.role === "DON"
        : null;
    }

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        currentPhase: room.currentPhase,
        dayNumber: room.dayNumber,
        hostId: room.hostId,
        minPlayers: room.minPlayers,
        maxPlayers: room.maxPlayers,
        winner: room.winner,
        phaseEndsAt: room.phaseEndsAt,
        players,
        myPlayerId: me.id,
        myRole: me.role,
        myAction: myAction?.action ?? null,
        myTargetId: myAction?.targetId ?? null,
        myVote: myVote?.targetId ?? null,
        voteCount,
        sheriffResult
      }
    });
  } catch (error) {
    console.error("Mafia GET:", error);

    return jsonError(
      "Не удалось загрузить комнату",
      500
    );
  }
          }
