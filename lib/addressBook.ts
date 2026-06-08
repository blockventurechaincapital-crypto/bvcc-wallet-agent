import { isAddress, getAddress } from 'viem'

export type AddressEntry = {
  address: string  // checksum address
  name: string
  createdAt: number
}

const STORAGE_KEY = 'bvcc_address_book'

function load(): AddressEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(entries: AddressEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const addressBook = {
  getAll(): AddressEntry[] {
    return load()
  },

  add(name: string, address: string): void {
    if (typeof window === 'undefined') return
    if (!isAddress(address)) throw new Error('Dirección inválida')
    const checksum = getAddress(address)
    const entries = load()
    const existing = entries.findIndex(e => e.address.toLowerCase() === checksum.toLowerCase())
    if (existing !== -1) {
      entries[existing] = { address: checksum, name, createdAt: entries[existing].createdAt }
    } else {
      entries.push({ address: checksum, name, createdAt: Date.now() })
    }
    save(entries)
  },

  remove(address: string): void {
    if (typeof window === 'undefined') return
    const entries = load().filter(e => e.address.toLowerCase() !== address.toLowerCase())
    save(entries)
  },

  findByAddress(address: string): AddressEntry | undefined {
    if (typeof window === 'undefined') return undefined
    return load().find(e => e.address.toLowerCase() === address.toLowerCase())
  },

  search(query: string): AddressEntry[] {
    if (typeof window === 'undefined') return []
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return load().filter(
      e => e.name.toLowerCase().includes(q) || e.address.toLowerCase().includes(q)
    )
  },
}
