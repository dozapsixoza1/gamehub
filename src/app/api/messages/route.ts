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
    const me = await getUser(req.headers.get("x-init-data") || "");
    if (!me) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const withId = req.nextUrl.searchParams.get("with") || "";
    const search = (req.nextUrl.searchParams.get("search") || "").trim().slice(0, 40);

    if (search.length >= 2) {
      const users = await prisma.user.findMany({
        where: { id: { not: me.id }, isBanned: false, OR: [
          { username: { contains: search.replace(/^@/, ""), mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } }
        ] },
        select: { id: true, username: true, firstName: true, photoUrl: true },
        take: 12
      });
      return NextResponse.json({ users });
    }

    if (withId) {
      const target = await prisma.user.findFirst({ where: { id: withId, isBanned: false }, select: { id: true, username: true, firstName: true, photoUrl: true } });
      if (!target || target.id === me.id) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
      const [blockedByMe, blockedMe] = await Promise.all([
        prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: target.id } } }),
        prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: target.id, blockedId: me.id } } })
      ]);
      const messages = blockedByMe || blockedMe ? [] : await prisma.directMessage.findMany({
        where: { OR: [{ senderId: me.id, recipientId: target.id }, { senderId: target.id, recipientId: me.id }] },
        orderBy: { createdAt: "asc" }, take: 100,
        include: { sender: { select: { id: true, firstName: true, username: true } } }
      });
      await prisma.directMessage.updateMany({ where: { senderId: target.id, recipientId: me.id, readAt: null }, data: { readAt: new Date() } });
      return NextResponse.json({ target, messages, blockedByMe: !!blockedByMe, blockedMe: !!blockedMe });
    }

    const recent = await prisma.directMessage.findMany({
      where: { OR: [{ senderId: me.id }, { recipientId: me.id }] },
      include: {
        sender: { select: { id: true, username: true, firstName: true, photoUrl: true } },
        recipient: { select: { id: true, username: true, firstName: true, photoUrl: true } }
      },
      orderBy: { createdAt: "desc" }, take: 150
    });
    const map = new Map<string, { user: any; lastMessage: any; unread: number }>();
    for (const message of recent) {
      const other = message.senderId === me.id ? message.recipient : message.sender;
      const current = map.get(other.id);
      if (!current) map.set(other.id, { user: other, lastMessage: message, unread: 0 });
    }
    const ids = [...map.keys()];
    if (ids.length) {
      const unread = await prisma.directMessage.groupBy({
        by: ["senderId"], where: { recipientId: me.id, senderId: { in: ids }, readAt: null }, _count: { id: true }
      });
      for (const row of unread) { const item = map.get(row.senderId); if (item) item.unread = row._count.id; }
    }
    return NextResponse.json({ conversations: [...map.values()] });
  } catch (error) {
    console.error("Messages GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить сообщения" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const me = await getUser(String(body.initData || ""));
    if (!me) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const action = String(body.action || "");

    if (action === "send") {
      const recipientId = String(body.recipientId || "");
      const content = String(body.content || "").trim();
      if (!recipientId || recipientId === me.id || !content || content.length > 1000) return NextResponse.json({ error: "Сообщение должно содержать от 1 до 1000 символов" }, { status: 400 });
      const recipient = await prisma.user.findFirst({ where: { id: recipientId, isBanned: false }, select: { id: true } });
      if (!recipient) return NextResponse.json({ error: "Получатель не найден" }, { status: 404 });
      const blocked = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: me.id, blockedId: recipientId }, { blockerId: recipientId, blockedId: me.id }] } });
      if (blocked) return NextResponse.json({ error: "Переписка недоступна: один из пользователей ограничил сообщения" }, { status: 403 });
      const since = new Date(Date.now() - 60_000);
      const sent = await prisma.directMessage.count({ where: { senderId: me.id, createdAt: { gte: since } } });
      if (sent >= 12) return NextResponse.json({ error: "Слишком много сообщений. Подожди минуту." }, { status: 429 });
      const message = await prisma.directMessage.create({ data: { senderId: me.id, recipientId, content }, include: { sender: { select: { id: true, firstName: true, username: true } } } });
      return NextResponse.json({ success: true, message });
    }

    if (action === "block" || action === "unblock") {
      const targetId = String(body.targetId || "");
      if (!targetId || targetId === me.id) return NextResponse.json({ error: "Некорректный пользователь" }, { status: 400 });
      if (action === "block") {
        await prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: targetId } }, create: { blockerId: me.id, blockedId: targetId }, update: {} });
      } else {
        await prisma.userBlock.deleteMany({ where: { blockerId: me.id, blockedId: targetId } });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "report") {
      const messageId = String(body.messageId || "");
      const reason = String(body.reason || "").trim().slice(0, 200);
      const message = await prisma.directMessage.findFirst({ where: { id: messageId, recipientId: me.id } });
      if (!message || reason.length < 5) return NextResponse.json({ error: "Укажи сообщение и причину жалобы (от 5 символов)" }, { status: 400 });
      await prisma.messageReport.create({ data: { reporterId: me.id, messageId, reason } });
      return NextResponse.json({ success: true, message: "Жалоба отправлена администрации" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Messages POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
