'use client'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/I18nContext'
import type { Lang } from '@/lib/i18n/translations'

const FLAGS: { lang: Lang; src: string; label: string }[] = [
  { lang: 'en', src: '/flags/en.png', label: 'English' },
  { lang: 'es', src: '/flags/es.png', label: 'Español' },
]

/**
 * `compact` shows one flag instead of both. With only two languages a toggle says
 * everything two buttons do, and the landing header needed the room: it was carrying
 * 14 clickable items.
 *
 * The flag shown is the CURRENT language, not the one you would switch to. Showing the
 * target reads as "this page is in Spanish" to anyone who does not know the convention,
 * which is exactly the wrong message on an English page. The tooltip carries the action.
 *
 * Everywhere else keeps both flags, where the row is quiet and there is no reason to
 * make the reader think.
 */
export default function LanguageSwitcher({
  className = '',
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { lang, setLang } = useI18n()

  if (compact) {
    const current = FLAGS.find(f => f.lang === lang)!
    const next = FLAGS.find(f => f.lang !== lang)!
    return (
      <button
        type="button"
        onClick={() => setLang(next.lang)}
        title={`${current.label} — ${next.label}`}
        aria-label={`Language: ${current.label}. Switch to ${next.label}`}
        className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-full transition-transform duration-300 hover:scale-110 ${className}`}
        // shrink-0 matters: on a narrow header flex squeezes this to an oval.
        style={{ boxShadow: '0 0 0 1px rgba(212,175,55,0.35)', flexShrink: 0 }}
      >
        <Image src={current.src} alt={current.label} fill sizes="24px" style={{ objectFit: 'cover' }} />
      </button>
    )
  }

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
