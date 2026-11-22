"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/components/layout/TelegramProvider";
import { ArrowLeft, Save, Settings2, Palette, Sparkles, Monitor, Waves, Check, Upload, X, ImagePlus } from "lucide-react";

type Settings = {
  displayName:string|null; avatarUrl:string|null; theme:string; soundEnabled:boolean;
  notifications:boolean; language:string; accentColor:string; compactMode:boolean;
  animations:boolean; backgroundStyle:string; profileBio:string; profileShowcase:string[];
};
const defaults: Settings = {
  displayName:"", avatarUrl:"", theme:"dark", soundEnabled:true, notifications:true,
  language:"ru", accentColor:"ruby", compactMode:false, animations:true, backgroundStyle:"aurora", profileBio:"", profileShowcase:[]
};
const themes = [
  {id:"dark",label:"Graphite",detail:"Классическая тёмная"},
  {id:"midnight",label:"Midnight",detail:"Глубокий синий"},
  {id:"red",label:"Crimson",detail:"Тёмно-красная"},
  {id:"ocean",label:"Abyss",detail:"Океанская"},
  {id:"forest",label:"Emerald",detail:"Лесная"},
  {id:"amoled",label:"AMOLED",detail:"Чистый чёрный"},
  {id:"light",label:"Pearl",detail:"Светлая"},
];
const accents = [
  {id:"ruby",label:"Ruby",color:"#ef4444"},
  {id:"violet",label:"Violet",color:"#a78bfa"},
  {id:"cyan",label:"Ice",color:"#22d3ee"},
  {id:"gold",label:"Gold",color:"#eab308"},
  {id:"emerald",label:"Jade",color:"#10b981"},
];
function applySettings(s: Settings) {
  const root=document.documentElement;
  root.dataset.theme=s.theme||"dark";
  root.dataset.accent=s.accentColor||"ruby";
  root.dataset.background=s.backgroundStyle||"aurora";
  root.dataset.compact=s.compactMode?"true":"false";
  root.dataset.animations=s.animations?"true":"false";
  const tg=(window as any).Telegram?.WebApp;
  const shellColor=s.theme==="light"?"#f5f5f5":s.theme==="ocean"?"#071923":s.theme==="forest"?"#0b1711":s.theme==="amoled"?"#000000":s.theme==="midnight"?"#0a0d1b":s.theme==="red"?"#190909":"#0a0a0a";
  try { tg?.setHeaderColor?.(shellColor); tg?.setBackgroundColor?.(shellColor); } catch {}
}
export default function SettingsPage() {
  const { initData, refreshUser } = useTelegram();
  const [s,setS] = useState<Settings>(defaults);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [avatarPreview,setAvatarPreview] = useState<string | null>(null);
  const [avatarBusy,setAvatarBusy] = useState(false);
  const [achievements,setAchievements] = useState<{id:string;title:string;icon:string}[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!initData)return;
    fetch("/api/progression",{headers:{"x-init-data":initData},cache:"no-store"}).then(r=>r.json()).then(d=>setAchievements((d.achievements||[]).map((a:any)=>({id:a.achievement?.id||a.id,title:a.achievement?.title||"Достижение",icon:a.achievement?.icon||"🏆"})))).catch(()=>{});
    fetch("/api/hub?type=settings",{headers:{"x-init-data":initData},cache:"no-store"})
      .then(r=>r.json()).then(d=>{
        if(d.settings){const next={...defaults,...d.settings};setS(next);applySettings(next);}
      }).catch(()=>setMessage("Не удалось загрузить настройки"));
  },[initData]);
  useEffect(()=>{ if(!avatarPreview) return; return ()=>URL.revokeObjectURL(avatarPreview); },[avatarPreview]);
  const uploadAvatar=async(file?:File)=>{
    if(!file||!initData)return;
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){setMessage("Выбери JPG, PNG, WEBP или GIF");return;}
    if(file.size>5*1024*1024){setMessage("Максимальный размер аватара — 5 МБ");return;}
    setAvatarPreview(URL.createObjectURL(file));setAvatarBusy(true);setMessage("Загружаем аватар...");
    try{
      const form=new FormData();form.append("initData",initData);form.append("file",file);
      const response=await fetch("/api/profile/avatar",{method:"POST",body:form});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Не удалось загрузить аватар");
      setS(old=>({...old,avatarUrl:result.avatarUrl}));setMessage("Аватар обновлён");await refreshUser();
    }catch(error){setMessage(error instanceof Error?error.message:"Ошибка загрузки аватара");setAvatarPreview(null);}
    finally{setAvatarBusy(false);if(fileInput.current)fileInput.current.value="";}
  };
  const removeAvatar=async()=>{
    if(!initData||avatarBusy)return;setAvatarBusy(true);
    try{const form=new FormData();form.append("initData",initData);form.append("action","remove");const response=await fetch("/api/profile/avatar",{method:"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.error||"Не удалось удалить аватар");setS(old=>({...old,avatarUrl:null}));setAvatarPreview(null);setMessage("Используется фото из Telegram");await refreshUser();}
    catch(error){setMessage(error instanceof Error?error.message:"Ошибка");}finally{setAvatarBusy(false);}
  };
  const change=(patch:Partial<Settings>)=>{
    setS(old=>{const next={...old,...patch};applySettings(next);return next;});
    setMessage("Есть несохранённые изменения");
  };
  const save=async()=>{
    if(!initData||busy)return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/hub",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action:"save_settings",...s})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Ошибка сохранения");
      const next={...defaults,...d.settings};setS(next);applySettings(next);setMessage("Настройки сохранены");
    }catch(e){setMessage(e instanceof Error?e.message:"Ошибка сети");}
    finally{setBusy(false);}
  };
  return <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-4">
    <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft size={16}/>Профиль</Link>
    <div className="flex items-center gap-3"><div className="rounded-2xl p-3 bg-primary/15 text-primary"><Settings2 size={24}/></div><div><h1 className="text-2xl font-bold text-white">Персонализация</h1><p className="text-xs text-white/40">Настрой GameHub под себя</p></div></div>

    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Palette size={17}/><h2 className="font-semibold text-white">Тема интерфейса</h2></div>
      <div className="grid grid-cols-2 gap-2">{themes.map(t=><button key={t.id} onClick={()=>change({theme:t.id})} className={`rounded-xl border p-3 text-left transition ${s.theme===t.id?"border-primary bg-primary/10":"border-white/10 bg-white/5"}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{t.label}</span>{s.theme===t.id&&<Check size={15} className="text-primary"/>}</div><p className="text-[11px] text-white/45 mt-1">{t.detail}</p></button>)}</div>
    </section>

    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Sparkles size={17}/><h2 className="font-semibold text-white">Цвет акцента</h2></div>
      <div className="flex flex-wrap gap-3">{accents.map(a=><button key={a.id} onClick={()=>change({accentColor:a.id})} aria-label={a.label} title={a.label} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${s.accentColor===a.id?"border-white scale-110":"border-white/15"}`} style={{backgroundColor:a.color}}>{s.accentColor===a.id&&<Check size={17} className="text-white"/>}</button>)}</div>
    </section>

    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Waves size={17}/><h2 className="font-semibold text-white">Фон приложения</h2></div>
      <div className="grid grid-cols-3 gap-2">{[{id:"aurora",label:"Aurora"},{id:"mesh",label:"Mesh"},{id:"plain",label:"Чистый"}].map(x=><button key={x.id} onClick={()=>change({backgroundStyle:x.id})} className={`rounded-xl p-3 text-xs border ${s.backgroundStyle===x.id?"border-primary bg-primary/10 text-white":"border-white/10 bg-white/5 text-white/60"}`}>{x.label}</button>)}</div>
    </section>

    <section className="glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2"><Monitor size={17}/><h2 className="font-semibold text-white">Поведение интерфейса</h2></div>
      <label className="flex items-center justify-between gap-3 text-sm text-white/75">Компактные карточки<input type="checkbox" checked={s.compactMode} onChange={e=>change({compactMode:e.target.checked})} className="accent-primary w-5 h-5"/></label>
      <label className="flex items-center justify-between gap-3 text-sm text-white/75">Анимации интерфейса<input type="checkbox" checked={s.animations} onChange={e=>change({animations:e.target.checked})} className="accent-primary w-5 h-5"/></label>
      <label className="flex items-center justify-between gap-3 text-sm text-white/75">Звуки в игре<input type="checkbox" checked={s.soundEnabled} onChange={e=>change({soundEnabled:e.target.checked})} className="accent-primary w-5 h-5"/></label>
      <label className="flex items-center justify-between gap-3 text-sm text-white/75">Уведомления<input type="checkbox" checked={s.notifications} onChange={e=>change({notifications:e.target.checked})} className="accent-primary w-5 h-5"/></label>
    </section>

    <section className="glass rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold text-white">Профиль игрока</h2>
      <label className="block text-xs text-white/45">Отображаемый никнейм</label>
      <input value={s.displayName||""} onChange={e=>change({displayName:e.target.value})} maxLength={32} placeholder="Имя из Telegram по умолчанию" className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-white outline-none"/>
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-white/5 grid place-items-center">
          {avatarPreview||s.avatarUrl ? <img src={avatarPreview||s.avatarUrl||""} alt="Предпросмотр аватара" className="h-full w-full object-cover"/> : <ImagePlus size={26} className="text-white/35"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Фото профиля</p>
          <p className="mt-1 text-[11px] text-white/40">Выбери изображение прямо с устройства. JPG, PNG, WEBP или GIF · до 5 МБ.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={()=>fileInput.current?.click()} disabled={avatarBusy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Upload size={14}/>{avatarBusy?"Загрузка...":"Выбрать фото"}</button>
            {s.avatarUrl&&<button type="button" onClick={removeAvatar} disabled={avatarBusy} className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-50"><X size={13}/>Убрать</button>}
          </div>
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e=>uploadAvatar(e.target.files?.[0])}/>
      <p className="text-[11px] text-white/35">После удаления снова будет показываться фотография Telegram.</p>
    </section>
    <section className="glass rounded-2xl p-4 space-y-3"><h2 className="font-semibold text-white">О себе</h2><textarea value={s.profileBio||""} onChange={e=>change({profileBio:e.target.value.slice(0,180)})} maxLength={180} rows={3} placeholder="Расскажи немного о себе..." className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"/><p className="text-right text-[10px] text-white/35">{(s.profileBio||"").length}/180</p><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Избранные достижения</h3><span className="text-[10px] text-white/40">{s.profileShowcase.length}/3</span></div>{achievements.length?achievements.map(a=><label key={a.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 text-sm text-white/80"><input type="checkbox" checked={s.profileShowcase.includes(a.id)} disabled={!s.profileShowcase.includes(a.id)&&s.profileShowcase.length>=3} onChange={e=>change({profileShowcase:e.target.checked?[...s.profileShowcase,a.id]:s.profileShowcase.filter(id=>id!==a.id)})} className="h-4 w-4 accent-primary"/><span>{a.icon}</span><span className="flex-1">{a.title}</span></label>):<p className="text-xs text-white/40">Сначала открой достижения — здесь можно выбрать до трёх.</p>}</section>
    <section className="glass rounded-2xl p-4 space-y-2"><h2 className="font-semibold text-white">Язык интерфейса</h2><select value={s.language} onChange={e=>change({language:e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-3 text-white"><option value="ru">Русский</option><option value="en">English</option></select><p className="text-xs text-white/35">Перевод отдельных экранов ещё требует локализации.</p></section>
    <button onClick={save} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold py-3 disabled:opacity-50"><Save size={17}/>{busy?"Сохраняем...":"Сохранить оформление"}</button>
    {message&&<p className="text-center text-sm text-white/60">{message}</p>}
  </div>;
}
