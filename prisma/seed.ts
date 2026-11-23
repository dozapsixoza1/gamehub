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

  {
    name: "Рамка профиля «Рубин»",
    description: "Косметическая рамка для аватара",
    gameId: "global",
    category: "cosmetics",
    priceCoins: 1200,
    priceGems: 0,
    sortOrder: 30,
    metadata: { cosmeticType: "frame", cosmeticValue: "ruby" },
  },
  {
    name: "Цвет ника «Аметист»",
    description: "Фиолетовый акцент имени в профиле",
    gameId: "global",
    category: "cosmetics",
    priceCoins: 1800,
    priceGems: 0,
    sortOrder: 31,
    metadata: { cosmeticType: "nicknameColor", cosmeticValue: "amethyst" },
  },
  {
    name: "Значок «Победитель»",
    description: "Эксклюзивный значок в профиле",
    gameId: "global",
    category: "cosmetics",
    priceCoins: 0,
    priceGems: 12,
    sortOrder: 32,
    metadata: { cosmeticType: "badge", cosmeticValue: "winner" },
  },
  {
    name: "Фон профиля «Аврора»",
    description: "Северное сияние в оформлении профиля",
    gameId: "global",
    category: "cosmetics",
    priceCoins: 2500,
    priceGems: 0,
    sortOrder: 33,
    metadata: { cosmeticType: "background", cosmeticValue: "aurora" },
  },

  // === GAMEHUB PROFILE COSMETICS ===
  { name: "Рамка «Аметистовая корона»", description: "Мягкое фиолетовое свечение вокруг аватара", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 35, sortOrder: 34, metadata: { cosmeticType: "frame", cosmeticValue: "amethyst" } },
  { name: "Рамка «Кибер-импульс»", description: "Холодная неоновая рамка", gameId: "global", category: "cosmetics", priceCoins: 3200, priceGems: 0, sortOrder: 35, metadata: { cosmeticType: "frame", cosmeticValue: "cyber" } },
  { name: "Рамка «Золотой ранг»", description: "Золотое сияние профиля", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 55, sortOrder: 36, metadata: { cosmeticType: "frame", cosmeticValue: "gold" } },
  { name: "Рамка «Изумруд»", description: "Изумрудная подсветка", gameId: "global", category: "cosmetics", priceCoins: 4200, priceGems: 0, sortOrder: 37, metadata: { cosmeticType: "frame", cosmeticValue: "emerald" } },
  { name: "Анимация аватара «Пульс»", description: "Аватар мягко пульсирует", gameId: "global", category: "cosmetics", priceCoins: 2600, priceGems: 0, sortOrder: 38, metadata: { cosmeticType: "animation", cosmeticValue: "pulse" } },
  { name: "Анимация аватара «Орбита»", description: "Неоновое кольцо вращается вокруг аватара", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 45, sortOrder: 39, metadata: { cosmeticType: "animation", cosmeticValue: "orbit" } },
  { name: "Анимация аватара «Парение»", description: "Плавное движение вверх и вниз", gameId: "global", category: "cosmetics", priceCoins: 3000, priceGems: 0, sortOrder: 40, metadata: { cosmeticType: "animation", cosmeticValue: "float" } },
  { name: "Эффект «Искры»", description: "Светящиеся частицы вокруг аватара", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 50, sortOrder: 41, metadata: { cosmeticType: "effect", cosmeticValue: "spark" } },
  { name: "Эффект «Пламя»", description: "Тёплое огненное свечение", gameId: "global", category: "cosmetics", priceCoins: 5000, priceGems: 0, sortOrder: 42, metadata: { cosmeticType: "effect", cosmeticValue: "flame" } },
  { name: "Эффект «Глитч»", description: "Кибернетическое мерцание", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 65, sortOrder: 43, metadata: { cosmeticType: "effect", cosmeticValue: "glitch" } },
  { name: "Титул «Легенда GameHub»", description: "Титул под именем в профиле", gameId: "global", category: "cosmetics", priceCoins: 0, priceGems: 75, sortOrder: 44, metadata: { cosmeticType: "title", cosmeticValue: "Легенда GameHub" } },
  { name: "Титул «Ветеран»", description: "Титул для опытных игроков", gameId: "global", category: "cosmetics", priceCoins: 6500, priceGems: 0, sortOrder: 45, metadata: { cosmeticType: "title", cosmeticValue: "Ветеран" } },
];

const ACHIEVEMENTS = [
  { id: "first_game", title: "Первый матч", description: "Сыграть первую партию", icon: "🪩", xpReward: 25, coinsReward: 25 },
  { id: "games_10", title: "Постоянный игрок", description: "Сыграть 10 матчей", icon: "🪬", xpReward: 75, coinsReward: 75 },
  { id: "wins_5", title: "Победитель", description: "Одержать 5 побед", icon: "💠", xpReward: 100, coinsReward: 100 },
  { id: "games_50", title: "Ветеран", description: "Сыграть 50 матчей", icon: "🪽", xpReward: 250, coinsReward: 250 },
  { id: "wins_25", title: "Легенда", description: "Одержать 25 побед", icon: "🪐", xpReward: 500, coinsReward: 500 },
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

  await prisma.achievement.createMany({ data: ACHIEVEMENTS, skipDuplicates: true });
  console.log("Achievements ensured.");
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
