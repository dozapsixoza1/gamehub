import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) } });
  return user && !user.isBanned ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req.headers.get("x-init-data") || "");
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const [gifts, owned, orders] = await Promise.all([
      prisma.nftGift.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] }),
      prisma.userNft.findMany({ where: { userId: user.id }, include: { gift: true }, orderBy: { acquiredAt: "desc" } }),
      prisma.nftOrder.findMany({ where: { userId: user.id }, include: { gift: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ gifts, owned, orders });
  } catch (error) {
    console.error("NFT GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить NFT-магазин" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getUser(String(body.initData || ""));
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    if (body.action !== "create_order") return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    const giftId = String(body.giftId || "");
    const buyerNote = String(body.note || "").trim().slice(0, 300);
    const gift = await prisma.nftGift.findFirst({ where: { id: giftId, isActive: true } });
    if (!gift) return NextResponse.json({ error: "Подарок не найден" }, { status: 404 });
    const pending = await prisma.nftOrder.findFirst({ where: { userId: user.id, giftId, status: "PENDING" } });
    const contact = process.env.OWNER_TELEGRAM_USERNAME ? "https://t.me/" + process.env.OWNER_TELEGRAM_USERNAME.replace(/^@/, "") : "";
    if (pending) return NextResponse.json({ success: true, orderId: pending.id, message: "Заявка уже создана. Ожидай ответа владельца.", contactUrl: contact || null });
    const order = await prisma.nftOrder.create({ data: { userId: user.id, giftId, buyerNote: buyerNote || null } });
    const username = user.username ? "@" + user.username : (user.firstName || "Игрок");
    const text = [
      "Новая заявка на NFT GameHub",
      "Подарок: " + gift.name + " [" + gift.rarity + "]",
      "Покупатель: " + username,
      "ID заявки: " + order.id,
      buyerNote ? "Комментарий: " + buyerNote : "",
      "Открой админку GameHub, чтобы выдать подарок после подтверждения оплаты."
    ].filter(Boolean).join("\n");
    const token = process.env.BOT_TOKEN;
    const ownerIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(v => v.trim()).filter(v => /^\d+$/.test(v));
    if (token && ownerIds.length) {
      await Promise.allSettled(ownerIds.map(chatId => fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
      })));
    }
    return NextResponse.json({ success: true, orderId: order.id, message: "Заявка отправлена владельцу. Оплату согласуй с ним в личных сообщениях.", contactUrl: contact || null });
  } catch (error) {
    console.error("NFT POST:", error);
    return NextResponse.json({ error: "Не удалось создать заявку" }, { status: 500 });
  }
}
