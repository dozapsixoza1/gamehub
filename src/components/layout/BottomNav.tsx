"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, ShoppingBag, User, Users, MessageCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Игры", icon: Gamepad2 },
  { href: "/rooms", label: "Комнаты", icon: Users },
  { href: "/clans", label: "Кланы", icon: Shield },
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
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-2 rounded-2xl glass border border-white/10 shadow-2xl">
          <div className="grid w-full grid-cols-6 items-stretch gap-0.5 px-1 py-1.5">
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
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl p-1 transition-all",
                      isActive && "bg-white/10"
                    )}
                  >
                    <Icon
                      size={19}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                  </div>
                  <span className="max-w-full whitespace-nowrap text-[9px] font-semibold leading-tight tracking-tight sm:text-[10px]">
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
