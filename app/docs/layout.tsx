import DocsSidebar from '@/components/DocsSidebar'

const css = `
.bvccdocs {
  display: flex;
  min-height: 100vh;
  background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.08), transparent 58%), #06080f;
  color: #f0f4f8;
}
.bvccdocs .docs-aside {
  width: 264px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  border-right: 1px solid rgba(255,255,255,0.07);
  padding: 26px 18px 44px;
  background: rgba(9,12,20,0.6);
}
.bvccdocs .docs-brand { display: block; }
.bvccdocs .docs-brand img { height: 84px; width: auto; object-fit: contain; display: block; margin: -10px 0; }
.bvccdocs .docs-kicker {
  font-family: var(--font-plex-mono), monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d4af37;
  margin: 14px 0 4px 10px;
}
.bvccdocs .docs-group { margin-top: 24px; }
.bvccdocs .docs-group-h {
  font-family: var(--font-plex-mono), monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8892a4;
  margin: 0 0 8px 10px;
}
.bvccdocs .docs-nav-link {
  display: block;
  padding: 7px 10px;
  border-radius: 8px;
  color: #8892a4;
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
  transition: color .15s, background .15s;
}
.bvccdocs .docs-nav-link:hover { color: #f0f4f8; background: rgba(255,255,255,0.03); }
.bvccdocs .docs-nav-link.active { color: #d4af37; background: rgba(212,175,55,0.08); font-weight: 600; }
.bvccdocs .docs-content {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 64px;
  justify-content: flex-start;
  padding: 44px 36px 90px 75px;
}
.bvccdocs .docs-article { flex: 1; min-width: 0; max-width: 1040px; }
.bvccdocs .docs-article h2 { scroll-margin-top: 28px; }
.bvccdocs .docs-toc {
  width: 200px;
  flex-shrink: 0;
  margin-left: auto;
  position: sticky;
  top: 44px;
  align-self: flex-start;
  max-height: calc(100vh - 88px);
  overflow-y: auto;
}
.bvccdocs .docs-toc-h {
  font-family: var(--font-plex-mono), monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d4af37;
  margin-bottom: 10px;
}
.bvccdocs .docs-toc-link {
  display: block;
  padding: 5px 0 5px 12px;
  border-left: 2px solid rgba(255,255,255,0.09);
  color: #8892a4;
  font-size: 12.5px;
  line-height: 1.45;
  text-decoration: none;
  transition: color .15s, border-color .15s;
}
.bvccdocs .docs-toc-link:hover { color: #f0f4f8; }
.bvccdocs .docs-toc-link.active { color: #d4af37; border-left-color: #d4af37; }
.bvccdocs .docs-menu-btn { display: none; }
.bvccdocs .docs-backdrop { display: none; }

@media (max-width: 1150px) {
  .bvccdocs .docs-toc { display: none; }
}
@media (max-width: 900px) {
  .bvccdocs .docs-aside {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    height: auto;
    z-index: 50;
    background: #090c14;
    transform: translateX(-100%);
    transition: transform .25s ease;
    box-shadow: 8px 0 32px rgba(0,0,0,0.5);
  }
  .bvccdocs .docs-aside.open { transform: none; }
  .bvccdocs .docs-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 14px; left: 14px;
    z-index: 60;
    width: 40px; height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(212,175,55,0.3);
    background: #0d1117;
    color: #d4af37;
    font-size: 16px;
    cursor: pointer;
  }
  .bvccdocs .docs-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0,0,0,0.55);
  }
  .bvccdocs .docs-content { padding: 70px 18px 70px; }
}
`

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bvccdocs">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <DocsSidebar />
      <div className="docs-content">{children}</div>
    </div>
  )
}
