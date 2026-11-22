import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEM_PACKS: Record<number, { stars: number; title: string }> = {
  100: { stars: 50, title: "100 гемов GameHub" },
  250: { stars: 100, title: "250 гемов GameHub" },
  600: { stars: 200, title: "600 гемов GameHub" },
  1500: { stars: 450, title: "1500 гемов GameHub" },
  4000: { stars: 1000, title: "4000 гемов GameHub" },
};

export async function POST(req: NextRequest) {
  let orderId: string | null = null;
  try {
    const body = await req.json();
    const token = process.env.BOT_TOKEN;
    if (!token) return NextResponse.json({ error: "Платежи временно не настроены на сервере" }, { status: 503 });
    const auth = validateTelegramWebAppData(String(body.initData || ""), token);
    if (!auth.valid || !auth.user) return NextResponse.json({ error: "Сессия Telegram недействительна. Перезапусти приложение." }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) } });
    if (!user || user.isBanned) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    const gems = Number(body.gems);
    const pack = GEM_PACKS[gems];
    if (!pack) return NextResponse.json({ error: "Неизвестный набор" }, { status: 400 });

    const payload = `gh_${randomUUID().replace(/-/g, "")}`;
    const order = await prisma.starOrder.create({
      data: { userId: user.id, payload, productType: "GEM_PACK", gems, stars: pack.stars },
    });
    orderId = order.id;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: pack.title,
        description: "Цифровой набор гемов для GameHub",
        payload,
        currency: "XTR",
        prices: [{ label: pack.title, amount: pack.stars }],
      }),
      cache: "no-store",
    });
    const result = await telegramResponse.json() as { ok?: boolean; result?: string; description?: string };
    if (!telegramResponse.ok || !result.ok || !result.result) {
      await prisma.starOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return NextResponse.json({ error: "Telegram не смог создать платёжную ссылку. Попробуй позже." }, { status: 502 });
    }

    return NextResponse.json({ success: true, invoiceLink: result.result, stars: pack.stars, gems });
  } catch (error) {
    if (orderId) await prisma.starOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "FAILED" } }).catch(() => {});
    console.error("Stars invoice creation error:", error);
    return NextResponse.json({ error: "Не удалось создать платёж" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = process.env.BOT_TOKEN;
    const initData = req.headers.get("x-init-data") || "";
    if (!token) return NextResponse.json({ error: "Платежи не настроены" }, { status: 503 });
    const auth = validateTelegramWebAppData(initData, token);
    if (!auth.valid || !auth.user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) }, select: { id: true } });
    if (!user) return NextResponse.json({ orders: [] });
    const orders = await prisma.starOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, gems: true, stars: true, status: true, createdAt: true, paidAt: true },
    });
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Stars history error:", error);
    return NextResponse.json({ error: "Не удалось загрузить историю платежей" }, { status: 500 });
  }
}
