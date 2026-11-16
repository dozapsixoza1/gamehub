"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  useParams,
  useRouter
} from "next/navigation";

import {
  useTelegram
} from "@/components/layout/TelegramProvider";

import {
  Skull,
  Users,
  Copy,
  Check,
  Play,
  LogOut,
  Crown,
  Moon,
  Sun,
  Vote,
  Shield,
  HeartPulse,
  Search,
  Swords,
  RefreshCw
} from "lucide-react";

import { ROLE_INFO } from "@/lib/mafia/roles";
import type { MafiaRole } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  userId: string;
  isAlive: boolean;
  isHost: boolean;
  seatNumber: number | null;
  role: MafiaRole | null;

  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
  };
}

interface Room {
  id: string;
  code: string;
  status: string;
  currentPhase: string | null;
  dayNumber: number;
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  winner: string | null;
  phaseEndsAt: string | null;
  players: Player[];
  myPlayerId: string | null;
  myRole: MafiaRole | null;
  myAction: string | null;
  myTargetId: string | null;
  myVote: string | null;
  voteCount: number;
  sheriffResult: boolean | null;
}

export default function MafiaRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, initData } = useTelegram();

  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [targetId, setTargetId] = useState("");

  const fetchRoom = useCallback(async () => {
    if (!roomId || !initData) return;

    try {
      const qs = new URLSearchParams({
        roomId,
        initData
      });

      const res = await fetch(
        `/api/mafia/room?${qs}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Ошибка загрузки"
        );
      }

      setRoom(data.room);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ошибка загрузки"
      );
    } finally {
      setLoading(false);
    }
  }, [roomId, initData]);

  useEffect(() => {
    fetchRoom();

    const timer = setInterval(
      fetchRoom,
      2500
    );

    return () => clearInterval(timer);
  }, [fetchRoom]);

  const request = async (
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    if (!initData || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch(
        "/api/mafia/room",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            initData,
            action,
            roomId,
            ...extra
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Действие не выполнено"
        );
      }

      setNotice(data.message || "Готово");
      await fetchRoom();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ошибка сети"
      );
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(
        room.code
      );

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        1600
      );
    } catch {
      setError("Не удалось скопировать код");
    }
  };

  const isHost = Boolean(
    room && user?.id === room.hostId
  );

  const isWaiting = room?.status === "WAITING";
  const isNight = room?.status === "NIGHT";
  const isDay = room?.status === "DAY";
  const isVoting = room?.status === "VOTING";
  const isFinished = room?.status === "FINISHED";

  const me = room?.players.find(
    p => p.id === room.myPlayerId
  );

  const aliveTargets = useMemo(
    () =>
      room?.players.filter(
        p =>
          p.isAlive &&
          p.id !== room.myPlayerId
      ) ?? [],
    [room?.players, room?.myPlayerId]
  );

  const roleInfo = room?.myRole
    ? ROLE_INFO[room.myRole]
    : null;

  const roleAction = room?.myRole
    ? ROLE_INFO[room.myRole].nightAction
    : undefined;

  const actionLabel: Record<string, string> = {
    kill: "Выбрать цель мафии",
    heal: "Вылечить игрока",
    check: "Проверить игрока",
    maniac_kill: "Выбрать цель",
    seduce: "Заблокировать игрока"
  };

  const phaseLabel = isNight
    ? "Ночь"
    : isDay
      ? "Обсуждение"
      : isVoting
        ? "Голосование"
        : isFinished
          ? "Игра окончена"
          : "Ожидание игроков";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-white/60 mb-4">
          {error || "Комната не найдена"}
        </p>

        <button
          onClick={() => router.push("/mafia")}
          className="px-6 py-3 bg-white/10 rounded-xl text-white"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-5 pb-10">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-900/40 flex items-center justify-center">
            <Skull className="text-red-400" size={22} />
          </div>

          <div>
            <h1 className="font-bold text-white text-lg">
              Мафия
            </h1>

            <div className="flex items-center gap-2 text-sm text-white/50">
              <span className="font-mono tracking-widest">
                {room.code}
              </span>

              <button onClick={copyCode}>
                {copied
                  ? <Check size={14} className="text-green-400" />
                  : <Copy size={14} />
                }
              </button>
            </div>
          </div>
        </div>

        {isWaiting && (
          <button
            onClick={() => request("leave")}
            disabled={busy}
            className="p-2.5 rounded-xl bg-white/5 text-white/60"
          >
            <LogOut size={18} />
          </button>
        )}
      </header>

      <section
        className={cn(
          "rounded-2xl p-4 mb-5 flex items-center gap-3 border",
          isNight
            ? "bg-indigo-950/50 border-indigo-900/40"
            : isVoting
              ? "bg-amber-950/40 border-amber-900/40"
              : "bg-white/5 border-white/10"
        )}
      >
        {isNight
          ? <Moon className="text-indigo-300" size={22} />
          : <Sun className="text-amber-300" size={22} />
        }

        <div className="flex-1">
          <div className="font-semibold text-white">
            {phaseLabel}
            {room.dayNumber > 0
              ? ` · Раунд ${room.dayNumber}`
              : ""
            }
          </div>

          <div className="text-sm text-white/50">
            {isNight
              ? "Роли выполняют ночные действия"
              : isDay
                ? "Обсудите результаты ночи"
                : isVoting
                  ? `Голосов подано: ${room.voteCount}`
                  : isFinished
                    ? room.winner === "mafia"
                      ? "Победила мафия"
                      : room.winner === "maniac"
                        ? "Победил маньяк"
                        : "Победили мирные"
                    : "Ожидание начала игры"
            }
          </div>
        </div>

        <button
          onClick={fetchRoom}
          className="p-2 text-white/40"
        >
          <RefreshCw size={16} />
        </button>
      </section>

      {roleInfo && !isWaiting && (
        <section className="glass rounded-2xl p-4 mb-5 border-l-4 border-red-500">
          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-1">
            Твоя роль
          </div>

          <div className="text-lg font-bold text-white">
            {roleInfo.name}
          </div>

          <p className="text-sm text-white/55 mt-1">
            {roleInfo.description}
          </p>

          {(room.myRole === "MAFIA" ||
            room.myRole === "DON") && (
            <p className="text-xs text-red-300 mt-2">
              Союзники:{" "}
              {room.players
                .filter(
                  p =>
                    p.isAlive &&
                    (p.role === "MAFIA" ||
                      p.role === "DON")
                )
                .map(
                  p => p.user.firstName || "Игрок"
                )
                .join(", ") || "Скрыты"}
            </p>
          )}
        </section>
      )}

      {isNight && me?.isAlive && roleAction && (
        <section className="glass rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3 text-white font-semibold">
            {roleAction === "heal"
              ? <HeartPulse size={18} />
              : roleAction === "check"
                ? <Search size={18} />
                : roleAction === "seduce"
                  ? <Shield size={18} />
                  : <Swords size={18} />
            }

            {actionLabel[roleAction]}
          </div>

          <div className="space-y-2">
            {aliveTargets.map(p => (
              <button
                key={p.id}
                onClick={() => setTargetId(p.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left border transition",
                  targetId === p.id
                    ? "border-red-500 bg-red-950/40 text-white"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                {p.user.firstName ||
                  p.user.username ||
                  "Игрок"
                }

                {p.user.lastName
                  ? ` ${p.user.lastName}`
                  : ""
                }

                <span className="text-white/30 text-xs">
                  {" "}· #{p.seatNumber}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              request("night_action", { targetId })
            }
            disabled={!targetId || busy}
            className="w-full mt-3 py-3 rounded-xl bg-red-800 text-white font-semibold disabled:opacity-40"
          >
            {room.myAction
              ? "Изменить действие"
              : "Подтвердить выбор"
            }
          </button>

          {room.myAction && (
            <p className="text-xs text-green-300 mt-2">
              Твоё действие сохранено. До завершения ночи его можно изменить.
            </p>
          )}
        </section>
      )}

      {isNight && me?.isAlive && !roleAction && (
        <p className="glass rounded-xl p-4 mb-5 text-sm text-white/50">
          Твоя роль ночью не действует. Дождись утра.
        </p>
      )}

      {isDay && (
        <section className="glass rounded-2xl p-4 mb-5">
          <p className="text-sm text-white/60 mb-3">
            Обсудите, кто может быть мафией. Когда будете готовы, ведущий запускает голосование.
          </p>

          {isHost && (
            <button
              onClick={() => request("start_voting")}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-amber-700 text-white font-semibold disabled:opacity-40"
            >
              Начать голосование
            </button>
          )}
        </section>
      )}

      {isVoting && me?.isAlive && (
        <section className="glass rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 text-white font-semibold mb-3">
            <Vote size={18} />
            Кого исключить?
          </div>

          <div className="space-y-2">
            {aliveTargets.map(p => (
              <button
                key={p.id}
                onClick={() => setTargetId(p.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left border",
                  targetId === p.id
                    ? "border-amber-500 bg-amber-950/40 text-white"
                    : "border-white/10 bg-white/5 text-white/70"
                )}
              >
                {p.user.firstName ||
                  p.user.username ||
                  "Игрок"
                }

                {p.user.lastName
                  ? ` ${p.user.lastName}`
                  : ""
                }

                <span className="text-white/30 text-xs">
                  {" "}· #{p.seatNumber}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              request("vote", {
                targetId: targetId || null
              })
            }
            disabled={busy}
            className="w-full mt-3 py-3 rounded-xl bg-amber-700 text-white font-semibold disabled:opacity-40"
          >
            {room.myVote
              ? "Изменить голос"
              : "Подтвердить голос"
            }
          </button>

          <p className="text-xs text-white/40 mt-2">
            {room.myVote
              ? "Твой голос учтён. Его можно изменить до конца голосования."
              : "Можно пропустить голос, оставив цель пустой."
            }
          </p>
        </section>
      )}

      {isVoting && isHost && (
        <button
          onClick={() => request("resolve_voting")}
          disabled={busy}
          className="w-full mb-5 py-3 rounded-xl bg-white/10 text-white font-semibold"
        >
          Завершить голосование
        </button>
      )}

      {isNight && isHost && (
        <button
          onClick={() => request("resolve_night")}
          disabled={busy}
          className="w-full mb-5 py-3 rounded-xl bg-indigo-700 text-white font-semibold"
        >
          Завершить ночь и открыть день
        </button>
      )}

      {room.myRole === "SHERIFF" &&
        room.sheriffResult !== null && (
          <div className="rounded-xl p-3 mb-5 bg-blue-950/40 border border-blue-900/40 text-sm text-blue-200">
            Результат проверки:{" "}
            {room.sheriffResult
              ? "цель состоит в мафии"
              : "цель не состоит в мафии"
            }.
          </div>
        )}

      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3 text-sm text-white/50">
          <Users size={16} />
          Игроки · {room.players.length}/{room.maxPlayers}
        </div>

        <div className="space-y-2">
          {room.players.map(p => (
            <div
              key={p.id}
              className={cn(
                "glass rounded-xl px-4 py-3 flex items-center gap-3",
                !p.isAlive && "opacity-50"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                {p.user.firstName?.[0] || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-white truncate">
                    {p.user.firstName ||
                      p.user.username ||
                      "Игрок"
                    }

                    {p.user.lastName
                      ? ` ${p.user.lastName}`
                      : ""
                    }
                  </span>

                  {p.isHost && (
                    <Crown
                      size={14}
                      className="text-amber-400"
                    />
                  )}

                  {p.id === room.myPlayerId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                      ты
                    </span>
                  )}
                </div>

                {!p.isAlive && (
                  <span className="text-xs text-red-400">
                    Выбыл ·{" "}
                    {p.role
                      ? ROLE_INFO[p.role].name
                      : "роль скрыта"
                    }
                  </span>
                )}

                {p.isAlive &&
                  (room.myRole === "MAFIA" ||
                    room.myRole === "DON") &&
                  p.role &&
                  p.id !== room.myPlayerId && (
                    <span className="text-xs text-red-300">
                      Союзник мафии
                    </span>
                  )}
              </div>

              <span className="text-xs text-white/30 font-mono">
                #{p.seatNumber}
              </span>
            </div>
          ))}
        </div>
      </section>

      {isWaiting && isHost && (
        <button
          onClick={() => request("start")}
          disabled={
            busy ||
            room.players.length < room.minPlayers
          }
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-700 to-red-900 text-white font-semibold py-4 rounded-2xl disabled:opacity-40"
        >
          <Play size={19} />
          Начать игру{" "}
          {room.players.length < room.minPlayers
            ? `(нужно ${room.minPlayers})`
            : ""
          }
        </button>
      )}

      {isWaiting && !isHost && (
        <p className="text-center text-white/40 text-sm py-4">
          Ожидание ведущего...
        </p>
      )}

      {isFinished && (
        <button
          onClick={() => router.push("/mafia")}
          className="w-full py-3 rounded-xl bg-white/10 text-white"
        >
          В меню мафии
        </button>
      )}

      {notice && (
        <p className="text-green-300 text-sm text-center mt-4">
          {notice}
        </p>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center mt-4">
          {error}
        </p>
      )}

      {isWaiting && (
        <p className="text-center text-white/30 text-xs mt-5">
          Отправь друзьям код комнаты:{" "}
          <span className="font-mono text-white/60">
            {room.code}
          </span>
        </p>
      )}
    </main>
  );
        }
