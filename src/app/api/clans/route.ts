import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

async function getUser(req: NextRequest) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const result = validateTelegramWebAppData(req.headers.get("x-init-data") || "", token);
  if (!result.valid || !result.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(result.user.id) } });
  return user && !user.isBanned ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const [clans, membership] = await Promise.all([
      prisma.clan.findMany({
        where: { isPublic: true },
        orderBy: [{ members: { _count: "desc" } }, { createdAt: "desc" }],
        take: 60,
        include: { _count: { select: { members: true } }, owner: { select: { id: true, firstName: true, username: true } } },
      }),
      prisma.clanMember.findFirst({ where: { userId: user.id }, include: { clan: { select: { id: true, name: true, tag: true, avatarUrl: true } } } }),
    ]);
    return NextResponse.json({
      clans: clans.map(c => ({ id:c.id, name:c.name, tag:c.tag, description:c.description, avatarUrl:c.avatarUrl, bannerUrl:c.bannerUrl, memberCount:c._count.members, owner:c.owner })),
      myClan: membership ? { ...membership.clan, role: membership.role } : null,
    });
  } catch (error) {
    console.error("Clans GET", error);
    return NextResponse.json({ error: "Не удалось загрузить кланы" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 32);
    const tag = String(body.tag || "").trim().toUpperCase();
    const description = String(body.description || "").trim().slice(0, 240);
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.slice(0, 600) : null;
    if (name.length < 3) return NextResponse.json({ error: "Название должно содержать минимум 3 символа" }, { status: 400 });
    if (!/^[A-ZА-ЯЁ0-9]{3,5}$/.test(tag)) return NextResponse.json({ error: "Тег должен содержать от 3 до 5 букв или цифр" }, { status: 400 });
    const existingMembership = await prisma.clanMember.findFirst({ where: { userId: user.id } });
    if (existingMembership) return NextResponse.json({ error: "Ты уже состоишь в клане" }, { status: 409 });
    const existingTag = await prisma.clan.findUnique({ where: { tag } });
    if (existingTag) return NextResponse.json({ error: "Этот тег уже занят" }, { status: 409 });
    const slug = randomUUID().replace(/-/g, "").slice(0, 20);
    const clan = await prisma.clan.create({
      data: { name, slug, tag, description: description || null, avatarUrl, ownerId: user.id, members: { create: { userId: user.id, role: "LEADER" } } },
      include: { _count: { select: { members: true } } },
    });
    return NextResponse.json({ success: true, clan: { id:clan.id, name:clan.name, tag:clan.tag, avatarUrl:clan.avatarUrl, memberCount:clan._count.members } }, { status: 201 });
  } catch (error) {
    console.error("Clans POST", error);
    return NextResponse.json({ error: "Не удалось создать клан" }, { status: 500 });
  }
}
