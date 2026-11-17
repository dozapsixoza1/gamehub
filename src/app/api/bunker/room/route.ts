import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { generateRoomCode } from "@/lib/utils";

const CATEGORIES = ["profession", "health", "hobby", "baggage", "fact"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  profession: "Профессия",
  health: "Здоровье",
  hobby: "Хобби",
  baggage: "Багаж",
  fact: "Особый факт",
};

const APOCALYPSES = [
  "Глобальное отключение электричества на долгие годы",
  "Падение крупного метеорита изменило климат",
  "Неурожай и нехватка пресной воды",
  "Сильная солнечная буря вывела из строя технику",
  "Мировая инфраструктура перестала работать",
];

const CARD_POOL = {
  profession: ["Врач", "Инженер", "Учитель", "Фермер", "Повар", "Программист", "Спасатель", "Биолог", "Электрик", "Строитель", "Психолог", "Механик", "Ветеринар", "Геолог", "Архитектор", "Переводчик"],
  health: ["Отличное здоровье", "Аллергия на пыльцу", "Нужны очки для чтения", "Хорошая физическая форма", "Непереносимость лактозы", "Знание первой помощи", "Чувствительность к холоду", "Крепкий иммунитет"],
  hobby: ["Садоводство", "Ремонт техники", "Кулинария", "Радиолюбительство", "Настольные игры", "Рисование", "Походы", "Шахматы", "Шитьё", "Изучение языков"],
  baggage: ["Аптечка", "Набор инструментов", "Семена овощей", "Фильтр для воды", "Книги по первой помощи", "Портативная солнечная панель", "Набор посуды", "Рация", "Тёплые вещи", "Набор для ремонта"],
  fact: ["Умеет ориентироваться по звёздам", "Помнит много рецептов", "Может починить велосипед", "Знает несколько языков", "Быстро учится новому", "Умеет экономить ресурсы", "Хорошо ладит с детьми", "Отлично запоминает маршруты"],
};

type GameState = {
  apocalypse: string;
  capacity: number;
  round: number;
  phase: "DISCUSSION" | "VOTING" | "FINISHED";
  currentCategory: string;
  votes: Record<string, string>;
  eliminatedUserId?: string;
};

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token || !initData) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) } });
  return user && !user.isBanned ? user : null;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function safeRoom(room: any, userId: string) {
  const state = (room.gameState || {}) as GameState;
  const { votes, ...publicState } = state;
  const players = room.players.map((player: any) => {
    const card = (player.character || {}) as Record<string, string>;
    const visibleFields = player.userId === userId ? Object.keys(card) : player.revealedFields;
    const visibleCard: Record<string, string> = {};
    for (const field of visibleFields) {
      if (card[field]) visibleCard[field] = card[field];
    }
    return {
      userId: player.userId,
      name: player.user.settings?.displayName || player.user.firstName || player.user.username || "Игрок",
      username: player.user.username,
      photoUrl: player.user.photoUrl,
      isHost: player.isHost,
      isActive: player.isActive,
      revealedFields: player.revealedFields,
      character: visibleCard,
      isMe: player.userId === userId,
    };
  });
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    status: room.status,
    maxPlayers: room.maxPlayers,
    minPlayers: room.minPlayers,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
    gameState: publicState,
    myVote: votes?.[userId] || null,
    players,
    categoryLabel: CATEGORY_LABELS[state.currentCategory] || "",
  };
}

async function finishRoom(roomId: string, state: GameState) {
  const locked = await prisma.bunkerRoom.updateMany({
    where: { id: roomId, status: "PLAYING" },
    data: { status: "FINISHED", finishedAt: new Date(), gameState: { ...state, phase: "FINISHED" } as Prisma.InputJsonValue },
  });
  if (!locked.count) return;

  const players = await prisma.bunkerPlayer.findMany({ where: { roomId } });
  for (const player of players) {
    const won = player.isActive;
    const xp = won ? 100 : 40;
    const coins = won ? 100 : 30;
    const user = await prisma.user.findUnique({ where: { id: player.userId } });
    if (!user) continue;
    const totalXp = user.xp + xp;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          gamesPlayed: { increment: 1 },
          ...(won ? { gamesWon: { increment: 1 } } : {}),
          xp: { increment: xp },
          coins: { increment: coins },
          level: Math.floor(Math.sqrt(totalXp / 100)) + 1,
        },
      }),
      prisma.matchHistory.create({
        data: {
          userId: user.id,
          gameId: "bunker",
          roomId,
          result: won ? "WIN" : "PLAYED",
          winner: "survivors",
          summary: won ? "Попал в бункер и пережил катастрофу" : "Не прошёл отбор в бункер",
          playersCount: players.length,
          xpEarned: xp,
          coinsEarned: coins,
        },
      }),
    ]);
  }
}

export async function GET(req: NextRequest) {
  try {
    const initData = req.headers.get("x-init-data") || "";
    const user = await getUser(initData);
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const roomId = req.nextUrl.searchParams.get("roomId") || "";
    if (!roomId) return NextResponse.json({ error: "Не указана комната" }, { status: 400 });
    const room = await prisma.bunkerRoom.findUnique({
      where: { id: roomId },
      include: { players: { include: { user: { include: { settings: true } }, } } },
    });
    if (!room || !room.players.some(p => p.userId === user.id)) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }
    return NextResponse.json({ room: safeRoom(room, user.id), meId: user.id });
  } catch (error) {
    console.error("Bunker GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить комнату" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getUser(String(body.initData || ""));
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const action = String(body.action || "");

    if (action === "create") {
      const maxPlayers = Math.min(16, Math.max(4, Number(body.maxPlayers) || 10));
      let code = generateRoomCode();
      for (let i = 0; i < 4 && await prisma.bunkerRoom.findUnique({ where: { code } }); i++) code = generateRoomCode();
      const room = await prisma.bunkerRoom.create({
        data: {
          code,
          name: String(body.name || "Бункер").slice(0, 32),
          hostId: user.id,
          maxPlayers,
          players: { create: { userId: user.id, isHost: true } },
        },
      });
      return NextResponse.json({ roomId: room.id });
    }

    if (action === "join") {
      const code = String(body.code || "").trim().toUpperCase();
      const room = await prisma.bunkerRoom.findUnique({ where: { code }, include: { players: true } });
      if (!room || room.status !== "WAITING") return NextResponse.json({ error: "Комната не найдена или игра уже началась" }, { status: 404 });
      if (room.players.some(p => p.userId === user.id)) return NextResponse.json({ roomId: room.id });
      if (room.players.length >= room.maxPlayers) return NextResponse.json({ error: "Комната заполнена" }, { status: 409 });
      await prisma.bunkerPlayer.create({ data: { roomId: room.id, userId: user.id } });
      return NextResponse.json({ roomId: room.id });
    }

    const roomId = String(body.roomId || "");
    const room = await prisma.bunkerRoom.findUnique({
      where: { id: roomId },
      include: { players: true },
    });
    if (!room || !room.players.some(p => p.userId === user.id)) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }
    const me = room.players.find(p => p.userId === user.id)!;

    if (action === "start") {
      if (room.hostId !== user.id) return NextResponse.json({ error: "Начать игру может только создатель" }, { status: 403 });
      if (room.status !== "WAITING") return NextResponse.json({ error: "Игра уже началась" }, { status: 409 });
      if (room.players.length < room.minPlayers) return NextResponse.json({ error: "Нужно минимум 4 игрока" }, { status: 400 });
      for (const player of room.players) {
        const character = {
          profession: pick(CARD_POOL.profession),
          health: pick(CARD_POOL.health),
          hobby: pick(CARD_POOL.hobby),
          baggage: pick(CARD_POOL.baggage),
          fact: pick(CARD_POOL.fact),
        };
        await prisma.bunkerPlayer.update({
          where: { id: player.id },
          data: { character: character as Prisma.InputJsonValue, revealedFields: [], isActive: true },
        });
      }
      const state: GameState = {
        apocalypse: pick(APOCALYPSES),
        capacity: Math.max(2, Math.ceil(room.players.length / 2)),
        round: 1,
        phase: "DISCUSSION",
        currentCategory: CATEGORIES[0],
        votes: {},
      };
      await prisma.bunkerRoom.update({
        where: { id: room.id },
        data: { status: "PLAYING", startedAt: new Date(), gameState: state as Prisma.InputJsonValue },
      });
      return NextResponse.json({ success: true });
    }

    if (room.status !== "PLAYING") return NextResponse.json({ error: "Игра не активна" }, { status: 409 });
    const state = (room.gameState || {}) as GameState;

    if (action === "reveal") {
      if (state.phase !== "DISCUSSION") return NextResponse.json({ error: "Сейчас голосование" }, { status: 409 });
      if (!me.isActive) return NextResponse.json({ error: "Вы выбыли" }, { status: 403 });
      if (me.revealedFields.includes(state.currentCategory)) return NextResponse.json({ error: "Карточка уже открыта" }, { status: 409 });
      await prisma.bunkerPlayer.update({
        where: { id: me.id },
        data: { revealedFields: { push: state.currentCategory } },
      });
      const active = await prisma.bunkerPlayer.findMany({ where: { roomId, isActive: true } });
      const everyoneRevealed = active.every(p => p.id === me.id || p.revealedFields.includes(state.currentCategory));
      if (everyoneRevealed) {
        await prisma.bunkerRoom.update({ where: { id: room.id }, data: { gameState: { ...state, phase: "VOTING" } as Prisma.InputJsonValue } });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "vote") {
      if (state.phase !== "VOTING") return NextResponse.json({ error: "Сейчас обсуждение карточек" }, { status: 409 });
      if (!me.isActive) return NextResponse.json({ error: "Вы выбыли" }, { status: 403 });
      const targetId = String(body.targetId || "");
      const target = room.players.find(p => p.userId === targetId && p.isActive);
      if (!target || target.userId === user.id) return NextResponse.json({ error: "Выберите другого участника" }, { status: 400 });
      if (state.votes[user.id]) return NextResponse.json({ error: "Вы уже проголосовали" }, { status: 409 });
      const votes = { ...state.votes, [user.id]: targetId };
      const active = await prisma.bunkerPlayer.findMany({ where: { roomId, isActive: true } });
      if (Object.keys(votes).length >= active.length) {
        const tally: Record<string, number> = {};
        Object.values(votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
        const highest = Math.max(...Object.values(tally));
        const tied = Object.keys(tally).filter(id => tally[id] === highest);
        const eliminatedUserId = pick(tied);
        await prisma.bunkerPlayer.update({ where: { roomId_userId: { roomId, userId: eliminatedUserId } }, data: { isActive: false } });
        const remaining = active.length - 1;
        const nextRound = state.round + 1;
        const nextCategory = CATEGORIES[(nextRound - 1) % CATEGORIES.length];
        const nextState: GameState = {
          ...state,
          round: nextRound,
          currentCategory: nextCategory,
          phase: "DISCUSSION",
          votes: {},
          eliminatedUserId,
        };
        if (remaining <= state.capacity) {
          await finishRoom(room.id, nextState);
        } else {
          await prisma.bunkerRoom.update({ where: { id: room.id }, data: { gameState: nextState as Prisma.InputJsonValue } });
        }
      } else {
        await prisma.bunkerRoom.update({ where: { id: room.id }, data: { gameState: { ...state, votes } as Prisma.InputJsonValue } });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Bunker POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
