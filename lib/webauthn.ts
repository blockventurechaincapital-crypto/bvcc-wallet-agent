'use client'

import { decode as cborDecode } from 'cbor-x'

// ---------------------------------------------------------------------------
// Helpers de encoding
// ---------------------------------------------------------------------------

/** Convierte ArrayBuffer / Uint8Array a string base64url (sin padding) */
function toBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** Convierte string base64url a Uint8Array */
function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + ((4 - (str.length % 4)) % 4),
    '='
  )
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Convierte ArrayBuffer / Uint8Array a string hex con prefijo 0x */
function toHex(buffer: ArrayBuffer | Uint8Array): `0x${string}` {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

/** Convierte Uint8Array a bigint (big-endian) */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0)
  for (const byte of bytes) {
    result = (result << BigInt(8)) | BigInt(byte)
  }
  return result
}

// ---------------------------------------------------------------------------
// Parseo de la clave publica desde authData
// ---------------------------------------------------------------------------

/**
 * Extrae la clave publica P256 (x, y) del authData del attestation.
 *
 * Estructura de authData:
 *   [0..31]  rpIdHash          (32 bytes)
 *   [32]     flags             (1 byte)
 *   [33..36] signCount         (4 bytes)
 *   [37..52] AAGUID            (16 bytes)
 *   [53..54] credentialIdLength (2 bytes, big-endian)
 *   [55..55+credentialIdLength-1] credentialId
 *   [55+credentialIdLength...] COSE public key (CBOR)
 */
function extractPublicKeyFromAuthData(authData: Uint8Array): { pubKeyX: bigint; pubKeyY: bigint } {
  // Saltar: rpIdHash(32) + flags(1) + signCount(4) + AAGUID(16) = 53 bytes
  const credentialIdLength = (authData[53] << 8) | authData[54]
  const coseKeyOffset = 55 + credentialIdLength

  const coseKeyBytes = authData.slice(coseKeyOffset)
  // CBOR decode — cbor-x devuelve un Map o un objeto plano segun mapsAsObjects
  // Usamos Decoder con mapsAsObjects: false para recibir un Map nativo
  const { Decoder } = require('cbor-x') as typeof import('cbor-x')
  const decoder = new Decoder({ mapsAsObjects: false, useRecords: false })
  const coseKey: Map<number, unknown> = decoder.decode(coseKeyBytes)

  // COSE keys: -2 = x (bytes), -3 = y (bytes)
  const xBytes = coseKey.get(-2) as Uint8Array
  const yBytes = coseKey.get(-3) as Uint8Array

  if (!xBytes || !yBytes) {
    throw new Error('No se encontraron las coordenadas x/y en la clave COSE')
  }

  return {
    pubKeyX: bytesToBigInt(xBytes),
    pubKeyY: bytesToBigInt(yBytes),
  }
}

// ---------------------------------------------------------------------------
// Registro WebAuthn
// ---------------------------------------------------------------------------

/**
 * Registra una nueva credencial biometrica (Face ID / huella) en el TPM del
 * dispositivo y devuelve la clave publica P256 junto con el credentialId.
 */
export async function registerWebAuthn(username: string): Promise<{
  pubKeyX: bigint
  pubKeyY: bigint
  credentialId: string
}> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'BVCC Wallet',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // -7 = ES256 = P-256
      ],
      authenticatorSelection: {
        // 'platform' requiere Windows Hello / Touch ID / Face ID configurado.
        // En desarrollo se omite para que Chrome use su gestor de passkeys.
        // En produccion en movil, el browser selecciona platform automaticamente.
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credential) {
    throw new Error('El usuario cancelo el registro o el dispositivo no soporta WebAuthn')
  }

  const response = credential.response as AuthenticatorAttestationResponse

  // El attestationObject esta en CBOR: { fmt, attStmt, authData }
  const attestationObject: Map<string, unknown> = (() => {
    const { Decoder } = require('cbor-x') as typeof import('cbor-x')
    const dec = new Decoder({ mapsAsObjects: false, useRecords: false })
    return dec.decode(new Uint8Array(response.attestationObject))
  })()

  const authData = attestationObject.get('authData') as Uint8Array
  if (!authData) {
    throw new Error('No se encontro authData en el attestationObject')
  }

  const { pubKeyX, pubKeyY } = extractPublicKeyFromAuthData(authData)
  const credentialId = toBase64url(new Uint8Array(credential.rawId))

  return { pubKeyX, pubKeyY, credentialId }
}

// ---------------------------------------------------------------------------
// Conversion DER → (r, s)
// ---------------------------------------------------------------------------

/**
 * Convierte una firma DER (ASN.1) en los componentes r y s como bigint.
 *
 * Formato DER de ECDSA P-256:
 *   30 <total-len>
 *     02 <r-len> <r-bytes>
 *     02 <s-len> <s-bytes>
 *
 * DER puede incluir un byte 0x00 inicial en r o s si su bit mas alto esta activo
 * (regla de enteros con signo en ASN.1). Hay que eliminarlo para obtener los
 * 32 bytes reales del escalar.
 */
function derToRS(der: Uint8Array): { r: bigint; s: bigint } {
  if (der[0] !== 0x30) throw new Error('DER invalido: se esperaba tag SEQUENCE (0x30)')

  let offset = 2 // saltar 0x30 <total-len>

  // Leer r
  if (der[offset] !== 0x02) throw new Error('DER invalido: se esperaba tag INTEGER (0x02) para r')
  const rLen = der[offset + 1]
  offset += 2
  let rBytes = der.slice(offset, offset + rLen)
  // Eliminar byte 0x00 de relleno DER (maximo uno)
  if (rBytes.length === 33 && rBytes[0] === 0x00) rBytes = rBytes.slice(1)
  const r = bytesToBigInt(rBytes)
  offset += rLen

  // Leer s
  if (der[offset] !== 0x02) throw new Error('DER invalido: se esperaba tag INTEGER (0x02) para s')
  const sLen = der[offset + 1]
  offset += 2
  let sBytes = der.slice(offset, offset + sLen)
  if (sBytes.length === 33 && sBytes[0] === 0x00) sBytes = sBytes.slice(1)
  const s = bytesToBigInt(sBytes)

  return { r, s }
}

// ---------------------------------------------------------------------------
// Autenticacion WebAuthn
// ---------------------------------------------------------------------------

/**
 * Usa la clave privada almacenada en el TPM para firmar un challenge.
 *
 * Devuelve:
 * - r, s  — componentes de la firma como bigint, listos para el contrato
 * - authenticatorData, clientDataJSON — bytes raw en hex para SignerWebAuthn
 */
export async function authenticateWebAuthn(
  credentialId: string | null,
  challenge: Uint8Array
): Promise<{
  r: bigint
  s: bigint
  authenticatorData: `0x${string}`
  clientDataJSON: `0x${string}`
}> {
  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = credentialId
    ? [{ id: fromBase64url(credentialId).buffer as ArrayBuffer, type: 'public-key' }]
    : undefined

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      rpId: window.location.hostname,
      ...(allowCredentials ? { allowCredentials } : {}),
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('El usuario cancelo la autenticacion o el dispositivo no soporta WebAuthn')
  }

  const response = assertion.response as AuthenticatorAssertionResponse

  const derSignature = new Uint8Array(response.signature)
  const { r, s: sRaw } = derToRS(derSignature)

  // Normalize to low-S (P256 curve order)
  const P256_N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')
  const s = sRaw > P256_N / 2n ? P256_N - sRaw : sRaw

  return {
    r,
    s,
    authenticatorData: toHex(new Uint8Array(response.authenticatorData)),
    clientDataJSON: toHex(new Uint8Array(response.clientDataJSON)),
  }
}

// ---------------------------------------------------------------------------
// Helpers de localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'bvcc_wallet_credential'

export function saveCredential(credentialId: string, walletAddress: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ credentialId, walletAddress }))
}

export function loadCredential(): { credentialId: string; walletAddress: string } | null {
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : null
}

export function hasCredential(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}
