'use client'
import { useState } from 'react'
import { formatGwei, parseGwei } from 'viem'
import { useI18n } from '@/lib/i18n/I18nContext'
import type { GasFees } from '@/lib/gasFees'

/**
 * Panel "Avanzado" para editar la tarifa antes de firmar.
 *
 * El modal de WalletConnect ya lo tenía; enviar y swap no, así que el usuario no
 * podía tocar el gas en las dos pantallas que más usa.
 *
 * Lo que se enseña por defecto es lo que sugiere `lib/gasFees.ts`. Si el usuario
 * no abre el panel, no cambia nada. Si lo edita, manda lo suyo — con el aviso de
 * que el servidor tiene la última palabra: la ruta del bundler valida una banda
 * (suelo sobre el base fee y techo sobre el mercado) y rechaza lo que se salga.
 * Poner una tarifa demasiado baja no cuela: devuelve un 400 y hay que firmar otra
 * vez, que es exactamente lo que debe pasar.
 */
export function GasAdvanced({
  sugerida,
  onChange,
}: {
  sugerida: GasFees | null
  /** null = usar la sugerida; si no, lo que el usuario haya puesto. */
  onChange: (override: GasFees | null) => void
}) {
  const { t } = useI18n()
  const [abierto, setAbierto] = useState(false)
  const [maxFee, setMaxFee] = useState('')
  const [propina, setPropina] = useState('')
  const [error, setError] = useState('')

  if (!sugerida) return null

  const maxFeeVal = maxFee || formatGwei(sugerida.maxFeePerGas)
  const propinaVal = propina || formatGwei(sugerida.maxPriorityFeePerGas)

  function aplicar(nuevoMax: string, nuevaPropina: string) {
    setError('')
    // Sin tocar nada = sin override. Asi el caso normal no depende de parsear texto.
    if (!nuevoMax && !nuevaPropina) { onChange(null); return }
    try {
      const mf = parseGwei(nuevoMax || formatGwei(sugerida!.maxFeePerGas))
      const tip = parseGwei(nuevaPropina || formatGwei(sugerida!.maxPriorityFeePerGas))
      if (mf <= 0n) { setError(t('gas.errZero')); onChange(null); return }
      if (tip > mf) { setError(t('gas.errTipOverMax')); onChange(null); return }
      onChange({ maxFeePerGas: mf, maxPriorityFeePerGas: tip })
    } catch {
      setError(t('gas.errInvalid'))
      onChange(null)
    }
  }

  const campo: React.CSSProperties = {
    width: '100%', padding: '8px 10px', backgroundColor: '#0a0e17',
    border: '1px solid #1c2333', borderRadius: '6px', color: '#f0f4f8',
    fontSize: '12px', fontFamily: 'monospace', outline: 'none',
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: '#8892a4', letterSpacing: '0.04em' }}
      >
        {abierto ? '▾' : '▸'} {t('gas.advanced')}
      </button>

      {abierto && (
        <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #1c2333', borderRadius: '8px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {t('gas.maxFee')}
          </label>
          <input
            style={{ ...campo, marginBottom: '10px' }}
            value={maxFeeVal}
            onChange={(e) => { setMaxFee(e.target.value); aplicar(e.target.value, propina) }}
            inputMode="decimal"
          />

          <label style={{ display: 'block', fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {t('gas.priority')}
          </label>
          <input
            style={campo}
            value={propinaVal}
            onChange={(e) => { setPropina(e.target.value); aplicar(maxFee, e.target.value) }}
            inputMode="decimal"
          />

          {error && <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#fc8181' }}>{error}</p>}

          <p style={{ margin: '10px 0 0', fontSize: '10px', color: '#4a5568', lineHeight: 1.5 }}>
            {t('gas.note')}
          </p>

          {(maxFee || propina) && (
            <button
              type="button"
              onClick={() => { setMaxFee(''); setPropina(''); setError(''); onChange(null) }}
              style={{ marginTop: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: '#63b3ed' }}
            >
              {t('gas.reset')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
