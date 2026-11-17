import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {validateTelegramWebAppData} from "@/lib/telegram";
export async function POST(req:NextRequest){
 try{const body=await req.json(),token=process.env.BOT_TOKEN;const auth=token?validateTelegramWebAppData(String(body.initData||""),token):null;if(!auth?.valid||!auth.user)return NextResponse.json({error:"Нет доступа"},{status:401});
 const admin=await prisma.user.findUnique({where:{telegramId:BigInt(auth.user.id)},select:{isAdmin:true,isBanned:true}});if(!admin?.isAdmin||admin.isBanned)return NextResponse.json({error:"Недостаточно прав"},{status:403});
 const username=String(body.username||"").trim().replace(/^@/,"").toLowerCase();if(!/^[a-z0-9_]{5,32}$/.test(username)||typeof body.verified!=="boolean")return NextResponse.json({error:"Проверь username игрока"},{status:400});
 const target=await prisma.user.findFirst({where:{username:{equals:username,mode:"insensitive"}},select:{id:true,username:true}});if(!target)return NextResponse.json({error:"Игрок с таким username не найден"},{status:404});
 await prisma.user.update({where:{id:target.id},data:{isVerified:body.verified}});return NextResponse.json({success:true,message:body.verified?`Галочка выдана: @${target.username}`:`Галочка снята: @${target.username}`});
 }catch(e){console.error("Verification update:",e);return NextResponse.json({error:"Не удалось изменить верификацию"},{status:500});}
}