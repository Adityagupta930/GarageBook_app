'use client';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

type Lang = 'en' | 'hi';
const KEY = 'gb_lang';

const T = {
  en: {
    dashboard: 'Dashboard', products: 'Products', newSale: 'New Sale',
    bill: 'Bill', credit: 'Credit', history: 'History', reports: 'Reports',
    owner: 'Owner', staff: 'Staff', fullAccess: 'Full Access', salesOnly: 'Sales Only',
    search: 'Search parts...', addPart: 'Add Part', save: 'Save', cancel: 'Cancel',
    stockAlert: 'Stock Alerts', allGood: 'All stock is fine',
  },
  hi: {
    dashboard: 'डैशबोर्ड', products: 'पार्ट्स', newSale: 'नई बिक्री',
    bill: 'बिल', credit: 'उधार', history: 'इतिहास', reports: 'रिपोर्ट',
    owner: 'मालिक', staff: 'स्टाफ', fullAccess: 'पूरी पहुंच', salesOnly: 'सिर्फ बिक्री',
    search: 'पार्ट खोजें...', addPart: 'पार्ट जोड़ें', save: 'सेव करें', cancel: 'रद्द करें',
    stockAlert: 'स्टॉक अलर्ट', allGood: 'सब स्टॉक ठीक है',
  },
};

export type Translations = typeof T.en;

interface LangCtx { lang: Lang; t: Translations; setLang: (l: Lang) => void; }
const Ctx = createContext<LangCtx>({ lang: 'en', t: T.en as Translations, setLang: () => {} });

export function useLang() { return useContext(Ctx); }

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved === 'en' || saved === 'hi') setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(KEY, l);
  }, []);

  return <Ctx.Provider value={{ lang, t: T[lang] as Translations, setLang }}>{children}</Ctx.Provider>;
}
