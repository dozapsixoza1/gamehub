"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Save, Settings2 } from "lucide-react";

type Settings = { displayName:string|null; avatarUrl:string|null; theme:string; soundEnabled:boolean; notifications:boolean; language:string };

export default function SettingsPage() {
  const { initData } = useTelegram();
  const [s,setS] = useState<Settings>({displayName:"",avatarUrl:"",theme:"dark",soundEnabled:true,notifications:true,language:"ru"});
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(()=>{ if(!initData)return; fetch("/api/hub?type=settings",{headers:{"x-init-data":initData},cache:"no-store"}).then(r=>r.json()).then(d=>{if(d.settings){setS(d.settings); document.documentElement.dataset.theme=d.settings.theme || "dark";}}).catch(()=>setMessage("Не удалось загрузить настройки")); },[initData]);
  const save = async()=>{
    if(!initData||busy)return; setBusy(true); setMessage("");
    try { const r=await fetch("/api/hub",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"save_settings",...s})}); const d=await r.json(); if(!r.ok)throw new Error(d.error||"Ошибка сохранения"); setS(d.settings); document.documentElement.dataset.theme=d.settings.theme || "dark"; setMessage("Настройки сохранены"); }
    catch(e){setMessage(e instanceof Error?e.message:"Ошибка сети")} finally{setBusy(false)}
  };
  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3"><Settings2 size={25} className="text-white/70"/><div><h1 className="text-2xl font-bold text-white">Настройки</h1><p className="text-xs text-white/40">Профиль и интерфейс GameHub</p></div></div>
    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Профиль игрока</h2>
      <label className="block text-xs text-white/45">Отображаемый никнейм</label><input value={s.displayName||""} onChange={e=>setS({...s,displayName:e.target.value})} maxLength={32} placeholder="Оставь пустым, чтобы использовать Telegram-имя" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/>
      <label className="block text-xs text-white/45">URL аватара</label><input value={s.avatarUrl||""} onChange={e=>setS({...s,avatarUrl:e.target.value})} maxLength={500} placeholder="https://..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/>
    </section>
    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Оформление</h2><label className="block text-xs text-white/45">Тема</label>
      <select value={s.theme} onChange={e=>setS({...s,theme:e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-3 text-white"><option value="dark">Тёмная</option><option value="midnight">Полночь</option><option value="red">Красная</option><option value="light">Светлая</option></select>
    </section>
    <section className="glass rounded-2xl p-4 space-y-4">
      <h2 className="font-semibold text-white">Уведомления и звук</h2>
      <label className="flex items-center justify-between text-sm text-white/75">Звуки в игре<input type="checkbox" checked={s.soundEnabled} onChange={e=>setS({...s,soundEnabled:e.target.checked})}/></label>
      <label className="flex items-center justify-between text-sm text-white/75">Уведомления<input type="checkbox" checked={s.notifications} onChange={e=>setS({...s,notifications:e.target.checked})}/></label>
    </section>
    <section className="glass rounded-2xl p-4 space-y-2"><h2 className="font-semibold text-white">Язык интерфейса</h2><select value={s.language} onChange={e=>setS({...s,language:e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-3 text-white"><option value="ru">Русский</option><option value="en">English</option></select><p className="text-xs text-white/35">Сохранение языка включено; перевод всех экранов ещё требует отдельной локализации.</p></section>
    <button onClick={save} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold py-3 disabled:opacity-50"><Save size={17}/>{busy?"Сохраняем...":"Сохранить настройки"}</button>
    {message&&<p className="text-center text-sm text-white/60">{message}</p>}
  </div>;
}
