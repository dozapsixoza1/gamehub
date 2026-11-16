import type { MafiaRole } from "@prisma/client";

export const ROLE_INFO: Record<
  MafiaRole,
  { name: string; team: "mafia" | "civilians" | "neutral"; description: string; nightAction?: string }
> = {
  CIVILIAN: {
    name: "Мирный житель",
    team: "civilians",
    description: "Обычный житель города. Днём голосует, ночью спит.",
  },
  MAFIA: {
    name: "Мафия",
    team: "mafia",
    description: "Член мафии. Ночью вместе с командой выбирает жертву.",
    nightAction: "kill",
  },
  DON: {
    name: "Дон",
    team: "mafia",
    description: "Глава мафии. Голос мафии при убийстве имеет приоритет.",
    nightAction: "kill",
  },
  DOCTOR: {
    name: "Доктор",
    team: "civilians",
    description: "Каждую ночь может вылечить одного игрока (включая себя).",
    nightAction: "heal",
  },
  SHERIFF: {
    name: "Шериф",
    team: "civilians",
    description: "Ночью проверяет игрока: мафия это или нет.",
    nightAction: "check",
  },
  MANIAC: {
    name: "Маньяк",
    team: "neutral",
    description: "Убивает ночью. Побеждает, если остаётся один.",
    nightAction: "maniac_kill",
  },
  COURTESAN: {
    name: "Красотка",
    team: "civilians",
    description: "Ночью блокирует действие одного игрока.",
    nightAction: "seduce",
  },
};

/** Рекомендуемая конфигурация ролей по количеству игроков */
export function getDefaultRolesConfig(playerCount: number): Record<string, number> {
  if (playerCount <= 4) {
    return { CIVILIAN: 2, MAFIA: 1, DOCTOR: 1 };
  }
  if (playerCount === 5) {
    return { CIVILIAN: 2, MAFIA: 1, DOCTOR: 1, SHERIFF: 1 };
  }
  if (playerCount === 6) {
    return { CIVILIAN: 3, MAFIA: 1, DON: 1, DOCTOR: 1 };
  }
  if (playerCount === 7) {
    return { CIVILIAN: 3, MAFIA: 1, DON: 1, DOCTOR: 1, SHERIFF: 1 };
  }
  if (playerCount === 8) {
    return { CIVILIAN: 3, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1 };
  }
  if (playerCount === 9) {
    return { CIVILIAN: 4, MAFIA: 2, DON: 1, DOCTOR: 1, SHERIFF: 1 };
  }
  // 10+
  return {
    CIVILIAN: playerCount - 6,
    MAFIA: 2,
    DON: 1,
    DOCTOR: 1,
    SHERIFF: 1,
    MANIAC: 1,
  };
}

/** Раздача ролей */
export function assignRoles(
  playerIds: string[],
  config: Record<string, number>
): Map<string, MafiaRole> {
  const roles: MafiaRole[] = [];

  for (const [role, count] of Object.entries(config)) {
    for (let i = 0; i < count; i++) {
      roles.push(role as MafiaRole);
    }
  }

  // Добиваем мирными, если не хватило
  while (roles.length < playerIds.length) {
    roles.push("CIVILIAN");
  }

  // Обрезаем, если слишком много
  const finalRoles = roles.slice(0, playerIds.length);

  // Перемешиваем
  for (let i = finalRoles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [finalRoles[i], finalRoles[j]] = [finalRoles[j], finalRoles[i]];
  }

  const map = new Map<string, MafiaRole>();
  playerIds.forEach((id, idx) => {
    map.set(id, finalRoles[idx]);
  });

  return map;
}

export function checkWinCondition(
  players: { role: MafiaRole | null; isAlive: boolean }[]
): "civilians" | "mafia" | "maniac" | null {
  const alive = players.filter((p) => p.isAlive);
  const mafiaAlive = alive.filter(
    (p) => p.role === "MAFIA" || p.role === "DON"
  ).length;
  const maniacAlive = alive.filter((p) => p.role === "MANIAC").length;
  const civiliansAlive = alive.length - mafiaAlive - maniacAlive;

  if (mafiaAlive === 0 && maniacAlive === 0) return "civilians";
  if (mafiaAlive >= civiliansAlive + maniacAlive) return "mafia";
  if (maniacAlive === 1 && alive.length === 1) return "maniac";

  return null;
}
