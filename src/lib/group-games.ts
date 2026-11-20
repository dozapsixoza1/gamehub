import { Bot, Context, InlineKeyboard } from "grammy";
import { prisma } from "./prisma";

type GameId = "quiz" | "sort" | "tubo";
type Player = { id: string; name: string };
type Question = { prompt: string; options: string[]; correct: number };
type RoomState = {
  round: number;
  scores: Record<string, number>;
  answers: Record<string, number>;
  questions: Question[];
  hands?: Record<string, number[]>;
  picks?: Record<string, number>;
  turn?: number;
};

const GAME_NAMES: Record<GameId, string> = {
  quiz: "Кто умнее 1 на 1",
  sort: "Сортировка 1 на 1",
  tubo: "Тубо — карточная битва",
};

const QUIZ_QUESTIONS: Question[] = [
  { prompt: "Какая планета ближе всего к Солнцу?", options: ["Венера", "Меркурий", "Марс", "Земля"], correct: 1 },
  { prompt: "Сколько сторон у шестиугольника?", options: ["5", "6", "7", "8"], correct: 1 },
  { prompt: "Какой океан самый большой?", options: ["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"], correct: 2 },
  { prompt: "Сколько будет 12 × 8?", options: ["86", "92", "96", "108"], correct: 2 },
  { prompt: "Как называется столица Японии?", options: ["Киото", "Осака", "Токио", "Нагоя"], correct: 2 },
  { prompt: "Какой газ растения поглощают при фотосинтезе?", options: ["Кислород", "Углекислый газ", "Азот", "Водород"], correct: 1 },
  { prompt: "Сколько минут в двух часах?", options: ["100", "110", "120", "140"], correct: 2 },
  { prompt: "Какое животное самое крупное на Земле?", options: ["Африканский слон", "Синий кит", "Жираф", "Кашалот"], correct: 1 },
];

const SORT_QUESTIONS: Question[] = [
  { prompt: "Расположи планеты по удалённости от Солнца — от ближайшей к самой дальней.", options: ["Меркурий → Венера → Земля → Марс", "Венера → Меркурий → Марс → Земля", "Земля → Венера → Меркурий → Марс"], correct: 0 },
  { prompt: "Расположи числа по возрастанию.", options: ["3 → 8 → 12 → 19", "8 → 3 → 19 → 12", "12 → 3 → 8 → 19"], correct: 0 },
  { prompt: "Расположи единицы длины от меньшей к большей.", options: ["мм → см → м → км", "см → мм → км → м", "м → см → мм → км"], correct: 0 },
  { prompt: "Расположи времена года, начиная с весны.", options: ["Весна → лето → осень → зима", "Лето → весна → зима → осень", "Осень → зима → весна → лето"], correct: 0 },
  { prompt: "Расположи числа по убыванию.", options: ["41 → 27 → 16 → 9", "9 → 16 → 27 → 41", "27 → 41 → 9 → 16"], correct: 0 },
];

function displayName(from: any): string {
  if (!from) return "Игрок";
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || (from.username ? "@" + from.username : "Игрок");
}

function asPlayers(value: unknown): Player[] {
  return Array.isArray(value) ? value as Player[] : [];
}

function asState(value: unknown): RoomState {
  return value as RoomState;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function gameKeyboard(roomId: string, players: Player[], hostId: string) {
  const keyboard = new InlineKeyboard().text("➕ Присоединиться", "gg:join:" + roomId);
  if (players.length >= 2 && players.some((p) => p.id === hostId)) {
    keyboard.row().text("▶️ Начать игру", "gg:start:" + roomId);
  }
  return keyboard;
}

function lobbyText(gameId: GameId, players: Player[], maxPlayers: number, hostId: string) {
  const list = players.map((p, i) => (i + 1) + ". " + p.name + (p.id === hostId ? " 👑" : "")).join("\n");
  return "🎮 <b>" + GAME_NAMES[gameId] + "</b>\n\nСобираем игроков: <b>" + players.length + "/" + maxPlayers + "</b>\n" + list + "\n\nНажми «Присоединиться», чтобы войти. Создатель комнаты запускает игру кнопкой ниже.";
}

function questionKeyboard(roomId: string, question: Question) {
  const keyboard = new InlineKeyboard();
  question.options.forEach((option, index) => keyboard.text((index + 1) + ". " + option, "gg:answer:" + roomId + ":" + index).row());
  return keyboard;
}

async function updateRoomMessage(ctx: Context, room: any, text: string, keyboard?: InlineKeyboard) {
  const chatId = Number(room.chatId);
  if (room.messageId) {
    try {
      await ctx.api.editMessageText(chatId, room.messageId, text, { parse_mode: "HTML", reply_markup: keyboard });
      return;
    } catch (error) {
      console.warn("Could not edit group game message; sending a new one.", error);
    }
  }
  const sent = await ctx.api.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
  await prisma.groupGameRoom.update({ where: { id: room.id }, data: { messageId: sent.message_id } });
}

async function recordResults(room: any, players: Player[], scores: Record<string, number>) {
  const ranked = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const topScore = scores[ranked[0]?.id] || 0;
  const winners = ranked.filter((p) => (scores[p.id] || 0) === topScore);
  const lines = ranked.map((p, i) => (i + 1) + ". " + p.name + " — <b>" + (scores[p.id] || 0) + "</b>").join("\n");

  for (const player of players) {
    const won = winners.some((p) => p.id === player.id);
    const telegramId = BigInt(player.id);
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: { telegramId, firstName: player.name, xp: won ? 20 : 5, gamesPlayed: 1, gamesWon: won ? 1 : 0 },
      update: {
        xp: { increment: won ? 20 : 5 },
        gamesPlayed: { increment: 1 },
        ...(won ? { gamesWon: { increment: 1 } } : {}),
        lastActiveAt: new Date(),
      },
    });
    await prisma.matchHistory.create({
      data: {
        userId: user.id,
        gameId: "group-" + room.gameId,
        roomId: room.id,
        result: won ? "WIN" : "PLAYED",
        winner: winners.map((p) => p.name).join(", "),
        summary: GAME_NAMES[room.gameId as GameId] + ": " + (scores[player.id] || 0) + " очков",
        playersCount: players.length,
        xpEarned: won ? 20 : 5,
      },
    });
  }

  await prisma.groupGameRoom.update({ where: { id: room.id }, data: { status: "FINISHED" } });
  const winnerText = winners.length > 1 ? "🤝 Ничья: " + winners.map((p) => p.name).join(", ") : "🏆 Победитель: " + winners[0]?.name;
  return "🏁 <b>Игра завершена!</b>\n\n" + lines + "\n\n" + winnerText + "\n\nУчастники получили XP за игру.";
}

async function renderQuizQuestion(ctx: Context, room: any, players: Player[], state: RoomState) {
  const question = state.questions[state.round];
  if (!question) {
    const result = await recordResults(room, players, state.scores);
    await updateRoomMessage(ctx, room, result);
    return;
  }
  state.answers = {};
  await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
  await updateRoomMessage(
    ctx,
    room,
    "🧠 <b>" + GAME_NAMES[room.gameId as GameId] + "</b>\nРаунд <b>" + (state.round + 1) + "/" + state.questions.length + "</b>\n\n" + question.prompt + "\n\nКаждый игрок выбирает ответ. За правильный ответ — 1 очко.\nОтветили: 0/" + players.length,
    questionKeyboard(room.id, question),
  );
}

async function renderTuboTurn(ctx: Context, room: any, players: Player[], state: RoomState) {
  const player = players[state.turn || 0];
  if (!player) return;
  const hand = state.hands?.[player.id] || [];
  const keyboard = new InlineKeyboard();
  hand.forEach((card, index) => keyboard.text("🃏 " + card, "gg:card:" + room.id + ":" + index));
  keyboard.row().text("Правила", "gg:rules:" + room.id);
  const picks = Object.keys(state.picks || {}).length;
  await updateRoomMessage(
    ctx,
    room,
    "🃏 <b>ТУБО — карточная битва</b>\nРаунд " + (state.round + 1) + "/3\n\nХод игрока: <b>" + player.name + "</b>\nВыбери одну карту. После выбора ход перейдёт следующему игроку.\n\nУже выбрали: " + picks + "/" + players.length + "\n\nКарты сравниваются после хода всех участников. Победитель раунда получает 1 очко.",
    keyboard,
  );
}

async function startTuboRound(ctx: Context, room: any, players: Player[], state: RoomState) {
  state.hands = Object.fromEntries(players.map((p) => [p.id, shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3)]));
  state.picks = {};
  state.turn = 0;
  await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
  await renderTuboTurn(ctx, room, players, state);
}

export function registerGroupGames(bot: Bot<any>) {
  const showCatalog = async (ctx: Context) => {
    if (!ctx.chat || !["group", "supergroup"].includes(ctx.chat.type)) {
      await ctx.reply("Добавь @gamehubesbot в групповой чат и напиши там /game.");
      return;
    }
    const keyboard = new InlineKeyboard()
      .text("🧠 Кто умнее 1 на 1", "gg:create:quiz").row()
      .text("🔢 Сортировка 1 на 1", "gg:create:sort").row()
      .text("🃏 Тубо — карточная битва", "gg:create:tubo");
    await ctx.reply("🎮 <b>GameHub — игры в чате</b>\n\nВыбирай игру. Комната появится прямо здесь, а остальные участники смогут присоединиться кнопкой.", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  };

  bot.command("game", showCatalog);
  bot.command("games", showCatalog);

  bot.callbackQuery(/^gg:create:(quiz|sort|tubo)$/, async (ctx: any) => {
    await ctx.answerCallbackQuery();
    const chat = ctx.chat;
    const from = ctx.from;
    if (!chat || !from || !["group", "supergroup"].includes(chat.type)) return;
    const gameId = ctx.match[1] as GameId;
    const existing = await prisma.groupGameRoom.findFirst({
      where: { chatId: BigInt(chat.id), status: { in: ["WAITING", "PLAYING"] } },
    });
    if (existing) {
      await ctx.reply("В этом чате уже есть активная игровая комната. Завершите её перед созданием новой.");
      return;
    }
    const host: Player = { id: String(from.id), name: displayName(from) };
    const room = await prisma.groupGameRoom.create({
      data: {
        chatId: BigInt(chat.id),
        hostId: BigInt(from.id),
        gameId,
        status: "WAITING",
        players: [host],
        state: { round: 0, scores: {}, answers: {}, questions: [] },
      },
    });
    const maxPlayers = gameId === "tubo" ? 6 : 2;
    const sent = await ctx.api.sendMessage(chat.id, lobbyText(gameId, [host], maxPlayers, host.id), {
      parse_mode: "HTML",
      reply_markup: gameKeyboard(room.id, [host], host.id),
    });
    await prisma.groupGameRoom.update({ where: { id: room.id }, data: { messageId: sent.message_id } });
  });

  bot.callbackQuery(/^gg:join:([a-z0-9]+)$/, async (ctx: any) => {
    const room = await prisma.groupGameRoom.findUnique({ where: { id: ctx.match[1] } });
    if (!room || room.status !== "WAITING") {
      await ctx.answerCallbackQuery({ text: "Комната уже закрыта или игра началась." });
      return;
    }
    const players = asPlayers(room.players);
    const userId = String(ctx.from.id);
    if (players.some((p) => p.id === userId)) {
      await ctx.answerCallbackQuery({ text: "Ты уже в комнате." });
      return;
    }
    const maxPlayers = room.gameId === "tubo" ? 6 : 2;
    if (players.length >= maxPlayers) {
      await ctx.answerCallbackQuery({ text: "Комната заполнена." });
      return;
    }
    players.push({ id: userId, name: displayName(ctx.from) });
    const updated = await prisma.groupGameRoom.update({ where: { id: room.id }, data: { players } });
    await ctx.answerCallbackQuery({ text: "Ты присоединился к игре." });
    await updateRoomMessage(ctx, updated, lobbyText(room.gameId as GameId, players, maxPlayers, String(room.hostId)), gameKeyboard(room.id, players, String(room.hostId)));
  });

  bot.callbackQuery(/^gg:start:([a-z0-9]+)$/, async (ctx: any) => {
    const room = await prisma.groupGameRoom.findUnique({ where: { id: ctx.match[1] } });
    if (!room || room.status !== "WAITING") {
      await ctx.answerCallbackQuery({ text: "Комната уже закрыта." });
      return;
    }
    if (String(room.hostId) !== String(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Запустить игру может только создатель." });
      return;
    }
    const players = asPlayers(room.players);
    if (players.length < 2) {
      await ctx.answerCallbackQuery({ text: "Нужно минимум 2 игрока." });
      return;
    }
    const state: RoomState = {
      round: 0,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      answers: {},
      questions: room.gameId === "sort" ? shuffle(SORT_QUESTIONS).slice(0, 5) : shuffle(QUIZ_QUESTIONS).slice(0, 5),
    };
    await prisma.groupGameRoom.update({ where: { id: room.id }, data: { status: "PLAYING", state: state as any } });
    await ctx.answerCallbackQuery({ text: "Игра началась!" });
    if (room.gameId === "tubo") {
      await startTuboRound(ctx, room, players, state);
    } else {
      await renderQuizQuestion(ctx, room, players, state);
    }
  });

  bot.callbackQuery(/^gg:answer:([a-z0-9]+):(\d+)$/, async (ctx: any) => {
    const room = await prisma.groupGameRoom.findUnique({ where: { id: ctx.match[1] } });
    if (!room || room.status !== "PLAYING" || !["quiz", "sort"].includes(room.gameId)) {
      await ctx.answerCallbackQuery({ text: "Этот вопрос уже закрыт." });
      return;
    }
    const players = asPlayers(room.players);
    const playerId = String(ctx.from.id);
    if (!players.some((p) => p.id === playerId)) {
      await ctx.answerCallbackQuery({ text: "Ты не участвуешь в этой игре." });
      return;
    }
    const state = asState(room.state);
    if (state.answers[playerId] !== undefined) {
      await ctx.answerCallbackQuery({ text: "Ответ уже принят." });
      return;
    }
    const answer = Number(ctx.match[2]);
    const question = state.questions[state.round];
    if (!question || answer < 0 || answer >= question.options.length) {
      await ctx.answerCallbackQuery({ text: "Вариант больше недоступен." });
      return;
    }
    state.answers[playerId] = answer;
    if (answer === question.correct) state.scores[playerId] = (state.scores[playerId] || 0) + 1;
    await ctx.answerCallbackQuery({ text: answer === question.correct ? "Верно! +1 очко" : "Ответ принят." });
    if (Object.keys(state.answers).length >= players.length) {
      state.round += 1;
      await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
      await renderQuizQuestion(ctx, room, players, state);
    } else {
      await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
      await updateRoomMessage(ctx, room, "🧠 <b>" + GAME_NAMES[room.gameId as GameId] + "</b>\nРаунд " + (state.round + 1) + "/" + state.questions.length + "\n\n" + question.prompt + "\n\nОтветили: " + Object.keys(state.answers).length + "/" + players.length + "\n\nОтветы уже приняты. Остальные игроки, ваш ход.", questionKeyboard(room.id, question));
    }
  });

  bot.callbackQuery(/^gg:card:([a-z0-9]+):(\d+)$/, async (ctx: any) => {
    const room = await prisma.groupGameRoom.findUnique({ where: { id: ctx.match[1] } });
    if (!room || room.status !== "PLAYING" || room.gameId !== "tubo") {
      await ctx.answerCallbackQuery({ text: "Эта партия уже завершена." });
      return;
    }
    const players = asPlayers(room.players);
    const state = asState(room.state);
    const current = players[state.turn || 0];
    if (!current || current.id !== String(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "Сейчас ход другого игрока." });
      return;
    }
    const hand = state.hands?.[current.id] || [];
    const index = Number(ctx.match[2]);
    if (index < 0 || index >= hand.length) {
      await ctx.answerCallbackQuery({ text: "Карта уже недоступна." });
      return;
    }
    const card = hand.splice(index, 1)[0];
    state.hands![current.id] = hand;
    state.picks![current.id] = card;
    state.turn = (state.turn || 0) + 1;
    await ctx.answerCallbackQuery({ text: "Выбрана карта " + card + "." });
    if (state.turn >= players.length) {
      const picked = players.map((p) => ({ id: p.id, card: state.picks![p.id] || 0 }));
      const high = Math.max(...picked.map((p) => p.card));
      const roundWinners = picked.filter((p) => p.card === high);
      if (roundWinners.length === 1) state.scores[roundWinners[0].id] = (state.scores[roundWinners[0].id] || 0) + 1;
      state.round += 1;
      if (state.round >= 3) {
        const result = await recordResults(room, players, state.scores);
        await updateRoomMessage(ctx, room, "🃏 <b>ТУБО — итоги карточной битвы</b>\n\n" + result);
      } else {
        await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
        await startTuboRound(ctx, room, players, state);
      }
    } else {
      await prisma.groupGameRoom.update({ where: { id: room.id }, data: { state: state as any } });
      await renderTuboTurn(ctx, room, players, state);
    }
  });

  bot.callbackQuery(/^gg:rules:([a-z0-9]+)$/, async (ctx: any) => {
    await ctx.answerCallbackQuery({
      text: "Каждый игрок выбирает одну из трёх карт. Самая высокая карта приносит 1 очко. Игра длится 3 раунда.",
      show_alert: true,
    });
  });
}
