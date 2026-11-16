import { webhookCallback } from "grammy";
import bot from "@/lib/bot";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  try {
    return await handleUpdate(req);
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
}
