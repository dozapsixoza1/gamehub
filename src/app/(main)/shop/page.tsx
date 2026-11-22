"use client";

import { useEffect, useState } from "react";
import { useTelegram } from "@/components/layout/TelegramProvider";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { Coins, Gem, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShopItemDTO } from "@/types";

const CATEGORIES = [
  { id: "all", label: "Все" },
  { id: "mafia", label: "Мафия" },
  { id: "global", label: "Общее" },
  { id: "boosts", label: "Бусты" },
  { id: "cosmetics", label: "Косметика" },
];

export default function ShopPage() {
  const { user, initData, refreshUser } = useTelegram();
  const [items, setItems] = useState<ShopItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [buying, setBuying] = useState<string | null>(null);
  const [ownedItemIds, setOwnedItemIds] = useState<string[]>([]);

  useEffect(() => {
    if (!initData) return;
    fetch("/api/shop", { headers: { "x-init-data": initData }, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setOwnedItemIds(data.ownedItemIds || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [initData]);

  const filtered =
    activeCategory === "all"
      ? items
      : items.filter(
          (i) => i.gameId === activeCategory || i.category === activeCategory
        );

  const handleEquip = async (item: ShopItemDTO) => {\n    if (!initData || buying) return;\n    setBuying(item.id);\n    try {\n      const res = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, itemId: item.id, action: "equip" }) });\n      const data = await res.json();\n      if (!res.ok) throw new Error(data.message || data.error || "Не удалось экипировать предмет");\n      await refreshUser();\n      alert("Предмет экипирован");\n    } catch (error) { alert(error instanceof Error ? error.message : "Ошибка сети"); }\n    finally { setBuying(null); }\n  };\n\n  const handleBuy = async (item: ShopItemDTO, currency: "coins" | "gems") => {
    if (!initData || buying) return;
    setBuying(item.id);

    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          itemId: item.id,
          currency,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await refreshUser();
        // Можно добавить toast
      } else {
        alert(data.message || "Ошибка покупки");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Магазин</h1>
        <p className="text-white/50 text-sm mt-1">
          Улучшения и предметы для игр
        </p>
      </div>

      <Link href="/nft" className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-r from-[#20143a] via-[#17142a] to-[#0b1e2c] p-4">
        <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl"/>
        <div className="relative rounded-xl bg-white/10 p-3 text-violet-200"><Gem size={23}/></div>
        <div className="relative min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[.22em] text-violet-200/70">Exclusive collection</p><p className="font-bold text-white">NFT Gifts</p><p className="text-[11px] text-white/45">Уникальные арты · 4 уровня редкости</p></div>
        <Sparkles size={18} className="relative text-violet-200"/>
      </Link>

      {/* Balance */}
      {user && (
        <div className="flex gap-3 mb-5">
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
            <Coins size={16} className="text-amber-400" />
            <span className="font-medium text-sm">
              {formatNumber(user.coins)}
            </span>
          </div>
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
            <Gem size={16} className="text-violet-400" />
            <span className="font-medium text-sm">
              {formatNumber(user.gems)}
            </span>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              activeCategory === cat.id
                ? "bg-white text-black"
                : "bg-white/10 text-white/60 hover:bg-white/15"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40">Пока пусто</p>
          <p className="text-white/30 text-sm mt-1">
            Товары появятся совсем скоро
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="glass rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <ShoppingBag size={22} className="text-white/30" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {item.category === "cosmetics" && ownedItemIds.includes(item.id) && <button onClick={() => handleEquip(item)} disabled={!!buying} className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300 disabled:opacity-50">{buying === item.id ? "..." : "Надеть"}</button>}\n                  {item.priceCoins > 0 && (
                    <button
                      onClick={() => handleBuy(item, "coins")}
                      disabled={!!buying}
                      className="flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-lg hover:bg-amber-500/25 transition disabled:opacity-50"
                    >
                      <Coins size={12} />
                      {formatNumber(item.priceCoins)}
                    </button>
                  )}
                  {item.priceGems > 0 && (
                    <button
                      onClick={() => handleBuy(item, "gems")}
                      disabled={!!buying}
                      className="flex items-center gap-1 text-xs bg-violet-500/15 text-violet-400 px-2.5 py-1 rounded-lg hover:bg-violet-500/25 transition disabled:opacity-50"
                    >
                      <Gem size={12} />
                      {formatNumber(item.priceGems)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
