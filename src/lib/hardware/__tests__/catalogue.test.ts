import { describe, expect, it } from 'vitest'
import { CATEGORIES, HARDWARE, categoryCounts, filterHardware } from '../catalogue'

describe('hardware catalogue', () => {
  it('has an entry in every category and unique ids', () => {
    const counts = categoryCounts()
    CATEGORIES.forEach((c) => expect(counts[c.id]).toBeGreaterThan(0))
    expect(new Set(HARDWARE.map((h) => h.id)).size).toBe(HARDWARE.length)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(HARDWARE.length)
  })

  it('links only to secure, non-empty vendor pages', () => {
    HARDWARE.forEach((h) => {
      expect(h.url.startsWith('https://')).toBe(true)
      expect(h.url.length).toBeGreaterThan(12)
      expect(h.what.length).toBeGreaterThan(20)
      expect(h.why.length).toBeGreaterThan(20)
    })
  })

  it('filters by category and searches name, maker and copy', () => {
    const cryo = filterHardware('cryo', '')
    expect(cryo.length).toBeGreaterThan(4)
    expect(cryo.every((h) => h.category === 'cryo')).toBe(true)

    const lasers = filterHardware('all', 'laser')
    expect(lasers.length).toBeGreaterThan(4)
    expect(filterHardware('all', 'snspd').map((h) => h.id)).toContain('single-quantum')
    expect(filterHardware('all', 'no-such-vendor-xyz')).toHaveLength(0)
  })
})
