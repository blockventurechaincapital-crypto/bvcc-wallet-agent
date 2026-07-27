import type { Address } from 'viem'

// Uniswap V3 NonfungiblePositionManager (ERC721Enumerable) por chainId.
export const V3_NFPM: Record<number, Address> = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',      // Ethereum
  42161: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',  // Arbitrum One
  8453: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',    // Base
  56: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',      // BNB Chain
  421614: '0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65',  // Arbitrum Sepolia
}

// Uniswap V4 PositionManager (ERC721, NO enumerable → posiciones vía logs Transfer).
export const V4_PM: Record<number, Address> = {
  1: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',        // Ethereum
  42161: '0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869',    // Arbitrum One
  8453: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',     // Base
  56: '0x7A4a5c919aE2541AeD11041A1AEeE68f1287f95b',       // BNB Chain
}

// Uniswap V3 Factory (para resolver la pool address y leer su precio actual).
export const V3_FACTORY: Record<number, Address> = {
  1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  42161: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  8453: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  56: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
  421614: '0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e',
}

// Uniswap V4 StateView (lee el precio/slot0 del PoolManager por poolId).
export const V4_STATEVIEW: Record<number, Address> = {
  1: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
  42161: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
  8453: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  56: '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4',
}

// topic0 de los eventos que escaneamos vía el explorer (Etherscan v2 getLogs).
export const TOPIC = {
  approval: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',        // Approval(address,address,uint256)
  approvalForAll: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',  // ApprovalForAll(address,address,bool)
  transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',         // Transfer(address,address,uint256)
} as const

// Etiquetas legibles para spenders/operadores frecuentes (lowercase).
const NAMED: Record<string, string> = {
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Permit2 (Uniswap)',
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af': 'Uniswap Universal Router',
  '0xa51afafe0263b40edaef0df8781ea9aa03e381a3': 'Uniswap Universal Router',
  '0x6ff5693b99212da76ad316178a184ab56d299b43': 'Uniswap Universal Router',
  '0x5e325eda8064b456f4781070c0738d849c824258': 'Uniswap Universal Router',
  '0xc36442b4a4522e871399cd717abdd847ab11fe88': 'Uniswap V3 Positions',
  '0xd88f38f930b7952f2db2432cb002e7abbf3dd869': 'Uniswap V4 Positions',
}

export function spenderLabel(addr: string): string | null {
  return NAMED[addr.toLowerCase()] ?? null
}
