import crypto from "crypto";

/**
 * Валидация initData от Telegram WebApp
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramWebAppData(
  initData: string,
  botToken: string
): { valid: boolean; user?: TelegramWebAppUser } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    // Сортируем параметры
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Создаём секретный ключ
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // Считаем hash
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    // Проверяем auth_date (не старше 24 часов)
    const authDate = Number(urlParams.get("auth_date"));
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    const userStr = urlParams.get("user");
    if (!userStr) return { valid: false };

    const user = JSON.parse(userStr) as TelegramWebAppUser;
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}
