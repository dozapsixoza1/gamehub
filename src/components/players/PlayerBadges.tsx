"use client";
import { Check } from "lucide-react";
export function PlayerBadges({isAdmin,isVerified}:{isAdmin?:boolean;isVerified?:boolean}) {
 return <span className="inline-flex items-center gap-1.5 align-middle"><span className={`player-role ${isAdmin?"player-role-admin":"player-role-default"}`}>{isAdmin?"ADMIN":"ИГРОК"}</span>{isVerified&&<span className="player-verified" title="Подтверждённый аккаунт" aria-label="Подтверждённый аккаунт"><Check size={11} strokeWidth={3}/></span>}</span>;
}