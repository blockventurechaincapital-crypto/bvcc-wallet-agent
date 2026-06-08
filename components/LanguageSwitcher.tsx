'use client'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/I18nContext'
import type { Lang } from '@/lib/i18n/translations'

const FLAGS: { lang: Lang; src: string; label: string }[] = [
  { lang: 'en', src: '/flags/en.png', label: 'English' },
  { lang: 'es', src: '/flags/es.png', label: 'Español' },
]

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label="Language">
      {FLAGS.map((f) => (
        <button
          key={f.lang}
          type="button"
          onClick={() => setLang(f.lang)}
          title={f.label}
          aria-label={f.label}
          aria-pressed={lang === f.lang}
          className="relative h-6 w-6 overflow-hidden rounded-full transition-transform duration-300 hover:scale-110"
          style={{
            boxShadow: lang === f.lang ? '0 0 0 2px #d4af37' : 'none',
            opacity: lang === f.lang ? 1 : 0.6,
          }}
        >
          <Image src={f.src} alt={f.label} fill sizes="24px" style={{ objectFit: 'cover' }} />
        </button>
      ))}
    </div>
  )
}
