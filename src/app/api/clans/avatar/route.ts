import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const MIME: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const initData = String(form.get("initData") || "");
    const token = process.env.BOT_TOKEN;
    const auth = token ? validateTelegramWebAppData(initData, token) : null;
    if (!auth?.valid || !auth.user) return NextResponse.json({ error:"Нет доступа" }, { status:401 });
    const user = await prisma.user.findUnique({ where:{ telegramId:BigInt(auth.user.id) } });
    if (!user || user.isBanned) return NextResponse.json({ error:"Нет доступа" }, { status:403 });
    const file = form.get("file");
    if (!(file instanceof File) || !MIME[file.type]) return NextResponse.json({ error:"Выбери JPG, PNG или WEBP" }, { status:400 });
    if (file.size < 1 || file.size > 3 * 1024 * 1024) return NextResponse.json({ error:"Аватар должен быть не больше 3 МБ" }, { status:413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const signatures: Record<string,number[]> = { "image/jpeg":[0xff,0xd8,0xff], "image/png":[0x89,0x50,0x4e,0x47], "image/webp":[0x52,0x49,0x46,0x46] };
    if (!signatures[file.type].every((v,i)=>bytes[i]===v) || (file.type==="image/webp" && bytes.toString("ascii",8,12)!=="WEBP")) return NextResponse.json({error:"Некорректное изображение"},{status:415});
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({error:"Загрузка фото не настроена на сервере"},{status:503});
    const storage=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}).storage;
    const bucket="gamehub-avatars";
    const check=await storage.getBucket(bucket);
    if(check.error){const made=await storage.createBucket(bucket,{public:true,fileSizeLimit:"5MB",allowedMimeTypes:Object.keys(MIME)});if(made.error&&!made.error.message.toLowerCase().includes("already exists"))return NextResponse.json({error:"Не удалось подготовить хранилище"},{status:503});}
    const path="clans/"+user.id+"/"+randomUUID()+"."+MIME[file.type];
    const uploaded=await storage.from(bucket).upload(path,bytes,{contentType:file.type,cacheControl:"31536000",upsert:false});
    if(uploaded.error)return NextResponse.json({error:"Не удалось загрузить аватар"},{status:502});
    return NextResponse.json({success:true,avatarUrl:storage.from(bucket).getPublicUrl(path).data.publicUrl});
  } catch(error){console.error("Clan avatar upload",error);return NextResponse.json({error:"Ошибка загрузки аватара"},{status:500});}
}
