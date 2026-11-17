import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const CATALOGUE = [["prism-bloom","Prism Bloom","Кристальный цветок, собравший свет семи граней.","RARE","/nft/prism-bloom.svg",null],["moon-relic","Moon Relic","Лунный артефакт с холодным серебряным свечением.","RARE","/nft/moon-relic.svg",null],["velvet-comet","Velvet Comet","Редкая комета с бархатным хвостом из звёздной пыли.","RARE","/nft/velvet-comet.svg",null],["azure-sigil","Azure Sigil","Синий знак хранителя забытых миров.","RARE","/nft/azure-sigil.svg",null],["pearl-warden","Pearl Warden","Жемчужный страж с сияющим сердцем.","RARE","/nft/pearl-warden.svg",null],["solar-key","Solar Key","Ключ, открывающий врата солнечного зала.","RARE","/nft/solar-key.svg",null],["phoenix-core","Phoenix Core","Ядро феникса, рождённое из золотого пламени.","EPIC","/nft/phoenix-core.svg",null],["obsidian-crown","Obsidian Crown","Корона из чёрного стекла с алым сердцем.","EPIC","/nft/obsidian-crown.svg",null],["celestial-harp","Celestial Harp","Инструмент, звучащий только среди созвездий.","EPIC","/nft/celestial-harp.svg",null],["void-lantern","Void Lantern","Фонарь, освещающий путь сквозь пустоту.","EPIC","/nft/void-lantern.svg",null],["dragon-crest","Dragon Crest","Герб древнего драконьего дома.","EPIC","/nft/dragon-crest.svg",null],["astral-compass","Astral Compass","Компас, указывающий на ещё не открытые миры.","EPIC","/nft/astral-compass.svg",null],["worldheart","Worldheart","Сердце мира, в котором пульсируют целые галактики.","MYTHIC","/nft/worldheart.svg",null],["eclipse-sovereign","Eclipse Sovereign","Знак владыки затмения, редчайший символ силы.","MYTHIC","/nft/eclipse-sovereign.svg",null],["starborn-oracle","Starborn Oracle","Оракул, читающий судьбы по звёздным потокам.","MYTHIC","/nft/starborn-oracle.svg",null],["eternal-seraph","Eternal Seraph","Крылатый реликт вечного света.","MYTHIC","/nft/eternal-seraph.svg",null],["chrono-bloom","Chrono Bloom","Цветок времени, застывший между секундами.","MYTHIC","/nft/chrono-bloom.svg",null],["nebula-throne","Nebula Throne","Трон из космической пыли и древнего металла.","MYTHIC","/nft/nebula-throne.svg",null],["first-light","First Light #01","Первая работа коллекции. Выпуск строго ограничен.","LIMITED","/nft/first-light.svg",50],["founder-seal","Founder Seal","Печать основателя GameHub.","LIMITED","/nft/founder-seal.svg",50],["genesis-shard","Genesis Shard","Осколок самого первого кристалла коллекции.","LIMITED","/nft/genesis-shard.svg",50],["zero-hour","Zero Hour","Артефакт нулевого часа — момент начала новой эры.","LIMITED","/nft/zero-hour.svg",50],["royal-cipher","Royal Cipher","Зашифрованный знак закрытого королевского ордена.","LIMITED","/nft/royal-cipher.svg",50],["last-aurora","Last Aurora","Последнее сияние перед рассветом новой эпохи.","LIMITED","/nft/last-aurora.svg",50]] as const;
function ownerIds(){return (process.env.ADMIN_TELEGRAM_IDS||"").split(",").map(x=>x.trim()).filter(x=>/^\d+$/.test(x));}
async function getUser(initData:string){
  const token=process.env.BOT_TOKEN;if(!token)return null;
  const a=validateTelegramWebAppData(initData,token);if(!a.valid||!a.user)return null;
  const user=await prisma.user.findUnique({where:{telegramId:BigInt(a.user.id)}});
  return user&&!user.isBanned?user:null;
}
async function ensureCatalogue(){
  await Promise.all(CATALOGUE.map(([slug,name,description,rarity,imageUrl,supply],i)=>prisma.nftGift.upsert({
    where:{slug},
    create:{slug,name,description,rarity,imageUrl,supply,sortOrder:i},
    update:{name,description,rarity,imageUrl,supply,sortOrder:i,isActive:true}
  })));
}
export async function GET(req:NextRequest){
  try{
    const user=await getUser(req.headers.get("x-init-data")||req.nextUrl.searchParams.get("initData")||"");
    if(!user)return NextResponse.json({error:"Нет доступа"},{status:401});
    await ensureCatalogue();
    const [gifts,owned,orders]=await Promise.all([
      prisma.nftGift.findMany({where:{isActive:true},orderBy:{sortOrder:"asc"}}),
      prisma.userNft.findMany({where:{userId:user.id},include:{gift:true},orderBy:{acquiredAt:"desc"}}),
      prisma.nftOrder.findMany({where:{userId:user.id},include:{gift:true},orderBy:{createdAt:"desc"},take:20})
    ]);
    return NextResponse.json({gifts:gifts.map(g=>({...g,remaining:g.supply===null?null:Math.max(0,g.supply-g.issued)})),owned,orders});
  }catch(e){console.error("NFT GET",e);return NextResponse.json({error:"Не удалось загрузить NFT-магазин"},{status:500});}
}
export async function POST(req:NextRequest){
  try{
    const body=await req.json();const user=await getUser(String(body.initData||""));
    if(!user)return NextResponse.json({error:"Нет доступа"},{status:401});
    if(body.action!=="create_order")return NextResponse.json({error:"Неизвестное действие"},{status:400});
    const gift=await prisma.nftGift.findUnique({where:{id:String(body.giftId||"")}});
    if(!gift||!gift.isActive)return NextResponse.json({error:"Подарок не найден"},{status:404});
    if(gift.supply!==null&&gift.issued>=gift.supply)return NextResponse.json({error:"Лимитированная серия закончилась"},{status:409});
    if(await prisma.userNft.findFirst({where:{userId:user.id,giftId:gift.id}}))return NextResponse.json({error:"Этот подарок уже есть в твоей коллекции"},{status:409});
    const pending=await prisma.nftOrder.findFirst({where:{userId:user.id,giftId:gift.id,status:"PENDING"}});
    if(pending)return NextResponse.json({success:true,orderId:pending.id,message:"Заявка уже создана"});
    const note=String(body.note||"").trim().slice(0,250);
    const order=await prisma.nftOrder.create({data:{userId:user.id,giftId:gift.id,buyerNote:note||null}});
    const buyer=user.username?"@"+user.username:(user.firstName||"Игрок");
    const text=["Новая заявка на NFT GameHub","Подарок: "+gift.name+" ["+gift.rarity+"]","Покупатель: "+buyer,"ID заявки: "+order.id,note?"Комментарий: "+note:"","Подтверди оплату и выдай подарок в админ-панели."].filter(Boolean).join("\n");
    const token=process.env.BOT_TOKEN,ids=ownerIds();
    if(token&&ids.length)await Promise.allSettled(ids.map(chatId=>fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true})})));
    const owner = await prisma.user.findFirst({ where: { telegramId: { in: ownerIds().map(BigInt) } }, select: { username: true } });
    const ownerUsername=(owner?.username||process.env.OWNER_TELEGRAM_USERNAME||"").replace(/^@/,"");
    const contactUrl=ownerUsername?"https://t.me/"+ownerUsername+"?text="+encodeURIComponent("Здравствуйте! Хочу купить "+gift.name+". Заявка "+order.id):null;
    return NextResponse.json({success:true,orderId:order.id,contactUrl,message:"Заявка отправлена владельцу. Согласуй оплату в личных сообщениях."});
  }catch(e){console.error("NFT POST",e);return NextResponse.json({error:"Не удалось создать заявку"},{status:500});}
}
