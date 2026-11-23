import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const token = process.env.BOT_TOKEN;
    const initData = req.headers.get("x-init-data") || "";
    const auth = token ? validateTelegramWebAppData(initData, token) : null;
    if (!auth?.valid || !auth.user) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }

    const { id } = await context.params;
    const player = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, firstName: true, lastName: true, photoUrl: true,
        xp: true, level: true, gamesPlayed: true, gamesWon: true, isAdmin: true,
        isVerified: true, createdAt: true, lastActiveAt: true,
        adminStaff: { select: { role: true } },
        clanMemberships: {
          take: 1,
          include: { clan: { select: { id: true, tag: true, name: true } } },
        },
        settings: {
          select: {
            displayName: true, avatarUrl: true, profileFrame: true,
            avatarAnimation: true, profileEffect: true, nicknameColor: true,
            profileBadge: true, profileBackground: true, profileTitle: true,
            profileBio: true, profileShowcase: true,
          },
        },
        achievements: {
          take: 20,
          orderBy: { unlockedAt: "desc" },
          include: { achievement: true },
        },
        nftOwnerships: {
          include: { gift: true },
          orderBy: { acquiredAt: "desc" },
          take: 12,
        },
      },
    });

    if (!player) return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });

    const clan = player.clanMemberships[0]?.clan || null;
    const achievements = player.achievements.map((entry) => ({
      id: entry.id,
      unlockedAt: entry.unlockedAt,
      achievement: entry.achievement,
    }));
    const nfts = player.nftOwnerships.map((n) => ({
      id: n.id,
      serialNumber: n.serialNumber,
      acquiredAt: n.acquiredAt,
      gift: {
        id: n.gift.id,
        name: n.gift.name,
        rarity: n.gift.rarity,
        imageUrl: n.gift.imageUrl,
      },
    }));

    return NextResponse.json({
      player: {
        id: player.id,
        username: player.username,
        displayName: player.settings?.displayName ||
          [player.firstName, player.lastName].filter(Boolean).join(" ") ||
          player.username || "Игрок",
        avatar: player.settings?.avatarUrl || player.photoUrl,
        profileFrame: player.settings?.profileFrame || null,
        avatarAnimation: player.settings?.avatarAnimation || null,
        profileEffect: player.settings?.profileEffect || null,
        nicknameColor: player.settings?.nicknameColor || null,
        profileBadge: player.settings?.profileBadge || null,
        profileBackground: player.settings?.profileBackground || null,
        profileTitle: player.settings?.profileTitle || null,
        profileBio: player.settings?.profileBio || null,
        profileShowcase: player.settings?.profileShowcase || [],
        xp: player.xp,
        level: player.level,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        winRate: player.gamesPlayed ? Math.round(player.gamesWon / player.gamesPlayed * 100) : 0,
        isAdmin: player.isAdmin,
        staffRole: player.adminStaff?.role || null,
        clan,
        isVerified: player.isVerified,
        createdAt: player.createdAt,
        isOnline: Date.now() - player.lastActiveAt.getTime() < 90_000,
        achievements,
        nftOwnerships: nfts,
        nfts,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Player profile:", error);
    return NextResponse.json({ error: "Не удалось загрузить профиль" }, { status: 500 });
  }
}
