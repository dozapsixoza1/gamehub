import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "gamehub-avatars";
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function authenticatedUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const result = validateTelegramWebAppData(initData, token);
  if (!result.valid || !result.user) return null;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(result.user.id) } });
  return user && !user.isBanned ? user : null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const user = await authenticatedUser(String(form.get("initData") || ""));
    if (!user) return NextResponse.json({ error: "Нет доступа. Перезапусти GameHub и попробуй снова." }, { status: 401 });

    if (form.get("action") === "remove") {
      await prisma.userSettings.update({ where: { userId: user.id }, data: { avatarUrl: null } });
      return NextResponse.json({ success: true, avatarUrl: null });
    }

    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Выбери изображение" }, { status: 400 });
    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) return NextResponse.json({ error: "Поддерживаются JPG, PNG, WEBP и GIF" }, { status: 415 });
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл должен быть не больше 5 МБ" }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const signatures: Record<string, number[][]> = {
      "image/jpeg": [[0xff, 0xd8, 0xff]],
      "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
      "image/webp": [[0x52, 0x49, 0x46, 0x46]],
      "image/gif": [[0x47, 0x49, 0x46, 0x38]],
    };
    const signatureOk = signatures[file.type].some(signature =>
      signature.every((byte, index) => bytes[index] === byte)
    );
    if (!signatureOk) return NextResponse.json({ error: "Файл не похож на изображение выбранного формата" }, { status: 415 });
    if (file.type === "image/webp" && bytes.toString("ascii", 8, 12) !== "WEBP") {
      return NextResponse.json({ error: "Повреждённый WEBP-файл" }, { status: 415 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: "Загрузка фото пока не настроена на сервере: добавь Supabase Service Role Key." }, { status: 503 });
    }

    const storage = createServiceClient().storage;
    const existingBucket = await storage.getBucket(BUCKET);
    if (existingBucket.error) {
      const created = await storage.createBucket(BUCKET, { public: true, fileSizeLimit: "5MB", allowedMimeTypes: Object.keys(MIME_EXTENSIONS) });
      if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
        console.error("Avatar bucket setup failed:", created.error);
        return NextResponse.json({ error: "Не удалось подготовить хранилище аватаров" }, { status: 503 });
      }
    }

    const path = `${user.id}/${randomUUID()}.${extension}`;
    const uploaded = await storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploaded.error) {
      console.error("Avatar upload failed:", uploaded.error);
      return NextResponse.json({ error: "Не удалось сохранить фото. Проверь настройки Supabase Storage." }, { status: 502 });
    }

    const { data } = storage.from(BUCKET).getPublicUrl(path);
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { avatarUrl: data.publicUrl },
    });
    return NextResponse.json({ success: true, avatarUrl: data.publicUrl });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Внутренняя ошибка загрузки аватара" }, { status: 500 });
  }
}
