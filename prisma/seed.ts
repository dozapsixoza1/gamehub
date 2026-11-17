import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP_ITEMS = [
  // === МАФИЯ ===
  {
    name: "Скин «Кровавая Роза»",
    description: "Эксклюзивный скин для роли Мафии",
    gameId: "mafia",
    category: "skins",
    priceCoins: 500,
    priceGems: 0,
    sortOrder: 1,
  },
  {
    name: "Скин «Тёмный Рыцарь»",
    description: "Премиум скин для Дона",
    gameId: "mafia",
    category: "skins",
    priceCoins: 0,
    priceGems: 25,
    sortOrder: 2,
  },
  {
    name: "Дополнительная проверка",
    description: "Шериф может проверить двух игроков за ночь (1 раз)",
    gameId: "mafia",
    category: "boosts",
    priceCoins: 300,
    priceGems: 0,
    sortOrder: 3,
  },
  {
    name: "Второе мнение врача",
    description: "Доктор может лечить двух игроков (1 раз)",
    gameId: "mafia",
    category: "boosts",
    priceCoins: 350,
    priceGems: 0,
    sortOrder: 4,
  },
  {
    name: "Анонимный голос",
    description: "Твой голос на дневном голосовании скрыт",
    gameId: "mafia",
    category: "boosts",
    priceCoins: 200,
    priceGems: 10,
    sortOrder: 5,
  },

  // === ОБЩЕЕ ===
  {
    name: "Пакет 500 монет",
    description: "Пополнить баланс монет",
    gameId: "global",
    category: "currency",
    priceCoins: 0,
    priceGems: 20,
    sortOrder: 10,
  },
  {
    name: "Пакет 1500 монет",
    description: "Большой пакет монет",
    gameId: "global",
    category: "currency",
    priceCoins: 0,
    priceGems: 50,
    sortOrder: 11,
  },
  {
    name: "Стартовый набор",
    description: "500 монет + 10 гемов",
    gameId: "global",
    category: "currency",
    priceCoins: 0,
    priceGems: 30,
    sortOrder: 12,
  },
  {
    name: "VIP на 7 дней",
    description: "Особый значок и +10% к наградам",
    gameId: "global",
    category: "boosts",
    priceCoins: 0,
    priceGems: 100,
    sortOrder: 13,
  },

  // === БУСТЫ ===
  {
    name: "Удвоение опыта",
    description: "x2 опыта за следующую игру",
    gameId: "global",
    category: "boosts",
    priceCoins: 150,
    priceGems: 0,
    sortOrder: 20,
  },
];



async function main() {
  console.log("Seeding shop items...");

  for (const item of SHOP_ITEMS) {
    const existing = await prisma.shopItem.findFirst({
      where: { name: item.name, gameId: item.gameId },
    });

    if (!existing) {
      await prisma.shopItem.create({ data: item });
      console.log(`  + ${item.name}`);
    } else {
      console.log(`  = ${item.name} (already exists)`);
    }
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
