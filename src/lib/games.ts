export interface GameInfo {
  id: string;
  name: string;
  description: string;
  status: "active" | "coming_soon";
  players: string; // "4-12" и т.д.
  icon: string; // название иконки из lucide
  gradient: string;
  accentColor: string;
}

export const GAMES: GameInfo[] = [
  {
    id: "mafia",
    name: "Мафия",
    description: "Классическая игра в тёмном городе. Найди мафию до рассвета.",
    status: "active",
    players: "4–12",
    icon: "Skull",
    gradient: "from-red-950 via-red-900 to-black",
    accentColor: "#C41E3A",
  },
  {
    id: "bunker",
    name: "Бункер",
    description: "Кто достоин места в бункере после апокалипсиса?",
    status: "coming_soon",
    players: "4–16",
    icon: "Shield",
    gradient: "from-slate-900 via-zinc-800 to-black",
    accentColor: "#64748B",
  },
  {
    id: "spy",
    name: "Шпион",
    description: "Один из вас — шпион. Найди его, пока он не раскрыл локацию.",
    status: "coming_soon",
    players: "3–8",
    icon: "Eye",
    gradient: "from-indigo-950 via-indigo-900 to-black",
    accentColor: "#6366F1",
  },
  {
    id: "impostor",
    name: "Импостор",
    description: "Среди нас предатель. Голосуй правильно или погибнешь.",
    status: "coming_soon",
    players: "4–10",
    icon: "UserX",
    gradient: "from-violet-950 via-purple-900 to-black",
    accentColor: "#8B5CF6",
  },
  {
    id: "codenames",
    name: "Кодовые имена",
    description: "Угадывай слова по ассоциациям. Не дай соперникам опередить.",
    status: "coming_soon",
    players: "4–8",
    icon: "LayoutGrid",
    gradient: "from-amber-950 via-yellow-900 to-black",
    accentColor: "#F59E0B",
  },
  {
    id: "judgment",
    name: "Судный день",
    description: "Суд присяжных. Докажи невиновность или отправь врага на казнь.",
    status: "coming_soon",
    players: "5–12",
    icon: "Scale",
    gradient: "from-stone-900 via-neutral-800 to-black",
    accentColor: "#A8A29E",
  },
  {
    id: "dark-city",
    name: "Тёмный город",
    description: "Ночь в городе. Роли, секреты и предательства на каждом шагу.",
    status: "coming_soon",
    players: "6–14",
    icon: "Moon",
    gradient: "from-blue-950 via-slate-900 to-black",
    accentColor: "#3B82F6",
  },
  {
    id: "secret-agent",
    name: "Секретный агент",
    description: "Выполни миссию, не раскрыв свою личность.",
    status: "coming_soon",
    players: "3–7",
    icon: "Fingerprint",
    gradient: "from-emerald-950 via-teal-900 to-black",
    accentColor: "#10B981",
  },
  {
    id: "survivors",
    name: "Выжившие",
    description: "После катастрофы остались только вы. Кто дотянет до конца?",
    status: "coming_soon",
    players: "4–10",
    icon: "Flame",
    gradient: "from-orange-950 via-red-900 to-black",
    accentColor: "#F97316",
  },
  {
    id: "alliance",
    name: "Альянс",
    description: "Заключай союзы, предавай и побеждай. Политика чистой воды.",
    status: "coming_soon",
    players: "5–12",
    icon: "Handshake",
    gradient: "from-cyan-950 via-sky-900 to-black",
    accentColor: "#06B6D4",
  },
  {
    id: "hunter-night",
    name: "Ночь охотника",
    description: "Охотник и жертвы. Кто станет добычей этой ночи?",
    status: "coming_soon",
    players: "4–9",
    icon: "Target",
    gradient: "from-rose-950 via-pink-900 to-black",
    accentColor: "#F43F5E",
  },
  {
    id: "truth-or-lie",
    name: "Правда или Ложь",
    description: "Отличай правду от лжи. Один неверный ответ — и ты выбыл.",
    status: "coming_soon",
    players: "3–8",
    icon: "MessageCircleQuestion",
    gradient: "from-fuchsia-950 via-purple-900 to-black",
    accentColor: "#D946EF",
  },
];

export function getGameById(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
