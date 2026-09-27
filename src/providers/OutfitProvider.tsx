import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { CompleteLook } from '@/types/outfit';
type OutfitContextValue = { entries: CompleteLook[]; editVersion: number; add: (entries: CompleteLook[]) => void; markSaved: (id: string) => void; edit: CompleteLook | null; requestEdit: (entry: CompleteLook | null) => void };
const OutfitContext = createContext<OutfitContextValue | null>(null);
export function OutfitProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<CompleteLook[]>([]);
  const [editVersion, setEditVersion] = useState(0);
  const [edit, setEdit] = useState<CompleteLook | null>(null);
  return <OutfitContext.Provider value={{ entries, edit, editVersion, requestEdit: entry => { setEdit(entry); setEditVersion(value => value + 1); },
    add: incoming => setEntries(previous => [...incoming, ...previous.filter(entry => !incoming.some(item => item.id === entry.id))]),
    markSaved: id => setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, saved: true } : entry)),
  }}>{children}</OutfitContext.Provider>;
}
export function useOutfits() {
  const value = useContext(OutfitContext);
  if (!value) throw new Error('OutfitProvider is required');
  return value;
}
