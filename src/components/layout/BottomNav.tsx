"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, ShoppingBag, User, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Игры", icon: Gamepad2 },
  { href: "/rooms", label: "Комнаты", icon: Users },
  { href: "/shop", label: "Магазин", icon: ShoppingBag },
  { href: "/messages", label: "Чаты", icon: MessageCircle },
  { href: "/profile", label: "Профиль", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // Скрываем навигацию внутри игры
  if (pathname.startsWith("/mafia/") && pathname !== "/mafia") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto w-full max-w-lg px-2">
        <div className="mb-2 rounded-2xl glass border border-white/10 shadow-2xl">
          <div className="flex w-full items-stretch py-1.5">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/" || pathname.startsWith("/games")
                  : pathname.startsWith(tab.href);

              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl p-1.5 transition-all",
                      isActive && "bg-white/10"
                    )}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                  </div>
                  <span className="whitespace-nowrap text-[10px] font-medium leading-tight tracking-tight">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
