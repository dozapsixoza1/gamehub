"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, ShoppingBag, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Игры", icon: Gamepad2 },
  { href: "/rooms", label: "Комнаты", icon: Users },
  { href: "/shop", label: "Магазин", icon: ShoppingBag },
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
      <div className="mx-auto max-w-lg">
        <div className="mx-3 mb-3 rounded-2xl glass border border-white/10 shadow-2xl">
          <div className="flex items-center justify-around py-2">
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
                    "flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-xl transition-all",
                      isActive && "bg-white/10"
                    )}
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                  </div>
                  <span className="text-[11px] font-medium tracking-wide">
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
