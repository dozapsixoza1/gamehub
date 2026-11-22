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
        fetch("/api/hub?type=settings", { headers: { "x-init-data": data }, cache: "no-store" })
          .then(r => r.json())
          .then(settingsData => {
            const settings = settingsData.settings;
            if (settings) {
              const root = document.documentElement;
              root.dataset.theme = settings.theme || "dark";
              root.dataset.accent = settings.accentColor || "ruby";
              root.dataset.background = settings.backgroundStyle || "aurora";
              root.dataset.compact = settings.compactMode ? "true" : "false";
              root.dataset.animations = settings.animations === false ? "false" : "true";
              root.dataset.profileBackground = settings.profileBackground || "";
              setUser(current => current ? { ...current, displayName: settings.displayName, avatarUrl: settings.avatarUrl, profileFrame: settings.profileFrame, nicknameColor: settings.nicknameColor, profileBadge: settings.profileBadge, profileBackground: settings.profileBackground, avatarAnimation: settings.avatarAnimation, profileEffect: settings.profileEffect, profileTitle: settings.profileTitle } : current);
            }
          })
          .catch(() => {});

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
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const initialize = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) return false;

      if (timer) clearInterval(timer);
      if (cancelled) return true;

      setIsTelegram(true);
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor("#0a0a0a");
        tg.setBackgroundColor("#0a0a0a");
        tg.disableVerticalSwipes?.();
      } catch (error) {
        console.warn("Telegram WebApp setup:", error);
      }

      const data = String(tg.initData || "");
      setInitData(data);
      if (data) {
        authenticate(data);
      } else {
        setIsLoading(false);
      }
      return true;
    };

    // Telegram's external SDK can finish loading after React hydration.
    if (!initialize()) {
      timer = setInterval(() => {
        attempts += 1;
        if (initialize()) return;
        if (attempts >= 100) {
          if (timer) clearInterval(timer);
          if (!cancelled) {
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
                isVerified: false,
              });
            }
            setIsLoading(false);
          }
        }
      }, 50);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!initData) return;
    const heartbeat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
        cache: "no-store",
      }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [initData]);

  return (
    <TelegramContext.Provider
      value={{ user, initData, isLoading, isTelegram, refreshUser }}
    >
      {children}
    </TelegramContext.Provider>
  );
}
