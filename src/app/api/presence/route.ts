import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const token = process.env.BOT_TOKEN;
    if (!token || typeof initData !== "string") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }
    const auth = validateTelegramWebAppData(initData, token);
    if (!auth.valid || !auth.user) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }
    const result = await prisma.user.updateMany({
      where: { telegramId: BigInt(auth.user.id), isBanned: false },
      data: { lastActiveAt: new Date() },
    });
    if (!result.count) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Presence heartbeat:", error);
    return NextResponse.json({ error: "Не удалось обновить статус" }, { status: 500 });
  }
}
