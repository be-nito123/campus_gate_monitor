import { describe, expect, it } from 'vitest'
import {
  describeRegistrationIssue,
  formatRegistrationNumber,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseRegistrationNumber,
  toComparisonKey,
} from '@/utils/registration'

describe('registration number normalisation', () => {
  it('strips separators, spaces and lowercase input', () => {
    expect(normalizeRegistrationNumber('mh 12 ab 1234')).toBe('MH12AB1234')
    expect(normalizeRegistrationNumber('ka-05-cd-5678')).toBe('KA05CD5678')
    expect(normalizeRegistrationNumber('DL 8C AB 1234')).toBe('DL8CAB1234')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeRegistrationNumber('')).toBe('')
    expect(normalizeRegistrationNumber('   ')).toBe('')
  })

  it('builds an OCR-tolerant comparison key', () => {
    // A clean plate returns its canonical form.
    expect(toComparisonKey('MH12AB1234')).toBe('MH12AB1234')
    // OCR-confused I→1 digits: the key should match the canonical form.
    expect(toComparisonKey('MH I2 AB I234')).toBe('MH12AB1234')
    // Case insensitive
    expect(toComparisonKey('mh 12 ab 1234')).toBe(toComparisonKey('MH12AB1234'))
  })

  it('keeps different state codes on different keys', () => {
    expect(toComparisonKey('MH12AB1234')).not.toBe(toComparisonKey('MP12AB1234'))
  })

  it('formats a canonical plate for display', () => {
    expect(formatRegistrationNumber('MH12AB1234')).toBe('MH 12 AB 1234')
    expect(formatRegistrationNumber('DL8CAB1234')).toBe('DL 8 CAB 1234')
    expect(formatRegistrationNumber('MH12A1234')).toBe('MH 12 A 1234')
  })

  it('formats plates that fall outside the standard layout verbatim', () => {
    // No series letters, only 4 trailing digits — non-standard layout
    expect(formatRegistrationNumber('HELLO')).toBe('HELLO')
  })

  it('parseRegistrationNumber returns all three representations', () => {
    const parsed = parseRegistrationNumber('mh 12 ab 1234')
    expect(parsed.normalized).toBe('MH12AB1234')
    expect(parsed.display).toBe('MH 12 AB 1234')
    expect(parsed.comparisonKey).toBe('MH12AB1234')
  })
})

describe('registration number validation', () => {
  it('accepts the common Indian plate layouts', () => {
    expect(isValidRegistrationNumber('MH 12 AB 1234')).toBe(true)
    expect(isValidRegistrationNumber('MH12AB1234')).toBe(true)
    expect(isValidRegistrationNumber('DL 8 C 1234')).toBe(true)
    expect(isValidRegistrationNumber('KA01E AB 1000')).toBe(true)
  })

  it('rejects malformed plates', () => {
    expect(isValidRegistrationNumber('')).toBe(false)
    expect(isValidRegistrationNumber('1234')).toBe(false)
    expect(isValidRegistrationNumber('MH AB 1234')).toBe(false)
    expect(isValidRegistrationNumber('M12AB1234')).toBe(false)
    expect(isValidRegistrationNumber('MH12AB12345678')).toBe(false)
    expect(isValidRegistrationNumber('M')).toBe(false)
  })

  it('produces a human readable issue message for invalid input', () => {
    expect(describeRegistrationIssue('')).toMatch(/required/i)
    expect(describeRegistrationIssue('12AB')).toMatch(/state code/i)
    expect(describeRegistrationIssue('MHAB1234')).toMatch(/format/i)
    expect(describeRegistrationIssue('MH12AB1234')).toBeNull()
  })
})
