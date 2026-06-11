// ERC-7739 nested typed-data digest — replica EXACTA de ERC7739Utils.sol (OZ).
//
// ⚠️ NO usar `hashTypedData` de viem/experimental/erc7739 para esto: viem ordena
// los subtipos alfabéticamente (EIP-712 canónico), pero ERC-7739/OZ concatena el
// descriptor del contenido tal cual (tipo primario PRIMERO). Con contenidos
// multi-struct (p.ej. Permit2 PermitSingle+PermitDetails) los digests difieren y
// isValidSignature falla. Verificado con test cruzado:
// test_solidity/test/ERC7739Vector.t.sol (vector generado con este código).
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  toHex,
  type Hex,
  type TypedDataDomain,
} from 'viem'
import { hashStruct as hashStruct_ } from 'viem/utils'

// hashStruct de viem con genéricos relajados (los typed data llegan como JSON dinámico)
const hashStruct = hashStruct_ as (args: {
  data: Record<string, unknown>
  primaryType: string
  types: unknown
}) => Hex

export type TypedDataTypes = Record<string, readonly { name: string; type: string }[]>

export interface VerifierDomain {
  name: string
  version: string
  chainId: number | bigint
  verifyingContract: Hex
  salt: Hex
}

// Dependencias transitivas de un struct (sin el primario), para encodeType
function findTypeDeps(type: string, types: TypedDataTypes, found: Set<string> = new Set()): Set<string> {
  const base = type.match(/^[A-Za-z0-9_]+/)?.[0] ?? type // strip array suffix
  if (found.has(base) || !types[base]) return found
  found.add(base)
  for (const field of types[base]) findTypeDeps(field.type, types, found)
  return found
}

// encodeType EIP-712 canónico: primario primero + dependencias ordenadas
export function encodeType712(primaryType: string, types: TypedDataTypes): string {
  const deps = [...findTypeDeps(primaryType, types)].filter((t) => t !== primaryType).sort()
  return [primaryType, ...deps]
    .map((t) => `${t}(${types[t].map((f) => `${f.type} ${f.name}`).join(',')})`)
    .join('')
}

// Domain separator de la app: solo los campos presentes, en orden EIP-712 estándar
const DOMAIN_FIELDS = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
  { name: 'salt', type: 'bytes32' },
] as const

export function hashAppDomain(domain: TypedDataDomain): Hex {
  const fields = DOMAIN_FIELDS.filter(
    (f) => (domain as Record<string, unknown>)[f.name] !== undefined
  )
  return hashStruct({
    data: domain as Record<string, unknown>,
    primaryType: 'EIP712Domain',
    types: { EIP712Domain: fields },
  })
}

/**
 * Digest anidado ERC-7739 (TypedDataSign) que debe firmar el signer del wallet
 * para que `isValidSignature(appDigest, wrappedSig)` valide en OZ ERC7739.
 *
 * Equivale on-chain a:
 *   appSeparator.toTypedDataHash(
 *     typedDataSignStructHash(contentsDescr, contentsHash, abi.encode(walletDomain))
 *   )
 */
export function erc7739TypedDataDigest(args: {
  domain: TypedDataDomain
  types: TypedDataTypes
  primaryType: string
  message: Record<string, unknown>
  verifierDomain: VerifierDomain
}): Hex {
  const { domain, types, primaryType, message, verifierDomain } = args

  const contentsHash = hashStruct({ data: message, primaryType, types })
  const contentsDescr = encodeType712(primaryType, types)

  // typehash NO canónico: descriptor del contenido concatenado tal cual (OZ/ERC-7739)
  const typehash = keccak256(
    toHex(
      `TypedDataSign(${primaryType} contents,string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)${contentsDescr}`
    )
  )

  const domainBytes = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'bytes32' },
    ],
    [
      keccak256(toHex(verifierDomain.name)),
      keccak256(toHex(verifierDomain.version)),
      BigInt(verifierDomain.chainId),
      verifierDomain.verifyingContract,
      verifierDomain.salt,
    ]
  )

  const structHash = keccak256(
    encodePacked(['bytes32', 'bytes32', 'bytes'], [typehash, contentsHash, domainBytes])
  )
  const appSeparator = hashAppDomain(domain)

  return keccak256(
    encodePacked(['bytes2', 'bytes32', 'bytes32'], ['0x1901', appSeparator, structHash])
  )
}
