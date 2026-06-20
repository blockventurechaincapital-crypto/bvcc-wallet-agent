'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ConnectButton from '@/components/ConnectButton'
import WalletConnectButton from '@/components/WalletConnectButton'
import NetworkSelector from '@/components/NetworkSelector'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useNetwork } from '@/lib/NetworkContext'
import { useWalletType } from '@/lib/useWalletType'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  sidebar: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
  activeNav: 'rgba(212,175,55,0.08)',
}

function IconAssets() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function IconAddressBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M16 8h2M16 12h2M16 16h2" />
      <circle cx="9" cy="9" r="2.5" />
      <path d="M5 18c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </svg>
  )
}

function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  )
}

function IconBridge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18V12a8 8 0 0 1 16 0v6" />
      <path d="M2 18h20" />
      <path d="M4 18v2M20 18v2" />
    </svg>
  )
}

function IconDapps() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconDisconnect() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  disabled: boolean
  badge?: string
}

function IconAgent() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9 18h6" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconLiquidity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z" />
      <path d="M9 14a3 3 0 0 0 3 3" />
    </svg>
  )
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { network } = useNetwork()
  const { walletType } = useWalletType()
  const { t } = useI18n()
  const [address, setAddress] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const navSections = useMemo(() => {
    const defiItems: NavItem[] = [
      { label: t('nav.swap'), href: '/wallet/swap', icon: <IconSwap />, disabled: false },
      { label: t('nav.positions'), href: '/wallet/positions', icon: <IconLiquidity />, disabled: false },
      { label: t('nav.dapps'), href: '/wallet/dapps', icon: <IconDapps />, disabled: false },
    ]
    if (walletType === 1) {
      defiItems.push({ label: t('nav.agents'), href: '/wallet/agents', icon: <IconAgent />, disabled: false })
    }
    defiItems.push({ label: t('nav.bridge'), href: '/wallet/bridge', icon: <IconBridge />, disabled: true, badge: t('nav.comingSoon') })
    return [
      {
        label: t('nav.sectionWallet'),
        items: [
          { label: t('nav.overview'), href: '/wallet', icon: <IconAssets />, disabled: false },
          { label: t('nav.transactions'), href: '/wallet/transactions', icon: <IconHistory />, disabled: false },
          { label: t('nav.allowances'), href: '/wallet/allowances', icon: <IconShield />, disabled: false },
          { label: t('nav.addressBook'), href: '/wallet/address-book', icon: <IconAddressBook />, disabled: false },
        ] as NavItem[],
      },
      { label: t('nav.sectionDefi'), items: defiItems },
      {
        label: t('nav.sectionSettings'),
        items: [
          { label: t('nav.settings'), href: '/wallet/settings', icon: <IconSettings />, disabled: false },
        ] as NavItem[],
      },
    ]
  }, [walletType, t])

  const mobileNavItems = useMemo(() => {
    const items: NavItem[] = [
      { label: t('nav.mobileOverview'), href: '/wallet', icon: <IconAssets />, disabled: false },
      { label: t('nav.mobileTransactions'), href: '/wallet/transactions', icon: <IconHistory />, disabled: false },
      { label: t('nav.mobileSwap'), href: '/wallet/swap', icon: <IconSwap />, disabled: false },
      { label: t('nav.mobileDapps'), href: '/wallet/dapps', icon: <IconDapps />, disabled: false },
    ]
    if (walletType === 1) {
      items.push({ label: t('nav.mobileAgents'), href: '/wallet/agents', icon: <IconAgent />, disabled: false })
    }
    items.push({ label: t('nav.mobileSettings'), href: '/wallet/settings', icon: <IconSettings />, disabled: false })
    return items
  }, [walletType, t])

  useEffect(() => {
    try {
      const credential = JSON.parse(localStorage.getItem('bvcc_wallet_credential') || '{}')
      const activeWallet = localStorage.getItem('bvcc_active_wallet')
      const addr = credential?.walletAddress || activeWallet || ''
      if (addr) setAddress(addr)
    } catch {
      // ignore
    }
  }, [])

  const shortAddress = address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address || '0x0000...0000'

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = () => {
    localStorage.removeItem('bvcc_wallet_credential')
    localStorage.removeItem('bvcc_active_wallet')
    router.push('/')
  }

  const isActive = (href: string) => {
    if (href === '/wallet') return pathname === '/wallet'
    return pathname.startsWith(href)
  }

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; }
        }
        * { box-sizing: border-box; }
        .wallet-sidebar {
          display: none;
        }
        @media (min-width: 768px) {
          .wallet-sidebar {
            display: flex !important;
          }
          .wallet-main {
            /* sin margin-left — el sidebar es parte del flujo flex */
          }
        }
        .wallet-bottom-nav {
          display: flex;
        }
        @media (min-width: 768px) {
          .wallet-bottom-nav {
            display: none !important;
          }
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-decoration: none;
          letter-spacing: 0.01em;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .nav-item:hover:not(.disabled) {
          background: rgba(212,175,55,0.06);
        }
        .nav-item.active {
          background: rgba(212,175,55,0.08);
          color: #D4AF37;
        }
        .nav-item.disabled {
          cursor: default;
          opacity: 0.38;
        }
        .disconnect-btn:hover {
          background: rgba(229,62,62,0.08) !important;
          color: #fc8181 !important;
        }
        .disconnect-btn:hover svg {
          stroke: #fc8181;
        }
        /* Mobile bottom nav hover */
        .bottom-nav-item:hover:not(.disabled) {
          color: #D4AF37 !important;
        }
        /* Version badge — fijo abajo a la derecha, oculto en móvil (choca con bottom nav) */
        .wallet-version-badge {
          display: none;
        }
        @media (min-width: 768px) {
          .wallet-version-badge {
            display: block;
          }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: COLORS.bg }}>

        {/* Sidebar — desktop only */}
        <aside
          className="wallet-sidebar"
          style={{
            width: '240px',
            flexShrink: 0,
            backgroundColor: COLORS.sidebar,
            borderRight: `1px solid ${COLORS.border}`,
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            zIndex: 50,
          }}
        >
          {/* Logo area */}
          <div style={{
            padding: '24px 20px 20px',
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: COLORS.gold, letterSpacing: '-0.02em' }}>BVCC</span>
              <span style={{ fontSize: '13px', fontWeight: '400', color: COLORS.textSubtle, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Wallet</span>
            </div>

            {/* Address row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: COLORS.textSecondary }}>{shortAddress}</span>
              <button
                onClick={copyAddress}
                title={t('nav.copyAddress')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: copied ? COLORS.gold : COLORS.textSubtle,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s',
                }}
              >
                <IconCopy />
              </button>
            </div>

            {/* Network badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: network.color,
                display: 'inline-block',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '11px', color: COLORS.textSubtle, letterSpacing: '0.04em' }}>{network.shortName}</span>
            </div>

          </div>

          {/* Navigation */}
          <nav style={{ padding: '12px 12px', flex: 1, overflowY: 'auto' }}>
            {navSections.map((section, sectionIndex) => (
              <div key={section.label} style={{ marginBottom: sectionIndex < navSections.length - 1 ? '4px' : 0 }}>
                {/* Section label */}
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: COLORS.textSubtle,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '10px 12px 4px',
                  marginTop: sectionIndex > 0 ? '8px' : 0,
                }}>
                  {section.label}
                </div>

                {/* Section items */}
                {section.items.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => !item.disabled && router.push(item.href)}
                    className={`nav-item${isActive(item.href) ? ' active' : ''}${item.disabled ? ' disabled' : ''}`}
                    style={{
                      color: isActive(item.href)
                        ? COLORS.gold
                        : item.disabled
                        ? COLORS.textSubtle
                        : COLORS.textSecondary,
                    }}
                  >
                    <span style={{
                      color: isActive(item.href)
                        ? COLORS.gold
                        : item.disabled
                        ? COLORS.textSubtle
                        : COLORS.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(212,175,55,0.08)',
                        color: COLORS.gold,
                        letterSpacing: '0.03em',
                        border: `1px solid rgba(212,175,55,0.2)`,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}

                {/* Separator between sections */}
                {sectionIndex < navSections.length - 1 && (
                  <div style={{
                    height: '1px',
                    backgroundColor: COLORS.border,
                    margin: '10px 4px 0',
                  }} />
                )}
              </div>
            ))}
          </nav>

          {/* Disconnect */}
          <div style={{ padding: '12px', borderTop: `1px solid ${COLORS.border}` }}>
            <button
              onClick={handleDisconnect}
              className="nav-item disconnect-btn"
              style={{ color: COLORS.textSubtle }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>
                <IconDisconnect />
              </span>
              {t('nav.disconnect')}
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Topbar */}
          <div style={{
            height: '52px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            gap: '12px',
            flexShrink: 0,
            backgroundColor: COLORS.bg,
          }}>
            <LanguageSwitcher />
            <WalletConnectButton />
            <NetworkSelector />
            <ConnectButton />
          </div>
          <div className="wallet-main" style={{ flex: 1, overflowY: 'auto' }}>
            {children}
          </div>
        </div>

        {/* Mobile bottom navigation */}
        <nav
          className="wallet-bottom-nav"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: COLORS.sidebar,
            borderTop: `1px solid ${COLORS.border}`,
            zIndex: 50,
            height: '56px',
          }}
        >
          {mobileNavItems.map((item) => (
            <button
              key={item.href}
              onClick={() => !item.disabled && router.push(item.href)}
              className={`bottom-nav-item${item.disabled ? ' disabled' : ''}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: item.disabled ? 'default' : 'pointer',
                color: isActive(item.href)
                  ? COLORS.gold
                  : item.disabled
                  ? COLORS.textSubtle
                  : COLORS.textSecondary,
                opacity: item.disabled ? 0.38 : 1,
                transition: 'color 0.15s',
              }}
            >
              {item.icon}
              <span style={{ fontSize: '9px', letterSpacing: '0.03em', fontWeight: 500 }}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Version badge — siempre visible abajo a la derecha (desktop) */}
        <div
          className="wallet-version-badge"
          style={{
            position: 'fixed',
            bottom: '10px',
            right: '14px',
            zIndex: 40,
            fontSize: '11px',
            fontFamily: 'monospace',
            color: COLORS.textSubtle,
            letterSpacing: '0.04em',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          BVCC Wallet · {t('settings.version')}
        </div>
      </div>
    </>
  )
}
