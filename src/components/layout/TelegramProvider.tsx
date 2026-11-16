"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { UserProfile } from "@/types";

interface TelegramContextValue {
  user: UserProfile | null;
  initData: string;
  isLoading: boolean;
  isTelegram: boolean;
  refreshUser: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextValue>({
  user: null,
  initData: "",
  isLoading: true,
  isTelegram: false,
  refreshUser: async () => {},
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initData, setInitData] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);
  const referralHandled = useRef(false);

  const authenticate = async (data: string) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: data }),
      });

      if (res.ok) {
        const json = await res.json();
        setUser(json.user);

        // Автоматически применяем реферальный код из Telegram Mini App startapp.
        const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || "";
        if (!referralHandled.current && typeof startParam === "string" && startParam.startsWith("ref_")) {
          referralHandled.current = true;
          const code = startParam.slice(4);
          if (code) {
            fetch("/api/progression", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ initData: data, action: "apply_referral", code }),
            }).catch(console.error);
          }
        }
      }
    } catch (e) {
      console.error("Auth failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (initData) {
      await authenticate(initData);
    }
  };

  useEffect(() => {
    // Ждём загрузки Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#0a0a0a");
      tg.setBackgroundColor("#0a0a0a");

      // Отключаем вертикальные свайпы закрытия на iOS
      try {
        tg.disableVerticalSwipes?.();
      } catch {}

      const data = tg.initData || "";
      setInitData(data);

      if (data) {
        authenticate(data);
      } else {
        // Для разработки без Telegram
        setIsLoading(false);
      }
    } else {
      // Dev mode — фейковый пользователь
      if (process.env.NODE_ENV === "development") {
        setUser({
          id: "dev-user",
          telegramId: "123456789",
          firstName: "Разработчик",
          username: "dev",
          coins: 1500,
          gems: 50,
          gamesPlayed: 12,
          gamesWon: 5,
          isAdmin: true,
        });
      }
      setIsLoading(false);
    }
  }, []);

  return (
    <TelegramContext.Provider
      value={{ user, initData, isLoading, isTelegram, refreshUser }}
    >
      {children}
    </TelegramContext.Provider>
  );
}
