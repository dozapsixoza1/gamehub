import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
async function auth(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const checked = validateTelegramWebAppData(initData, token);
  if (!checked.valid || !checked.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(checked.user.id) } });
  return user && !user.isBanned ? user : null;
}
const professions = ["Врач","Инженер","Учитель","Повар","Спасатель","Программист","Агроном","Электрик","Ветеринар","Строитель","Учёный","Механик"];
const hobbies = ["Садоводство","Рыбалка","Первая помощь","Ремонт техники","Кулинария","Ориентирование","Психология","Выращивание растений","Радиосвязь","Столярное дело"];
const traits = ["Спокойный лидер","Отличная память","Умеет договариваться","Быстро учится","Хорошая физическая форма","Знает несколько языков","Практичный ум","Сильная стрессоустойчивость"];
const drawbacks = ["Боится темноты","Не переносит замкнутые пространства","Нуждается в очках","Сильно храпит","Не умеет плавать","Аллергия на пыльцу","Плохо переносит холод","Не любит высоту"];
function pick<T>(items:T[]) { return items[Math.floor(Math.random()*items.length)]; }
function card() { return { profession:pick(professions), age:18+Math.floor(Math.random()*48), health:pick(["Отличное","Хорошее","Среднее","Есть хроническое заболевание"]), hobby:pick(hobbies), trait:pick(traits), drawback:pick(drawbacks), baggage:pick(["Набор инструментов","Аптечка","Рация","Семена растений","Книги и карты","Запас консервов","Фильтр для воды","Набор для ремонта"]) }; }
const code = () => randomBytes(4).toString("hex").slice(0,6).toUpperCase();

export async function GET(req: NextRequest) {
  try {
    const user = await auth(req.headers.get("x-init-data") || "");
    if (!user) return error("Нет доступа",401);
    const roomId = req.nextUrl.searchParams.get("roomId");
    if (!roomId) return error("Не указана комната");
    const room = await prisma.bunkerRoom.findUnique({ where:{id:roomId}, include:{players:{include:{user:{select:{id:true,firstName:true,username:true,photoUrl:true}}},orderBy:{joinedAt:"asc"}}} });
    if (!room) return error("Комната не найдена",404);
    const me = room.players.find(p=>p.userId===user.id);
    if (!me) return error("Ты не участник этой комнаты",403);
    return NextResponse.json({ room:{id:room.id,code:room.code,status:room.status,round:room.round,maxPlayers:room.maxPlayers,players:room.players.map(p=>({id:p.id,userId:p.userId,name:p.user.firstName||p.user.username||"Игрок",photo:p.user.photoUrl,isHost:p.isHost,eliminated:room.eliminated.includes(p.id),character:room.status!=="WAITING"&&p.id===me.id?p.character:null,voted:Boolean(p.voteTarget)})),myPlayerId:me.id,myCharacter:me.character,eliminated:room.eliminated} });
  } catch(e) { console.error("Bunker GET",e); return error("Не удалось загрузить комнату",500); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await auth(String(body.initData||""));
    if (!user) return error("Нет доступа",401);
    const action = String(body.action||"");
    if (action==="create") {
      let roomCode=code();
      while(await prisma.bunkerRoom.findUnique({where:{code:roomCode}})) roomCode=code();
      const room=await prisma.bunkerRoom.create({data:{code:roomCode,hostId:user.id,players:{create:{userId:user.id,isHost:true}}}});
      return NextResponse.json({roomId:room.id,code:room.code});
    }
    const roomId=String(body.roomId||"");
    const room=await prisma.bunkerRoom.findUnique({where:{id:roomId},include:{players:true}});
    if (!room) return error("Комната не найдена",404);
    const me=room.players.find(p=>p.userId===user.id);
    if (action==="join") {
      if (room.status!=="WAITING") return error("Игра уже началась");
      if (me) return NextResponse.json({roomId:room.id});
      if (room.players.length>=room.maxPlayers) return error("Комната заполнена");
      await prisma.bunkerPlayer.create({data:{roomId,userId:user.id}});
      return NextResponse.json({roomId:room.id});
    }
    if (!me) return error("Ты не участник комнаты",403);
    if (action==="start") {
      if (room.hostId!==user.id) return error("Только ведущий может начать игру",403);
      if (room.status!=="WAITING") return error("Игра уже началась");
      if (room.players.length<4) return error("Для начала нужно минимум 4 игрока");
      await prisma.$transaction([
        ...room.players.map(p=>prisma.bunkerPlayer.update({where:{id:p.id},data:{character:card(),voteTarget:null}})),
        prisma.bunkerRoom.update({where:{id:roomId},data:{status:"DISCUSSION",round:1}})
      ]);
      return NextResponse.json({success:true});
    }
    if (action==="vote") {
      if (room.status!=="VOTING") return error("Сейчас голосование не идёт");
      const targetId=String(body.targetId||"");
      if (!room.players.some(p=>p.id===targetId&&!room.eliminated.includes(p.id)) || targetId===me.id || room.eliminated.includes(me.id)) return error("Недопустимая цель");
      await prisma.bunkerPlayer.update({where:{id:me.id},data:{voteTarget:targetId}});
      const refreshed=await prisma.bunkerPlayer.findMany({where:{roomId}});
      if (refreshed.filter(p=>!room.eliminated.includes(p.id)&&p.voteTarget).length>=room.players.length-room.eliminated.length) {
        const counts=new Map<string,number>();
        refreshed.forEach(p=>{if(p.voteTarget)counts.set(p.voteTarget,(counts.get(p.voteTarget)||0)+1);});
        const max=Math.max(...counts.values());
        const tied=[...counts].filter(([,n])=>n===max).map(([id])=>id);
        const eliminated=tied.length===1?[...room.eliminated,tied[0]]:room.eliminated;
        await prisma.$transaction([
          prisma.bunkerRoom.update({where:{id:roomId},data:{eliminated,status:eliminated.length>=room.players.length-2?"FINISHED":"DISCUSSION",round:{increment:1}}}),
          prisma.bunkerPlayer.updateMany({where:{roomId},data:{voteTarget:null}})
        ]);
        return NextResponse.json({success:true,roundEnded:true,eliminatedId:tied.length===1?tied[0]:null});
      }
      return NextResponse.json({success:true});
    }
    if (action==="voting") {
      if(room.hostId!==user.id) return error("Только ведущий может начать голосование",403);
      if(room.status!=="DISCUSSION") return error("Сейчас нельзя начать голосование");
      await prisma.bunkerRoom.update({where:{id:roomId},data:{status:"VOTING"}});
      return NextResponse.json({success:true});
    }
    return error("Неизвестное действие");
  } catch(e) { console.error("Bunker POST",e); return error("Не удалось выполнить действие",500); }
}
