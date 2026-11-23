"use client";
import { Check } from "lucide-react";

const STAFF_LABELS: Record<string, string> = {
  deputy_owner: "ЗАМ. ВЛАДЕЛЬЦА",
  admin_head: "РУКОВОДИТЕЛЬ АДМИНИСТРАЦИИ",
  deputy_head: "ЗАМ. РУКОВОДИТЕЛЯ",
  chief_admin: "ГЛАВНЫЙ АДМИН",
  senior_admin: "СТАРШИЙ АДМИН",
  admin: "АДМИНИСТРАТОР",
  junior_admin: "МЛАДШИЙ АДМИН",
  moderator: "МОДЕРАТОР",
  support: "ПОДДЕРЖКА",
  event_manager: "МЕНЕДЖЕР СОБЫТИЙ",
  trainee: "СТАЖЁР",
};

export function PlayerBadges({isAdmin,isVerified,staffRole}:{isAdmin?:boolean;isVerified?:boolean;staffRole?:string|null}) {
  const label = isAdmin ? "ADMIN" : (staffRole ? STAFF_LABELS[staffRole] || "СОТРУДНИК" : "ИГРОК");
  const staff = !isAdmin && !!staffRole;
  return <span className="inline-flex items-center gap-1.5 align-middle">
    <span className={`player-role ${isAdmin ? "player-role-admin" : staff ? "player-role-admin" : "player-role-default"}`}>{label}</span>
    {(isVerified || isAdmin || staff) && <span className="player-verified" title={isAdmin ? "Владелец проекта" : staff ? "Сотрудник администрации" : "Подтверждённый аккаунт"} aria-label="Подтверждённый аккаунт"><Check size={11} strokeWidth={3}/></span>}
  </span>;
}