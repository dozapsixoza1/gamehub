import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

// Получить товары
export async function GET(req: NextRequest) {
  try {
    const gameId = req.nextUrl.searchParams.get("gameId") || undefined;
    const category = req.nextUrl.searchParams.get("category") || undefined;

    const items = await prisma.shopItem.findMany({
      where: {
        isActive: true,
        ...(gameId ? { gameId } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Shop GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Купить товар
export async function POST(req: NextRequest) {
  try {
    const { initData, itemId, currency } = await req.json();

    if (!initData || !itemId || !currency) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    if (currency !== "coins" && currency !== "gems") {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    const botToken = process.env.BOT_TOKEN!;
    const { valid, user: tgUser } = validateTelegramWebAppData(initData, botToken);

    if (!valid || !tgUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item || !item.isActive) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const price = currency === "coins" ? item.priceCoins : item.priceGems;

    if (price <= 0) {
      return NextResponse.json({ error: "Item not available for this currency" }, { status: 400 });
    }

    const balance = currency === "coins" ? user.coins : user.gems;
    if (balance < price) {
      return NextResponse.json({
        success: false,
        message: "Недостаточно средств",
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          [currency]: { decrement: price },
        },
      }),
      prisma.purchase.create({
        data: {
          userId: user.id,
          itemId: item.id,
          pricePaid: price,
          currency,
        },
      }),
      prisma.userItem.upsert({
        where: {
          userId_itemId: { userId: user.id, itemId: item.id },
        },
        create: {
          userId: user.id,
          itemId: item.id,
          quantity: 1,
        },
        update: {
          quantity: { increment: 1 },
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { coins: true, gems: true },
    });

    return NextResponse.json({
      success: true,
      message: "Покупка успешна!",
      coins: updatedUser?.coins,
      gems: updatedUser?.gems,
    });
  } catch (error) {
    console.error("Shop POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
