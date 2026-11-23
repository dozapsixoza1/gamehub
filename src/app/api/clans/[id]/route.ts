import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

async function getUser(req: NextRequest) {
  const token=process.env.BOT_TOKEN;
  if(!token)return null;
  const result=validateTelegramWebAppData(req.headers.get("x-init-data")||"",token);
  if(!result.valid||!result.user)return null;
  const user=await prisma.user.findUnique({where:{telegramId:BigInt(result.user.id)}});
  return user&&!user.isBanned?user:null;
}
async function addClanXp(clanId:string,amount:number) {
  const clan=await prisma.clan.findUnique({where:{id:clanId},select:{xp:true,level:true}});
  if(!clan)return;
  let xp=clan.xp+amount,level=clan.level;
  while(xp>=level*100){xp-=level*100;level++;}
  await prisma.clan.update({where:{id:clanId},data:{xp,level}});
}
export async function GET(req:NextRequest,context:{params:Promise<{id:string}>}) {
  try{
    const user=await getUser(req);if(!user)return NextResponse.json({error:"Нет доступа"},{status:401});
    const {id}=await context.params;
    const clan=await prisma.clan.findFirst({where:{OR:[{id},{slug:id},{tag:id.toUpperCase()}]},include:{
      owner:{select:{id:true,firstName:true,username:true}},
      members:{orderBy:[{role:"asc"},{joinedAt:"asc"}],include:{user:{select:{id:true,firstName:true,lastName:true,username:true,photoUrl:true,level:true,settings:{select:{displayName:true,avatarUrl:true,nicknameColor:true}}}}}},
      _count:{select:{members:true}},
      applications:{where:{status:"PENDING"},include:{user:{select:{id:true,firstName:true,username:true,level:true}}},orderBy:{createdAt:"asc"}},
      trophies:{orderBy:{awardedAt:"desc"},take:20},
      actionLogs:{orderBy:{createdAt:"desc"},take:20}
    }});
    if(!clan)return NextResponse.json({error:"Клан не найден"},{status:404});
    const membership=clan.members.find(m=>m.userId===user.id);
    const inviteQuery=req.nextUrl.searchParams.get("invite");
    if(!clan.isPublic&&!membership&&(!inviteQuery||inviteQuery!==clan.inviteCode))return NextResponse.json({error:"Клан не найден"},{status:404});
    const manager=!!membership&&["LEADER","DEPUTY","OFFICER"].includes(membership.role);
    return NextResponse.json({clan:{
      id:clan.id,name:clan.name,tag:clan.tag,slug:clan.slug,description:clan.description,avatarUrl:clan.avatarUrl,bannerUrl:clan.bannerUrl,
      announcement:clan.announcement,isPublic:clan.isPublic,level:clan.level,xp:clan.xp,tagColor:clan.tagColor,inviteCode:manager?clan.inviteCode:null,
      createdAt:clan.createdAt,memberCount:clan._count.members,owner:clan.owner,trophies:clan.trophies,actionLogs:manager?clan.actionLogs:[],
      applications:manager?clan.applications.map(a=>({id:a.id,userId:a.userId,name:a.user.firstName||a.user.username||"Игрок",level:a.user.level,createdAt:a.createdAt})):[],
      members:clan.members.map(m=>({id:m.user.id,role:m.role,joinedAt:m.joinedAt,name:m.user.settings?.displayName||[m.user.firstName,m.user.lastName].filter(Boolean).join(" ")||m.user.username||"Игрок",username:m.user.username,avatar:m.user.settings?.avatarUrl||m.user.photoUrl,level:m.user.level,nicknameColor:m.user.settings?.nicknameColor||null}))
    },myRole:membership?.role||null});
  }catch(error){console.error("Clan profile GET",error);return NextResponse.json({error:"Не удалось загрузить профиль клана"},{status:500});}
}
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}) {
  try{
    const user=await getUser(req);if(!user)return NextResponse.json({error:"Нет доступа"},{status:401});
    const {id}=await context.params,body=await req.json();
    const clan=await prisma.clan.findFirst({where:{OR:[{id},{slug:id},{tag:id.toUpperCase()}]}});
    if(!clan)return NextResponse.json({error:"Клан не найден"},{status:404});
    const current=await prisma.clanMember.findFirst({where:{userId:user.id}});
    const role=current?.clanId===clan.id?current.role:null;
    const leader=role==="LEADER",manager=leader||role==="DEPUTY",staff=manager||role==="OFFICER";
    const log=(action:string,details?:string)=>prisma.clanActionLog.create({data:{clanId:clan.id,actorId:user.id,action,details}});
    const action=String(body.action||"");
    if(action==="request"){
      if(current)return NextResponse.json({error:"Ты уже состоишь в клане"},{status:409});
      if(!clan.isPublic)return NextResponse.json({error:"Клан закрытый — нужна ссылка-приглашение"},{status:403});
      const application=await prisma.clanApplication.upsert({where:{clanId_userId:{clanId:clan.id,userId:user.id}},create:{clanId:clan.id,userId:user.id},update:{status:"PENDING"}});
      await log("APPLICATION_SENT");return NextResponse.json({success:true,applicationId:application.id});
    }
    if(action==="join"){
      if(!clan.isPublic)return NextResponse.json({error:"Клан закрытый"},{status:403});
      if(current)return NextResponse.json({error:"Ты уже состоишь в клане"},{status:409});
      await prisma.clanMember.create({data:{clanId:clan.id,userId:user.id,role:"MEMBER"}});
      await addClanXp(clan.id,10);await log("MEMBER_JOINED");return NextResponse.json({success:true});
    }
    if(action==="joinInvite"){
      const code=String(body.inviteCode||"");
      if(!code||clan.inviteCode!==code)return NextResponse.json({error:"Приглашение недействительно"},{status:404});
      if(current)return NextResponse.json({error:"Ты уже состоишь в клане"},{status:409});
      await prisma.clanMember.create({data:{clanId:clan.id,userId:user.id,role:"MEMBER"}});
      await addClanXp(clan.id,10);await log("INVITE_JOIN");return NextResponse.json({success:true});
    }
    if(action==="leave"){
      if(!current||current.clanId!==clan.id)return NextResponse.json({error:"Ты не состоишь в этом клане"},{status:400});
      if(leader||clan.ownerId===user.id)return NextResponse.json({error:"Передай лидерство перед выходом из клана"},{status:400});
      await prisma.clanMember.delete({where:{id:current.id}});await log("MEMBER_LEFT");return NextResponse.json({success:true});
    }
    if(action==="application"){
      if(!staff)return NextResponse.json({error:"Недостаточно прав"},{status:403});
      const application=await prisma.clanApplication.findFirst({where:{id:String(body.applicationId||""),clanId:clan.id,status:"PENDING"}});
      if(!application)return NextResponse.json({error:"Заявка не найдена"},{status:404});
      if(body.decision==="accept"){
        const existing=await prisma.clanMember.findFirst({where:{userId:application.userId}});
        if(existing)return NextResponse.json({error:"Игрок уже состоит в другом клане"},{status:409});
        await prisma.$transaction([prisma.clanMember.create({data:{clanId:clan.id,userId:application.userId,role:"MEMBER"}}),prisma.clanApplication.update({where:{id:application.id},data:{status:"ACCEPTED"}})]);
        await addClanXp(clan.id,10);await log("APPLICATION_ACCEPTED",application.userId);
      }else{await prisma.clanApplication.update({where:{id:application.id},data:{status:"REJECTED"}});await log("APPLICATION_REJECTED",application.userId);}
      return NextResponse.json({success:true});
    }
    if(action==="announcement"){
      if(!manager)return NextResponse.json({error:"Недостаточно прав"},{status:403});
      await prisma.clan.update({where:{id:clan.id},data:{announcement:String(body.text||"").trim().slice(0,500)||null}});
      await log("ANNOUNCEMENT_UPDATED");return NextResponse.json({success:true});
    }
    if(action==="settings"){
      if(!leader)return NextResponse.json({error:"Только лидер может менять оформление"},{status:403});
      const tagColor=String(body.tagColor||clan.tagColor);
      if(!/^#[0-9a-fA-F]{6}$/.test(tagColor))return NextResponse.json({error:"Некорректный цвет"},{status:400});
      const description=typeof body.description==="string"?body.description.trim().slice(0,240):clan.description;
      await prisma.clan.update({where:{id:clan.id},data:{tagColor,description}});
      await log("CLAN_SETTINGS_UPDATED");return NextResponse.json({success:true});
    }
    if(action==="promote"){
      if(!leader)return NextResponse.json({error:"Только лидер может менять должности"},{status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if(!target||target.userId===user.id)return NextResponse.json({error:"Участник не найден"},{status:404});
      const nextRole=String(body.role||"MEMBER");
      if(!["DEPUTY","OFFICER","MEMBER"].includes(nextRole))return NextResponse.json({error:"Недопустимая должность"},{status:400});
      await prisma.clanMember.update({where:{id:target.id},data:{role:nextRole}});await log("ROLE_CHANGED",target.userId+":"+nextRole);
      return NextResponse.json({success:true});
    }
    if(action==="kick"){
      if(!manager)return NextResponse.json({error:"Недостаточно прав"},{status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if(!target||target.userId===clan.ownerId||(target.role==="DEPUTY"&&!leader)||target.userId===user.id)return NextResponse.json({error:"Нельзя исключить этого участника"},{status:403});
      await prisma.clanMember.delete({where:{id:target.id}});await log("MEMBER_KICKED",target.userId);return NextResponse.json({success:true});
    }
    if(action==="transfer"){
      if(!leader)return NextResponse.json({error:"Только лидер может передать клан"},{status:403});
      const target=await prisma.clanMember.findFirst({where:{clanId:clan.id,userId:String(body.userId||"")}});
      if(!target||target.userId===user.id)return NextResponse.json({error:"Выбери другого участника"},{status:400});
      await prisma.$transaction([prisma.clan.update({where:{id:clan.id},data:{ownerId:target.userId}}),prisma.clanMember.update({where:{id:current!.id},data:{role:"DEPUTY"}}),prisma.clanMember.update({where:{id:target.id},data:{role:"LEADER"}})]);
      await log("LEADERSHIP_TRANSFERRED",target.userId);return NextResponse.json({success:true});
    }
    if(action==="invite"){
      if(!manager)return NextResponse.json({error:"Недостаточно прав"},{status:403});
      const inviteCode=clan.inviteCode||randomBytes(9).toString("hex");
      await prisma.clan.update({where:{id:clan.id},data:{inviteCode,isPublic:false}});
      await log("INVITE_LINK_CREATED");return NextResponse.json({success:true,inviteCode});
    }
    if(action==="togglePublic"){
      if(!leader)return NextResponse.json({error:"Только лидер может менять доступ"},{status:403});
      await prisma.clan.update({where:{id:clan.id},data:{isPublic:!clan.isPublic,inviteCode:clan.isPublic?clan.inviteCode:null}});
      await log("VISIBILITY_CHANGED",String(!clan.isPublic));return NextResponse.json({success:true,isPublic:!clan.isPublic});
    }
    if(action==="trophy"){
      if(!leader)return NextResponse.json({error:"Только лидер может добавлять награды"},{status:403});
      const title=String(body.title||"").trim().slice(0,60);
      if(!title)return NextResponse.json({error:"Укажи название награды"},{status:400});
      await prisma.clanTrophy.create({data:{clanId:clan.id,title,description:String(body.description||"").trim().slice(0,160)||null,icon:String(body.icon||"🏆").slice(0,8)}});
      await addClanXp(clan.id,25);await log("TROPHY_AWARDED",title);return NextResponse.json({success:true});
    }
    return NextResponse.json({error:"Неизвестное действие"},{status:400});
  }catch(error){console.error("Clan action",error);return NextResponse.json({error:"Не удалось выполнить действие"},{status:500});}
}