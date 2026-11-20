import { Bot, Context, InlineKeyboard, session } from "grammy";
import { prisma } from "./prisma";
import { nanoid } from "nanoid";
import { registerGroupGames } from "./group-games";

// ======================
// ТИПЫ СЕССИИ
// ======================

interface SessionData {
  waitingForPromo?: {
    step: "code" | "coins" | "gems" | "maxUses" | "expires";
    data: {
      code?: string;
      coins?: number;
      gems?: number;
      maxUses?: number | null;
      expiresAt?: Date | null;
    };
  };
}

type MyContext = Context & { session: SessionData };

// ======================
// БОТ
// ======================

const token = process.env.BOT_TOKEN!;
if (!token) {
  console.warn("BOT_TOKEN is not set");
}

export const bot = new Bot<MyContext>(token || "dummy");

// Сессия (в памяти — для продакшена лучше Redis)
bot.use(session({ initial: (): SessionData => ({}) }));

// Групповые игры GameHub
registerGroupGames(bot);

// ======================
// ХЕЛПЕРЫ
// ======================

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map(Number);

function isAdmin(ctx: MyContext): boolean {
  const userId = ctx.from?.id;
  if (!userId) return false;
  return ADMIN_IDS.includes(userId);
}

async function ensureUser(ctx: MyContext) {
  if (!ctx.from) return null;

  const telegramId = BigInt(ctx.from.id);

  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code || "ru",
        isAdmin: ADMIN_IDS.includes(ctx.from.id),
      },
    });
  } else {
    // Обновляем lastActive
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
    });
  }

  return user;
}

// ======================
// КОМАНДЫ
// ======================

bot.command("start", async (ctx) => {
  const user = await ensureUser(ctx);
  if (!user) return;

  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

  const keyboard = new InlineKeyboard().webApp(
    "Играть",
    webAppUrl
  );

  await ctx.reply(
    `Добро пожаловать в <b>Игровой Хаб</b>!\n\n` +
      `У тебя <b>${user.coins}</b> монет и <b>${user.gems}</b> гемов.\n\n` +
      `Нажми кнопку ниже, чтобы открыть приложение.`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

bot.command("balance", async (ctx) => {
  const user = await ensureUser(ctx);
  if (!user) return;

  await ctx.reply(
    `Твой баланс:\n\n` +
      `Монеты: <b>${user.coins}</b>\n` +
      `Гемы: <b>${user.gems}</b>`,
    { parse_mode: "HTML" }
  );
});

bot.command("promo", async (ctx) => {
  const user = await ensureUser(ctx);
  if (!user) return;

  const code = ctx.match?.trim().toUpperCase();
  if (!code) {
    await ctx.reply("Использование: /promo КОД");
    return;
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code },
  });

  if (!promo || !promo.isActive) {
    await ctx.reply("Промокод не найден или уже недействителен.");
    return;
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    await ctx.reply("Срок действия промокода истёк.");
    return;
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    await ctx.reply("Промокод больше нельзя использовать.");
    return;
  }

  // Проверяем, не активировал ли уже
  const existing = await prisma.promoRedemption.findUnique({
    where: {
      userId_promoId: {
        userId: user.id,
        promoId: promo.id,
      },
    },
  });

  if (existing) {
    await ctx.reply("Ты уже активировал этот промокод.");
    return;
  }

  // Активируем
  await prisma.$transaction([
    prisma.promoRedemption.create({
      data: {
        userId: user.id,
        promoId: promo.id,
      },
    }),
    prisma.promoCode.update({
      where: { id: promo.id },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { increment: promo.coins },
        gems: { increment: promo.gems },
      },
    }),
  ]);

  let msg = "Промокод активирован!\n\n";
  if (promo.coins > 0) msg += `+${promo.coins} монет\n`;
  if (promo.gems > 0) msg += `+${promo.gems} гемов\n`;

  await ctx.reply(msg);
});

// ======================
// АДМИН-КОМАНДЫ
// ======================

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Нет доступа.");
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("Создать промокод", "admin:create_promo")
    .row()
    .text("Список промокодов", "admin:list_promos")
    .row()
    .text("Выдать валюту", "admin:give_currency")
    .row()
    .text("Статистика", "admin:stats");

  await ctx.reply("Админ-панель", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery("admin:create_promo", async (ctx) => {
  if (!isAdmin(ctx)) return;

  ctx.session.waitingForPromo = {
    step: "code",
    data: {},
  };

  await ctx.answerCallbackQuery();
  await ctx.reply(
    "Создание промокода\n\n" +
      "Введи код (латиница/цифры, без пробелов).\n" +
      "Или отправь /cancel для отмены."
  );
});

bot.callbackQuery("admin:list_promos", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCallbackQuery();

  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (promos.length === 0) {
    await ctx.reply("Промокодов пока нет.");
    return;
  }

  const lines = promos.map((p) => {
    const status = p.isActive ? "активен" : "выкл";
    const uses =
      p.maxUses === null ? `${p.usedCount}/∞` : `${p.usedCount}/${p.maxUses}`;
    return (
      `<code>${p.code}</code> — ${p.coins} монет / ${p.gems} гемов\n` +
      `Использований: ${uses} · ${status}`
    );
  });

  await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });
});

bot.callbackQuery("admin:stats", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCallbackQuery();

  const [usersCount, totalCoins, activeRooms] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.mafiaRoom.count({
      where: { status: { in: ["WAITING", "NIGHT", "DAY", "VOTING"] } },
    }),
  ]);

  await ctx.reply(
    `Статистика\n\n` +
      `Пользователей: <b>${usersCount}</b>\n` +
      `Всего монет в системе: <b>${totalCoins._sum.coins || 0}</b>\n` +
      `Активных комнат Мафии: <b>${activeRooms}</b>`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("admin:give_currency", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "Чтобы выдать валюту, используй команду:\n\n" +
      "<code>/give TELEGRAM_ID coins|gems КОЛИЧЕСТВО</code>\n\n" +
      "Пример:\n<code>/give 123456789 coins 500</code>",
    { parse_mode: "HTML" }
  );
});

bot.command("give", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("Нет доступа.");
    return;
  }

  const parts = ctx.match?.trim().split(/\s+/) || [];
  if (parts.length !== 3) {
    await ctx.reply("Формат: /give TELEGRAM_ID coins|gems КОЛИЧЕСТВО");
    return;
  }

  const [tgIdStr, currency, amountStr] = parts;
  const telegramId = BigInt(tgIdStr);
  const amount = parseInt(amountStr, 10);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("Количество должно быть положительным числом.");
    return;
  }

  if (currency !== "coins" && currency !== "gems") {
    await ctx.reply("Валюта должна быть coins или gems.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    await ctx.reply("Пользователь не найден.");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      [currency]: { increment: amount },
    },
  });

  await ctx.reply(
    `Выдано ${amount} ${currency === "coins" ? "монет" : "гемов"} пользователю ${user.firstName || user.telegramId}`
  );
});

bot.command("cancel", async (ctx) => {
  if (ctx.session.waitingForPromo) {
    ctx.session.waitingForPromo = undefined;
    await ctx.reply("Создание промокода отменено.");
  }
});

// Обработка шагов создания промокода
bot.on("message:text", async (ctx) => {
  if (!ctx.session.waitingForPromo || !isAdmin(ctx)) return;

  const text = ctx.message.text.trim();
  const state = ctx.session.waitingForPromo;

  if (state.step === "code") {
    const code = text.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{3,20}$/.test(code)) {
      await ctx.reply("Код должен быть 3–20 символов (латиница и цифры).");
      return;
    }

    const exists = await prisma.promoCode.findUnique({ where: { code } });
    if (exists) {
      await ctx.reply("Такой код уже существует. Придумай другой.");
      return;
    }

    state.data.code = code;
    state.step = "coins";
    await ctx.reply("Сколько монет давать? (число, 0 если не нужно)");
    return;
  }

  if (state.step === "coins") {
    const coins = parseInt(text, 10);
    if (isNaN(coins) || coins < 0) {
      await ctx.reply("Введи целое число ≥ 0");
      return;
    }
    state.data.coins = coins;
    state.step = "gems";
    await ctx.reply("Сколько гемов давать? (число, 0 если не нужно)");
    return;
  }

  if (state.step === "gems") {
    const gems = parseInt(text, 10);
    if (isNaN(gems) || gems < 0) {
      await ctx.reply("Введи целое число ≥ 0");
      return;
    }
    state.data.gems = gems;
    state.step = "maxUses";
    await ctx.reply(
      "Максимальное количество использований?\n" +
        "Число или 0 / бесконечно — для безлимита"
    );
    return;
  }

  if (state.step === "maxUses") {
    let maxUses: number | null = null;
    if (text !== "0" && text.toLowerCase() !== "бесконечно") {
      const n = parseInt(text, 10);
      if (isNaN(n) || n < 1) {
        await ctx.reply("Введи число ≥ 1 или 0/бесконечно");
        return;
      }
      maxUses = n;
    }
    state.data.maxUses = maxUses;

    // Создаём сразу (без срока для простоты MVP)
    const promo = await prisma.promoCode.create({
      data: {
        code: state.data.code!,
        coins: state.data.coins || 0,
        gems: state.data.gems || 0,
        maxUses: state.data.maxUses,
        createdBy: BigInt(ctx.from!.id),
      },
    });

    ctx.session.waitingForPromo = undefined;

    await ctx.reply(
      `Промокод создан!\n\n` +
        `Код: <code>${promo.code}</code>\n` +
        `Монеты: ${promo.coins}\n` +
        `Гемы: ${promo.gems}\n` +
        `Лимит: ${promo.maxUses ?? "∞"}`,
      { parse_mode: "HTML" }
    );
  }
});

// Обработка ошибок
bot.catch((err) => {
  console.error("Bot error:", err);
});

export default bot;
