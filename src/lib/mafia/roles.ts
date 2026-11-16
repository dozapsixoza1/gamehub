import type { MafiaRole } from "@prisma/client";

export const ROLE_INFO: Record<MafiaRole, {
  name: string;
  team: "mafia" | "civilians" | "neutral";
  description: string;
  nightAction?: string;
}> = {
  CIVILIAN: {
    name: "Мирный житель",
    team: "civilians",
    description: "Днём обсуждай и голосуй. Ночью спишь."
  },
  MAFIA: {
    name: "Мафия",
    team: "mafia",
    description: "Ночью выбираешь цель вместе с мафией.",
    nightAction: "kill"
  },
  DON: {
    name: "Дон",
    team: "mafia",
    description: "Глава мафии. Участвуешь в выборе цели.",
    nightAction: "kill"
  },
  DOCTOR: {
    name: "Доктор",
    team: "civilians",
    description: "Каждую ночь можешь спасти одного игрока.",
    nightAction: "heal"
  },
  SHERIFF: {
    name: "Шериф",
    team: "civilians",
    description: "Проверяешь одного игрока на принадлежность к мафии.",
    nightAction: "check"
  },
  MANIAC: {
    name: "Маньяк",
    team: "neutral",
    description: "Каждую ночь выбираешь игрока для устранения.",
    nightAction: "maniac_kill"
  },
  COURTESAN: {
    name: "Красотка",
    team: "civilians",
    description: "Блокируешь ночное действие выбранного игрока.",
    nightAction: "seduce"
  },
};

export function getDefaultRolesConfig(
  count: number
): Record<string, number> {
  const configs: Record<number, Record<string, number>> = {
    4: { CIVILIAN: 2, MAFIA: 1, DOCTOR: 1 },
    5: { CIVILIAN: 2, MAFIA: 1, DOCTOR: 1, SHERIFF: 1 },
    6: { CIVILIAN: 3, MAFIA: 1, DON: 1, DOCTOR: 1 },
    7: { CIVILIAN: 3, MAFIA: 1, DON: 1, DOCTOR: 1, SHERIFF: 1 },
    8: { CIVILIAN: 3, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1 },
    9: { CIVILIAN: 4, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1 },
    10: { CIVILIAN: 4, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1, MANIAC: 1 },
    11: { CIVILIAN: 5, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1, MANIAC: 1 },
    12: { CIVILIAN: 6, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1, MANIAC: 1 },
  };

  return configs[Math.max(4, Math.min(12, count))] ?? configs[8];
}

export function assignRoles(
  playerIds: string[],
  config: Record<string, number>
): Map<string, MafiaRole> {
  const roles: MafiaRole[] = [];

  for (const [role, amount] of Object.entries(config)) {
    for (let i = 0; i < amount; i++) {
      roles.push(role as MafiaRole);
    }
  }

  while (roles.length < playerIds.length) {
    roles.push("CIVILIAN");
  }

  const shuffled = roles.slice(0, playerIds.length);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return new Map(
    playerIds.map((id, i) => [id, shuffled[i]])
  );
}

export function checkWinCondition(
  players: { role: MafiaRole | null; isAlive: boolean }[]
): "civilians" | "mafia" | "maniac" | null {
  const alive = players.filter(p => p.isAlive);

  const mafia = alive.filter(
    p => p.role === "MAFIA" || p.role === "DON"
  ).length;

  const maniac = alive.filter(
    p => p.role === "MANIAC"
  ).length;

  const others = alive.length - mafia - maniac;

  if (maniac === 1 && alive.length === 1) {
    return "maniac";
  }

  if (mafia === 0 && maniac === 0) {
    return "civilians";
  }

  if (mafia > 0 && mafia >= others + maniac) {
    return "mafia";
  }

  return null;
    }
