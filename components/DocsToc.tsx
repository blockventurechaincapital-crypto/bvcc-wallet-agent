'use client'

// "On this page" right-hand table of contents with scrollspy (IntersectionObserver).
import { useEffect, useState } from 'react'

export interface TocItem {
  id: string
  text: string
}

export default function DocsToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      // Activate when the heading enters the top ~30% of the viewport
      { rootMargin: '-60px 0px -70% 0px' }
    )
    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className="docs-toc" aria-label="On this page">
      <div className="docs-toc-h">On this page</div>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`docs-toc-link${activeId === item.id ? ' active' : ''}`}
        >
          {item.text.replace(/`/g, '')}
        </a>
      ))}
    </nav>
  )
}
