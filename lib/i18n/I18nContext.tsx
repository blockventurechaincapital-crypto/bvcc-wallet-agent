'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { dict, Lang } from './translations'

type Vars = Record<string, string | number>
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Vars) => string }
const I18nContext = createContext<Ctx | null>(null)

const get = (obj: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Default English always; only a previously saved choice overrides it.
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('language')
    if (saved === 'es' || saved === 'en') {
      setLangState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('language', l)
    document.documentElement.lang = l
  }, [])

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const v = get(dict[lang], key)
      const fallback = typeof v === 'string' ? v : get(dict.en, key)
      const str = typeof fallback === 'string' ? fallback : key
      if (!vars) return str
      return str.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
    },
    [lang]
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const c = useContext(I18nContext)
  if (!c) throw new Error('useI18n must be used within I18nProvider')
  return c
}
