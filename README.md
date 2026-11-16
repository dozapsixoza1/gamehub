# Игровой Хаб — Telegram Mini App

Полноценный игровой хаб внутри Telegram с классической Мафией, магазином, валютой и админкой.

## Стек

- **Next.js 15** (App Router) + TypeScript + Tailwind
- **grammY** — Telegram-бот (webhook)
- **@telegram-apps/sdk-react** + Telegram UI
- **Prisma** + PostgreSQL (Supabase / Vercel Postgres)
- Lucide icons

## Возможности

### Mini App
- Список 12 игр (Мафия — активна, остальные «Скоро...»)
- Красивый тёмный UI без дефолтных эмодзи
- Магазин с категориями (Мафия / Общее / Бусты)
- Профиль + активация промокодов
- Баланс монет и гемов

### Мафия (классика)
- Создание / вход в комнату по коду
- Роли: Мирный, Мафия, Дон, Доктор, Шериф, Маньяк, Красотка
- Автоматическая раздача ролей по количеству игроков
- Фазы: Ночь → День → Голосование
- Polling состояния комнаты (легко заменить на Supabase Realtime)

### Бот
- `/start` — открыть Mini App
- `/balance` — баланс
- `/promo КОД` — активировать промокод
- **Админ-панель** (`/admin`):
  - Создание промокодов (пошагово)
  - Список промокодов
  - Выдача валюты (`/give TELEGRAM_ID coins|gems N`)
  - Статистика

## Быстрый старт

### 1. Клонируй и установи

```bash
cd tg-games-app
npm install
```

### 2. Настрой окружение

```bash
cp .env.example .env.local
```

Заполни:
- `BOT_TOKEN` — от @BotFather
- `ADMIN_TELEGRAM_IDS` — твой числовой Telegram ID
- `DATABASE_URL` — Postgres (удобнее всего Supabase)
- `NEXT_PUBLIC_APP_URL` — URL после деплоя

### 3. База данных

```bash
npx prisma db push
npx tsx prisma/seed.ts   # товары в магазин
```

### 4. Локальная разработка

```bash
npm run dev
```

Для тестирования Mini App нужен HTTPS-туннель (ngrok / cloudflared):

```bash
npx ngrok http 3000
```

В @BotFather → Bot Settings → Menu Button / Configure Mini App укажи URL туннеля.

### 5. Webhook бота (после деплоя)

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/bot
```

## Деплой на Vercel

1. Залей репозиторий на GitHub
2. Import в Vercel
3. Добавь Environment Variables (все из `.env.example`)
4. Deploy
5. Установи webhook (см. выше)
6. В BotFather привяжи Mini App URL

## Структура

```
src/
├── app/
│   ├── (main)/           # страницы с нижней навигацией
│   │   ├── page.tsx      # список игр
│   │   ├── shop/         # магазин
│   │   ├── profile/      # профиль + промо
│   │   └── mafia/
│   │       ├── page.tsx          # лобби
│   │       └── [roomId]/page.tsx # комната
│   └── api/
│       ├── auth/         # валидация Telegram initData
│       ├── bot/          # webhook grammY
│       ├── shop/         # магазин
│       ├── promo/        # промокоды
│       └── mafia/room/   # комнаты Мафии
├── components/
├── lib/
│   ├── bot.ts            # логика бота + админка
│   ├── mafia/roles.ts    # роли и win-condition
│   ├── games.ts          # список игр
│   └── telegram.ts       # валидация initData
└── types/
```

## Что дальше (улучшения)

- [ ] Полноценные ночные действия (выбор цели в UI)
- [ ] Дневное голосование в UI
- [ ] Supabase Realtime вместо polling
- [ ] Таймеры фаз на сервере
- [ ] История игр и рейтинг
- [ ] Больше ролей и режимов

## Лицензия

MIT
