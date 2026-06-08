'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress } from 'viem'
import { addressBook, type AddressEntry } from '@/lib/addressBook'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
  danger: '#fc8181',
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function AddressBookPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [entries, setEntries] = useState<AddressEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  useEffect(() => {
    setEntries(addressBook.getAll())
  }, [])

  const refresh = () => setEntries(addressBook.getAll())

  const nameValid = name.trim().length > 0
  const addressValid = isAddress(address)

  const handleAdd = () => {
    setFormError('')
    if (!nameValid) { setFormError(t('addressbook.errorNameEmpty')); return }
    if (!addressValid) { setFormError(t('addressbook.errorInvalidAddress')); return }
    try {
      addressBook.add(name.trim(), address)
      setName('')
      setAddress('')
      setShowForm(false)
      refresh()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : t('addressbook.errorSave'))
    }
  }

  const handleRemove = (entry: AddressEntry) => {
    if (!window.confirm(t('addressbook.confirmDelete').replace('{name}', entry.name))) return
    addressBook.remove(entry.address)
    refresh()
  }

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopiedAddress(addr)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const handleSend = (entry: AddressEntry) => {
    router.push(`/wallet/send?to=${entry.address}&name=${encodeURIComponent(entry.name)}`)
  }

  const cancelForm = () => {
    setShowForm(false)
    setName('')
    setAddress('')
    setFormError('')
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: COLORS.bg,
      padding: '32px 24px',
      paddingBottom: '80px',
      maxWidth: '480px',
    }}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: COLORS.textSecondary, fontSize: '13px', padding: '0',
          marginBottom: '28px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = COLORS.textPrimary)}
        onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSecondary)}
      >
        <IconBack />
        {t('addressbook.backBtn')}
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: COLORS.gold }}><IconBook /></span>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: COLORS.textPrimary, letterSpacing: '-0.02em', margin: 0 }}>
            {t('addressbook.title')}
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', backgroundColor: COLORS.gold,
              border: 'none', borderRadius: '6px',
              color: '#000', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <IconPlus />
            {t('addressbook.addContact')}
          </button>
        )}
      </div>

      {/* Inline add form */}
      {showForm && (
        <div style={{
          backgroundColor: COLORS.card,
          border: `1px solid rgba(212,175,55,0.2)`,
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: COLORS.textPrimary, margin: '0 0 16px' }}>
            {t('addressbook.newContact')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: COLORS.textSubtle, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                {t('addressbook.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('addressbook.namePlaceholder')}
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                  backgroundColor: '#06080f',
                  border: `1px solid ${name.length > 0 ? (nameValid ? 'rgba(104,211,145,0.35)' : 'rgba(252,129,129,0.35)') : COLORS.border}`,
                  borderRadius: '6px', color: COLORS.textPrimary, fontSize: '13px', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: COLORS.textSubtle, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                {t('addressbook.addressLabel')}
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                  backgroundColor: '#06080f',
                  border: `1px solid ${address.length > 0 ? (addressValid ? 'rgba(104,211,145,0.35)' : 'rgba(252,129,129,0.35)') : COLORS.border}`,
                  borderRadius: '6px', color: COLORS.textPrimary, fontSize: '13px', fontFamily: 'monospace', outline: 'none',
                }}
              />
            </div>
            {formError && (
              <p style={{ margin: 0, fontSize: '12px', color: COLORS.danger }}>{formError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleAdd}
                style={{
                  flex: 1, padding: '10px',
                  backgroundColor: COLORS.gold, border: 'none', borderRadius: '6px',
                  color: '#000', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  opacity: nameValid && addressValid ? 1 : 0.45,
                }}
              >
                {t('addressbook.saveBtn')}
              </button>
              <button
                onClick={cancelForm}
                style={{
                  flex: 1, padding: '10px',
                  backgroundColor: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: '6px',
                  color: COLORS.textSecondary, fontSize: '13px', cursor: 'pointer',
                }}
              >
                {t('addressbook.cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {entries.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 0',
          color: COLORS.textSubtle, fontSize: '13px',
        }}>
          {t('addressbook.emptyState')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map(entry => (
            <div
              key={entry.address}
              style={{
                backgroundColor: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              {/* Info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: '600', color: COLORS.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </p>
                <p style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', color: COLORS.textSecondary }}>
                  {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Copy */}
                <button
                  onClick={() => handleCopy(entry.address)}
                  title={t('addressbook.titleCopyAddress')}
                  style={{
                    padding: '7px', borderRadius: '5px', border: `1px solid ${COLORS.border}`,
                    backgroundColor: 'transparent', cursor: 'pointer',
                    color: copiedAddress === entry.address ? '#68d391' : COLORS.textSecondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {copiedAddress === entry.address ? <IconCheck /> : <IconCopy />}
                </button>

                {/* Send */}
                <button
                  onClick={() => handleSend(entry)}
                  title={t('addressbook.titleSend')}
                  style={{
                    padding: '7px', borderRadius: '5px', border: `1px solid ${COLORS.border}`,
                    backgroundColor: 'transparent', cursor: 'pointer',
                    color: COLORS.gold,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconSend />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleRemove(entry)}
                  title={t('addressbook.titleDelete')}
                  style={{
                    padding: '7px', borderRadius: '5px', border: '1px solid rgba(252,129,129,0.15)',
                    backgroundColor: 'transparent', cursor: 'pointer',
                    color: COLORS.danger,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
