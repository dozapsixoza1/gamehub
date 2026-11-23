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
        applications: { where: { status:"PENDING" }, include: { user: { select: { id:true, firstName:true, username:true, photoUrl:true, level:true } } }, orderBy: { createdAt:"asc" } },
        trophies: { orderBy: { awardedAt:"desc" }, take: 20 },
        actionLogs: { orderBy: { createdAt:"desc" }, take: 30 },
      },
    });
    if (!clan || (!clan.isPublic && !clan.members.some(m => m.userId === user.id))) return NextResponse.json({ error: "Клан не найден" }, { status: 404 });
    const myMembership = clan.members.find(m => m.userId === user.id);
    return NextResponse.json({
      clan: { id:clan.id, name:clan.name, tag:clan.tag, slug:clan.slug, description:clan.description, avatarUrl:clan.avatarUrl, bannerUrl:clan.bannerUrl, announcement:clan.announcement, level:clan.level, xp:clan.xp, tagColor:clan.tagColor, createdAt:clan.createdAt, memberCount:clan._count.members, owner:clan.owner, trophies:clan.trophies, actionLogs:clan.actionLogs, applications:myMembership && ["LEADER","DEPUTY","OFFICER"].includes(myMembership.role) ? clan.applications.map(a=>({id:a.id,userId:a.userId,name:a.user.firstName||a.user.username||"Игрок",level:a.user.level,createdAt:a.createdAt})) : [],
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
    const log = async (action:string, details?:string) => prisma.clanActionLog.create({data:{clanId:clan.id,actorId:user.id,action,details}});
    const myRole = current?.clanId===clan.id ? current.role : null;
    const canManage = myRole==="LEADER" || myRole==="DEPUTY";
    if (body.action === "request") {
      if (current) return NextResponse.json({error:"Ты уже состоишь в клане"}, {status:409});
      if (!clan.isPublic) return NextResponse.json({error:"Клан закрытый — нужна ссылка-приглашение"}, {status:403});
      const application=await prisma.clanApplication.upsert({where:{clanId_userId:{clanId:clan.id,userId:user.id}},create:{clanId:clan.id,userId:user.id},update:{status:"PENDING"}});
      await log("APPLICATION_SENT");
      return NextResponse.json({success:true,applicationId:application.id});
    }
    if (body.action === "application") {
      if (!canManage) return NextResponse.json({error:"Недостаточно прав"}, {status:403});
      const application=await prisma.clanApplication.findFirst({where:{id:String(body.applicationId||""),clanId:clan.id,status:"PENDING"}});
      if (!application) return NextResponse.json({error:"Заявка не найдена"}, {status:404});
      if (body.decision==="accept") {
        const existing=await prisma.clanMember.findFirst({where:{userId:application.userId}});
        if (existing) return NextResponse.json({error:"Игрок уже состоит в другом клане"}, {status:409});
        await prisma.$transaction([
          prisma.clanMember.create({data:{clanId:clan.id,userId:application.userId,role:"MEMBER"}}),
          prisma.clanApplication.update({where:{id:application.id},data:{status:"ACCEPTED"}})
        ]);
        await log("APPLICATION_ACCEPTED",application.userId);
      } else {
        await prisma.clanApplication.update({where:{id:application.id},data:{status:"REJECTED"}});
        await log("APPLICATION_REJECTED",application.userId);
      }
      return NextResponse.json({success:true});
    }
    if (body.action === "announcement") {
      if (!canManage) return NextResponse.json({error:"Недостаточно прав"}, {status:403});
      const announcement=String(body.text||"").trim().slice(0,500);
      await prisma.clan.update({where:{id:clan.id},data:{announcement:announcement||null}});
      await log("ANNOUNCEMENT_UPDATED");
      return NextResponse.json({success:true});
    }
    if (body.action === "promote") {
      if (myRole!=="LEADER") return NextResponse.json({error:"Только лидер может менять должности"}, {status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if (!target || target.userId===user.id) return NextResponse.json({error:"Участник не найден"}, {status:404});
      const role=String(body.role||"MEMBER");
      if (!["DEPUTY","OFFICER","MEMBER"].includes(role)) return NextResponse.json({error:"Недопустимая должность"}, {status:400});
      await prisma.clanMember.update({where:{id:target.id},data:{role}});
      await log("ROLE_CHANGED",target.userId+":"+role);
      return NextResponse.json({success:true});
    }
    if (body.action === "kick") {
      if (!canManage) return NextResponse.json({error:"Недостаточно прав"}, {status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if (!target || target.userId===clan.ownerId || (target.role==="DEPUTY" && myRole!=="LEADER")) return NextResponse.json({error:"Нельзя исключить этого участника"}, {status:403});
      await prisma.clanMember.delete({where:{id:target.id}});
      await log("MEMBER_KICKED",target.userId);
      return NextResponse.json({success:true});
    }
    if (body.action === "transfer") {
      if (myRole!=="LEADER") return NextResponse.json({error:"Только лидер может передать клан"}, {status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if (!target) return NextResponse.json({error:"Новый лидер должен состоять в клане"}, {status:400});
      await prisma.$transaction([
        prisma.clan.update({where:{id:clan.id},data:{ownerId:target.userId}}),
        prisma.clanMember.update({where:{id:current!.id},data:{role:"DEPUTY"}}),
        prisma.clanMember.update({where:{id:target.id},data:{role:"LEADER"}})
      ]);
      await log("LEADERSHIP_TRANSFERRED",target.userId);
      return NextResponse.json({success:true});
    }
    if (body.action === "invite") {
      if (!canManage) return NextResponse.json({error:"Недостаточно прав"}, {status:403});
      const {randomBytes}=await import("crypto");
      const inviteCode=clan.inviteCode||randomBytes(9).toString("hex");
      await prisma.clan.update({where:{id:clan.id},data:{inviteCode,isPublic:false}});
      await log("INVITE_LINK_CREATED");
      return NextResponse.json({success:true,inviteCode});
    }
    if (body.action === "joinInvite") {
      const inviteCode=String(body.inviteCode||"");
      const invited=await prisma.clan.findFirst({where:{id:clan.id,inviteCode}});
      if (!invited) return NextResponse.json({error:"Приглашение недействительно"}, {status:404});
      if (current) return NextResponse.json({error:"Ты уже состоишь в клане"}, {status:409});
      await prisma.clanMember.create({data:{clanId:clan.id,userId:user.id,role:"MEMBER"}});
      await log("INVITE_JOIN");
      return NextResponse.json({success:true});
    }
    if (body.action === "join") {
      if (!clan.isPublic) return NextResponse.json({ error:"Клан закрытый" }, { status:403 });
      if (current) return NextResponse.json({ error: "Ты уже состоишь в клане" }, { status: 409 });
      await prisma.clanMember.create({ data: { clanId:clan.id, userId:user.id, role:"MEMBER" } });
      await log("MEMBER_JOINED");
      return NextResponse.json({ success:true, message:"Ты вступил в клан" });
    }

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
