import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {validateTelegramWebAppData} from "@/lib/telegram";
export async function GET(req:NextRequest,context:{params:Promise<{id:string}>}){
 try{const token=process.env.BOT_TOKEN,initData=req.headers.get("x-init-data")||"";const auth=token?validateTelegramWebAppData(initData,token):null;if(!auth?.valid||!auth.user)return NextResponse.json({error:"Нет доступа"},{status:401});const {id}=await context.params;
 const p=await prisma.user.findUnique({where:{id},select:{id:true,username:true,firstName:true,lastName:true,photoUrl:true,xp:true,level:true,gamesPlayed:true,gamesWon:true,isAdmin:true,isVerified:true,createdAt:true,settings:{select:{displayName:true,avatarUrl:true}},nftOwnerships:{take:8,orderBy:{acquiredAt:"desc"},select:{id:true,serialNumber:true,acquiredAt:true,gift:{select:{name:true,rarity:true,imageUrl:true}}}},nftOwnerships:{include:{gift:true},orderBy:{acquiredAt:"desc"},take:12}}});
 if(!p)return NextResponse.json({error:"Игрок не найден"},{status:404});
 return NextResponse.json({player:{id:p.id,username:p.username,displayName:p.settings?.displayName||[p.firstName,p.lastName].filter(Boolean).join(" ")||p.username||"Игрок",avatar:p.settings?.avatarUrl||p.photoUrl,xp:p.xp,level:p.level,gamesPlayed:p.gamesPlayed,gamesWon:p.gamesWon,winRate:p.gamesPlayed?Math.round(p.gamesWon/p.gamesPlayed*100):0,isAdmin:p.isAdmin,isVerified:p.isVerified,createdAt:p.createdAt,nftOwnerships:p.nftOwnerships.map(n=>({id:n.id,serialNumber:n.serialNumber,acquiredAt:n.acquiredAt,gift:{id:n.gift.id,name:n.gift.name,rarity:n.gift.rarity,imageUrl:n.gift.imageUrl}}))}});
 }catch(e){console.error("Player profile:",e);return NextResponse.json({error:"Не удалось загрузить профиль"},{status:500});}
}