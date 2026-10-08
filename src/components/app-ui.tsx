import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, ChevronRight, UserCheck, Search, Trash2, Plus, LogOut, Pencil } from "lucide-react";
import ari from "@/assets/logo_ari-2.png.asset.json";
import { ariFallback, partners } from "@/lib/assets";

export function Footer() { return <footer className="border-t bg-card px-5 py-7 md:px-10"><div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-6 lg:flex-row"><p className="text-xs text-muted-foreground text-center lg:text-left">ARI · Agentes Regionais de Inovação<br />Universidade Estadual de Londrina</p><div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">{partners.map(p => <img key={p.alt} src={p.src} alt={p.alt} className="h-9 max-w-32 object-contain md:h-11" onError={e => { const target = e.currentTarget; if (!target.src.endsWith(p.fallback)) { target.src = p.fallback; } }} />)}</div></div></footer>; }

export function AccountBlocked({ status }: { status: string | null }) {
  const rejected = status === "rejected";
  return <div className="min-h-screen flex flex-col"><main className="flex-1 grid place-items-center p-6"><div className="w-full max-w-lg text-center"><img src={ari.url} alt="ARI — Agente Regional de Inovação" className="w-48 mx-auto object-contain" onError={e => { const t = e.currentTarget; if (!t.src.endsWith(ariFallback)) { t.src = ariFallback; } }} /><div className="app-panel p-7 mt-8"><div className="w-12 h-12 mx-auto rounded-full bg-secondary text-primary grid place-items-center"><UserCheck /></div><h1 className="text-2xl font-bold mt-5">{rejected ? "Acesso não aprovado" : "Cadastro aguardando aprovação"}</h1><p className="text-sm text-muted-foreground mt-3 leading-relaxed">{rejected ? "Sua solicitação foi analisada e permanece sem acesso ao sistema. Entre em contato com o administrador para uma nova análise." : "Sua conta foi criada, mas o acesso aos dados será liberado somente após a aprovação do administrador."}</p><Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}><LogOut /> Sair</Button></div></div></main><Footer /></div>;
}

export function Metric({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string | number; note: string }) { return <div className="app-panel p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><div className="p-2 bg-secondary text-primary rounded"><Icon size={19} /></div></div><p className="text-3xl font-bold mt-4">{value}</p><p className="text-xs text-muted-foreground mt-1">{note}</p></div>; }

export function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) { return <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{title}</h3><Button variant="link" className="p-0 text-xs" onClick={onAction}>{action} <ChevronRight /></Button></div>; }

export function Toolbar({ title, subtitle, action, onAction, readOnly, extra }: { title: string; subtitle: string; action?: string; onAction?: () => void; readOnly?: boolean; extra?: ReactNode }) { return <div className="flex flex-wrap items-end justify-between gap-4 mb-7"><div><h2 className="text-2xl font-bold">{title}</h2><p className="text-sm text-muted-foreground mt-1">{subtitle}</p></div><div className="flex flex-wrap gap-2">{action && !readOnly && <Button onClick={onAction}><Plus />{action}</Button>}{extra}</div></div>; }

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input className="app-field pl-9" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>; }

export function Empty({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>; }

export function RowActions({ edit, remove, readOnly }: { edit: () => void; remove: () => void; readOnly?: boolean | undefined }) { return readOnly ? null : <div className="flex gap-1"><Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={edit}><Pencil /></Button><Button variant="ghost" size="icon" title="Excluir" aria-label="Excluir" onClick={remove}><Trash2 /></Button></div>; }

export function Bar({ label, count, total }: { label: string; count: number; total: number }) { return <div><div className="flex justify-between gap-3 text-xs mb-2"><span className="text-muted-foreground">{label}</span><b>{count}</b></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${total ? count / total * 100 : 0}%` }} /></div></div>; }
