import { describe, expect, it } from 'vitest'
import { formatComma, formatMan, manToWon, parseManInput, wonToMan } from './format'

describe('만원 ↔ 원', () => {
  it('만원을 원으로 바꾼다', () => {
    expect(manToWon(2500)).toBe(25_000_000)
    expect(manToWon(0)).toBe(0)
  })

  it('원을 만원으로 바꾼다', () => {
    expect(wonToMan(25_000_000)).toBe(2500)
  })

  it('만원 미만은 반올림한다', () => {
    expect(wonToMan(824_500)).toBe(82)
    expect(wonToMan(825_000)).toBe(83)
  })

  it('왕복해도 값이 유지된다', () => {
    expect(wonToMan(manToWon(1234))).toBe(1234)
  })
})

describe('표시', () => {
  it('천단위로 끊는다', () => {
    expect(formatComma(25000)).toBe('25,000')
    expect(formatComma(0)).toBe('0')
  })

  it('원을 만원 단위 문구로 만든다', () => {
    expect(formatMan(25_000_000)).toBe('2,500만원')
    expect(formatMan(825_000)).toBe('83만원')
    expect(formatMan(0)).toBe('0만원')
  })
})

describe('입력 파싱', () => {
  it('쉼표가 있어도 읽는다', () => {
    expect(parseManInput('25,000')).toBe(25000)
  })

  it('공백을 무시한다', () => {
    expect(parseManInput(' 2500 ')).toBe(2500)
  })

  it('빈 입력은 null 이다', () => {
    expect(parseManInput('')).toBeNull()
    expect(parseManInput('   ')).toBeNull()
  })

  it('숫자가 아니면 null 이다', () => {
    expect(parseManInput('abc')).toBeNull()
    expect(parseManInput('12a3')).toBeNull()
  })

  it('음수는 받지 않는다', () => {
    expect(parseManInput('-100')).toBeNull()
  })

  it('소수점은 버리지 않고 그대로 읽는다', () => {
    expect(parseManInput('1.5')).toBe(1.5)
  })
})
