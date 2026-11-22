import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

// Каталог открыт для просмотра, инвентарь показываем только после проверки Telegram initData.
export async function GET(req: NextRequest) {
  try {
    const gameId = req.nextUrl.searchParams.get("gameId") || undefined;
    const category = req.nextUrl.searchParams.get("category") || undefined;
    const items = await prisma.shopItem.findMany({
      where: { isActive: true, ...(gameId ? { gameId } : {}), ...(category ? { category } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    let ownedItemIds: string[] = [];
    let equipped: Record<string, string | null> = {};
    const initData = req.headers.get("x-init-data") || "";
    const token = process.env.BOT_TOKEN;
    if (initData && token) {
      const auth = validateTelegramWebAppData(initData, token);
      if (auth.valid && auth.user) {
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) }, select: { id: true } });
        if (user) {
          const owned = await prisma.userItem.findMany({ where: { userId: user.id }, select: { itemId: true } });
          ownedItemIds = owned.map((entry) => entry.itemId);
          const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
          if (settings) equipped = { frame: settings.profileFrame, nicknameColor: settings.nicknameColor, badge: settings.profileBadge, background: settings.profileBackground, animation: settings.avatarAnimation, effect: settings.profileEffect, title: settings.profileTitle };
        }
      }
    }
    return NextResponse.json({ items, ownedItemIds, equipped }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Shop GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const initData = String(body.initData || "");
    const itemId = String(body.itemId || "");
    const action = String(body.action || "buy");
    const currency = body.currency;
    if (!initData || !itemId) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const token = process.env.BOT_TOKEN;
    if (!token) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    const auth = validateTelegramWebAppData(initData, token);
    if (!auth.valid || !auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) } });
    if (!user || user.isBanned) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (action === "equip" || action === "unequip") {
      if (item.category !== "cosmetics") return NextResponse.json({ error: "Этот предмет нельзя экипировать" }, { status: 400 });
      const owned = await prisma.userItem.findUnique({ where: { userId_itemId: { userId: user.id, itemId } } });
      if (!owned) return NextResponse.json({ error: "Сначала приобрети предмет" }, { status: 403 });
      const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as { cosmeticType?: string; cosmeticValue?: string } : {};
      const value = action === "unequip" ? null : String(metadata.cosmeticValue || "");
      if (action === "equip" && !value) return NextResponse.json({ error: "У предмета не настроен эффект" }, { status: 400 });
      const cosmeticType = metadata.cosmeticType;
      if (cosmeticType === "frame") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, profileFrame: value }, update: { profileFrame: value } });
      } else if (cosmeticType === "nicknameColor") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, nicknameColor: value }, update: { nicknameColor: value } });
      } else if (cosmeticType === "badge") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, profileBadge: value }, update: { profileBadge: value } });
      } else if (cosmeticType === "background") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, profileBackground: value }, update: { profileBackground: value } });
      } else if (cosmeticType === "animation") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, avatarAnimation: value }, update: { avatarAnimation: value } });
      } else if (cosmeticType === "effect") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, profileEffect: value }, update: { profileEffect: value } });
      } else if (cosmeticType === "title") {
        await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, profileTitle: value }, update: { profileTitle: value } });
      } else {
        return NextResponse.json({ error: "Неизвестный тип косметики" }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: action === "unequip" ? "Предмет снят" : "Предмет экипирован" });
    }

    if (action !== "buy" || (currency !== "coins" && currency !== "gems")) {
      return NextResponse.json({ error: "Invalid purchase data" }, { status: 400 });
    }
    const price = currency === "coins" ? item.priceCoins : item.priceGems;
    if (price <= 0) return NextResponse.json({ error: "Item not available for this currency" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // Условное списание в транзакции не позволяет потратить один баланс дважды при параллельных запросах.
      const debit = currency === "coins"
        ? await tx.user.updateMany({ where: { id: user.id, coins: { gte: price } }, data: { coins: { decrement: price } } })
        : await tx.user.updateMany({ where: { id: user.id, gems: { gte: price } }, data: { gems: { decrement: price } } });
      if (!debit.count) throw new Error("INSUFFICIENT_BALANCE");
      await tx.purchase.create({ data: { userId: user.id, itemId: item.id, pricePaid: price, currency } });
      await tx.userItem.upsert({
        where: { userId_itemId: { userId: user.id, itemId: item.id } },
        create: { userId: user.id, itemId: item.id, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { coins: true, gems: true } });
    return NextResponse.json({ success: true, message: "Покупка успешна!", coins: updatedUser?.coins, gems: updatedUser?.gems });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ success: false, message: "Недостаточно средств" }, { status: 409 });
    }
    console.error("Shop POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
