import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const { id } = await context.params;
    const clan = await prisma.clan.findFirst({
      where: { OR: [{ id }, { slug: id }, { tag: id.toUpperCase() }] },
      include: {
        owner: { select: { id:true, firstName:true, username:true } },
        members: { orderBy: [{ role:"asc" }, { joinedAt:"asc" }], include: { user: { select: { id:true, firstName:true, lastName:true, username:true, photoUrl:true, level:true, xp:true, settings: { select: { displayName:true, avatarUrl:true, nicknameColor:true } }, adminStaff: { select: { role:true } } } } } },
        _count: { select: { members:true } },
      },
    });
    if (!clan || (!clan.isPublic && !clan.members.some(m => m.userId === user.id))) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    const myMembership = clan.members.find(m => m.userId === user.id);
    return NextResponse.json({
      clan: { id:clan.id, name:clan.name, tag:clan.tag, slug:clan.slug, description:clan.description, avatarUrl:clan.avatarUrl, bannerUrl:clan.bannerUrl, createdAt:clan.createdAt, memberCount:clan._count.members, owner:clan.owner,
        members:clan.members.map(m => ({ id:m.user.id, role:m.role, joinedAt:m.joinedAt, name:m.user.settings?.displayName || [m.user.firstName,m.user.lastName].filter(Boolean).join(" ") || m.user.username || "Игрок", username:m.user.username, avatar:m.user.settings?.avatarUrl || m.user.photoUrl, level:m.user.level, staffRole:m.user.adminStaff?.role || null, nicknameColor:m.user.settings?.nicknameColor || null })) },
      myRole: myMembership?.role || null,
    });
  } catch (error) {
    console.error("Clan profile GET", error);
    return NextResponse.json({ error: "Не удалось загрузить профиль клана" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    const clan = await prisma.clan.findUnique({ where: { id } });
    if (!clan || !clan.isPublic) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    const current = await prisma.clanMember.findFirst({ where: { userId:user.id } });
    if (body.action === "join") {
      if (current) return NextResponse.json({ error: "Ты уже состоишь в клане" }, { status: 409 });
      await prisma.clanMember.create({ data: { clanId:clan.id, userId:user.id, role:"MEMBER" } });
      return NextResponse.json({ success:true, message:"Ты вступил в клан" });
    }
    if (body.action === "leave") {
      if (!current || current.clanId !== clan.id) return NextResponse.json({ error:"Ты не состоишь в этом клане" }, { status:400 });
      if (current.role === "LEADER" || clan.ownerId === user.id) return NextResponse.json({ error:"Передай лидерство перед выходом из клана" }, { status:400 });
      await prisma.clanMember.delete({ where: { id:current.id } });
      return NextResponse.json({ success:true });
    }
    return NextResponse.json({ error:"Неизвестное действие" }, { status:400 });
  } catch (error) {
    console.error("Clan action", error);
    return NextResponse.json({ error:"Не удалось выполнить действие" }, { status:500 });
  }
}
