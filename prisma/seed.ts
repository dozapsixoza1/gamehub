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



const NFT_GIFTS = [
  {
    "slug": "frost-fox",
    "name": "Ледяная лисица",
    "description": "Кристальная маска хранителя северного сияния",
    "rarity": "RARE",
    "imageUrl": "/nft/frost-fox.svg",
    "sortOrder": 1
  },
  {
    "slug": "blue-rose",
    "name": "Сапфировая роза",
    "description": "Синяя роза в стеклянном куполе",
    "rarity": "RARE",
    "imageUrl": "/nft/blue-rose.svg",
    "sortOrder": 2
  },
  {
    "slug": "winged-clock",
    "name": "Крылатые часы",
    "description": "Карманные часы с серебряными крыльями",
    "rarity": "RARE",
    "imageUrl": "/nft/winged-clock.svg",
    "sortOrder": 3
  },
  {
    "slug": "azure-core",
    "name": "Лазурное ядро",
    "description": "Голубой кристалл с внутренним свечением",
    "rarity": "RARE",
    "imageUrl": "/nft/azure-core.svg",
    "sortOrder": 4
  },
  {
    "slug": "moon-pendant",
    "name": "Лунный кулон",
    "description": "Полумесяц из синего сапфира",
    "rarity": "RARE",
    "imageUrl": "/nft/moon-pendant.svg",
    "sortOrder": 5
  },
  {
    "slug": "void-feather",
    "name": "Перо пустоты",
    "description": "Фиолетовое перо с магической гравировкой",
    "rarity": "EPIC",
    "imageUrl": "/nft/void-feather.svg",
    "sortOrder": 6
  },
  {
    "slug": "astral-hourglass",
    "name": "Песочные часы астрала",
    "description": "Песочные часы с космической пылью",
    "rarity": "EPIC",
    "imageUrl": "/nft/astral-hourglass.svg",
    "sortOrder": 7
  },
  {
    "slug": "prism-butterfly",
    "name": "Призматическая бабочка",
    "description": "Крылья из переливающихся аметистов",
    "rarity": "EPIC",
    "imageUrl": "/nft/prism-butterfly.svg",
    "sortOrder": 8
  },
  {
    "slug": "soul-lantern",
    "name": "Фонарь душ",
    "description": "Фонарь с фиолетовым пламенем",
    "rarity": "EPIC",
    "imageUrl": "/nft/soul-lantern.svg",
    "sortOrder": 9
  },
  {
    "slug": "amethyst-crown",
    "name": "Корона аметиста",
    "description": "Корона ночного королевства",
    "rarity": "EPIC",
    "imageUrl": "/nft/amethyst-crown.svg",
    "sortOrder": 10
  },
  {
    "slug": "lion-sigil",
    "name": "Знак золотого льва",
    "description": "Золотой герб с львиной маской",
    "rarity": "MYTHIC",
    "imageUrl": "/nft/lion-sigil.svg",
    "sortOrder": 11
  },
  {
    "slug": "crimson-heart",
    "name": "Сердце феникса",
    "description": "Сердце из рубинового стекла в золотой оправе",
    "rarity": "MYTHIC",
    "imageUrl": "/nft/crimson-heart.svg",
    "sortOrder": 12
  },
  {
    "slug": "eclipse-orb",
    "name": "Сфера затмения",
    "description": "Чёрное солнце в кольце огня",
    "rarity": "MYTHIC",
    "imageUrl": "/nft/eclipse-orb.svg",
    "sortOrder": 13
  },
  {
    "slug": "ember-dragon",
    "name": "Дракон пепла",
    "description": "Миниатюрная статуэтка дракона из золота",
    "rarity": "MYTHIC",
    "imageUrl": "/nft/ember-dragon.svg",
    "sortOrder": 14
  },
  {
    "slug": "solar-compass",
    "name": "Солнечный компас",
    "description": "Золотая звезда четырёх направлений",
    "rarity": "MYTHIC",
    "imageUrl": "/nft/solar-compass.svg",
    "sortOrder": 15
  },
  {
    "slug": "celestial-koi",
    "name": "Небесный кои",
    "description": "Рыба кои из звёздной воды",
    "rarity": "LIMITED",
    "imageUrl": "/nft/celestial-koi.svg",
    "sortOrder": 16
  },
  {
    "slug": "prism-reliquary",
    "name": "Призматический реликварий",
    "description": "Бабочка в хрустальном саркофаге",
    "rarity": "LIMITED",
    "imageUrl": "/nft/prism-reliquary.svg",
    "sortOrder": 17
  },
  {
    "slug": "black-rose",
    "name": "Чёрная роза",
    "description": "Тёмная роза с радужными лепестками",
    "rarity": "LIMITED",
    "imageUrl": "/nft/black-rose.svg",
    "sortOrder": 18
  },
  {
    "slug": "aurora-crystal",
    "name": "Кристалл авроры",
    "description": "Переливающийся кристалл в кольце света",
    "rarity": "LIMITED",
    "imageUrl": "/nft/aurora-crystal.svg",
    "sortOrder": 19
  },
  {
    "slug": "phoenix-egg",
    "name": "Яйцо феникса",
    "description": "Редчайшее яйцо с перламутровой чешуёй",
    "rarity": "LIMITED",
    "imageUrl": "/nft/phoenix-egg.svg",
    "sortOrder": 20
  }
].map((gift) => ({ ...gift, supply: gift.rarity === "LIMITED" ? 25 : null }));

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

  console.log("Seeding NFT gifts...");
  for (const gift of NFT_GIFTS) {
    await prisma.nftGift.upsert({ where: { slug: gift.slug }, create: gift, update: { name: gift.name, description: gift.description, rarity: gift.rarity, imageUrl: gift.imageUrl, sortOrder: gift.sortOrder, isActive: true } });
  }
  console.log(`Seeded ${NFT_GIFTS.length} NFT gifts.`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
