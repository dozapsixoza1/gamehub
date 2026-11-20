import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "./prisma";
import { getDefaultRolesConfig } from "./mafia/roles";
import { generateRoomCode } from "./utils";

const BOT_USERNAME = "gamehubesbot";

export function registerGroupGames(bot: Bot<any>) {
  const createMafiaRoom = async (ctx: any) => {
    const chat = ctx.chat;
    const from = ctx.from;
    if (!chat || !from || !["group", "supergroup"].includes(chat.type)) {
      await ctx.reply("Команду /game используй в групповом чате GameHub.");
      return;
    }

    try {
      const telegramId = BigInt(from.id);
      const user = await prisma.user.upsert({
        where: { telegramId },
        create: {
          telegramId,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          languageCode: from.language_code || "ru",
        },
        update: {
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          lastActiveAt: new Date(),
        },
      });

      let code = generateRoomCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        if (!(await prisma.mafiaRoom.findUnique({ where: { code } }))) break;
        code = generateRoomCode();
      }

      const room = await prisma.mafiaRoom.create({
        data: {
          code,
          hostId: user.id,
          name: "Мафия · " + (chat.title || "GameHub"),
          maxPlayers: 12,
          minPlayers: 4,
          rolesConfig: getDefaultRolesConfig(8),
          players: {
            create: { userId: user.id, isHost: true, seatNumber: 1 },
          },
        },
      });

      const inviteLink = `https://t.me/${BOT_USERNAME}?start=mafia_${room.code}`;
      const keyboard = new InlineKeyboard().url("🔗 Поделиться приглашением", inviteLink);
      await ctx.reply(
        "💀 <b>Комната Мафии создана!</b>\n\n" +
          "Создатель: <b>" + (from.first_name || "Игрок") + "</b>\n" +
          "Игроков: <b>1/12</b>\n" +
          "Код комнаты: <code>" + room.code + "</code>\n\n" +
          "Приглашение: " + inviteLink + "\n\n" +
          "Минимум для старта — 4 игрока. Нажмите ссылку, чтобы открыть бота и автоматически войти в комнату.",
        { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } },
      );
    } catch (error) {
      console.error("Group Mafia room creation:", error);
      await ctx.reply("Не удалось создать комнату Мафии. Попробуй ещё раз чуть позже.");
    }
  };

  bot.command("game", createMafiaRoom);
  bot.command("mafia", createMafiaRoom);
  bot.command("games", createMafiaRoom);
}
