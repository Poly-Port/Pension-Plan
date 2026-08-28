import { describe, expect, it } from 'vitest'
import { getRules } from './rules'
import { calculateSeveranceTax } from './severance'
import {
  calcWithdrawalLimit,
  calculateWithdrawal,
  pensionWithholdingRate,
  severancePayRate,
} from './withdrawal'
import type { WithdrawalInput } from './types'

const rules = getRules(2026)

const NO_OTHER_INCOME = { publicPension: 0, earnedAndBusiness: 0, financial: 0 }

/** 테스트용 기본 입력. 필요한 항목만 덮어쓴다. */
function makeInput(overrides: Partial<WithdrawalInput> = {}): WithdrawalInput {
  return {
    age: 65,
    pensionYearIndex: 11, // 기본은 한도 없음 상태로 두어 순서·세율만 검증
    balance: { taxFree: 0, deferredSeverance: 0, taxable: 0 },
    targetAmount: 0,
    otherIncome: { ...NO_OTHER_INCOME },
    healthInsuranceStatus: 'DEPENDENT',
    propertyTaxBase: 0,
    ...overrides,
  }
}

describe('퇴직소득세 계산 (명세서 §6)', () => {
  it('퇴직급여 1억 원 / 근속 20년의 각 단계 값이 명세서와 일치한다', () => {
    const r = calculateSeveranceTax({ severancePay: 100_000_000, serviceYears: 20 })

    expect(r.serviceYearDeduction).toBe(40_000_000) // 1,500만 + (20-10)×250만
    expect(r.convertedIncome).toBe(36_000_000) // (1억 − 4,000만) ÷ 20 × 12
    expect(r.convertedIncomeDeduction).toBe(24_800_000) // 800만 + (3,600만 − 800만)×60%
    expect(r.taxBase).toBe(11_200_000)
    expect(r.incomeTax).toBe(1_120_000) // 1,120만×6% ÷ 12 × 20
    expect(r.totalTax).toBeCloseTo(1_232_000, 0) // 지방소득세 10% 포함
    expect(r.effectiveRate).toBeCloseTo(0.01232, 5)
  })

  it('근속연수가 길수록 실효세율이 낮아진다', () => {
    const short = calculateSeveranceTax({ severancePay: 100_000_000, serviceYears: 5 })
    const long = calculateSeveranceTax({ severancePay: 100_000_000, serviceYears: 30 })
    expect(long.effectiveRate).toBeLessThan(short.effectiveRate)
  })
})

describe('연금수령한도 (명세서 §4)', () => {
  it('평가액 ÷ (11 − 연차) × 120% 로 계산한다', () => {
    const limit = calcWithdrawalLimit(
      { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
      3,
      rules,
    )
    expect(limit).toBe(15_000_000) // 1억 ÷ 8 × 1.2
  })

  it('11년차 이상이면 한도가 없다', () => {
    const limit = calcWithdrawalLimit(
      { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
      11,
      rules,
    )
    expect(limit).toBeNull()
  })
})

describe('세율 선택 (명세서 §5.1, §5.2)', () => {
  it.each([
    [65, 0.055],
    [69, 0.055],
    [70, 0.044],
    [79, 0.044],
    [80, 0.033],
    [90, 0.033],
  ])('만 %i세의 연금소득 원천징수세율은 %f', (age, expected) => {
    expect(pensionWithholdingRate(age, false, rules)).toBe(expected)
  })

  // 2026.1.1. 시행으로 종신계약 세율이 4% → 3%로 인하됐다 (소득세법 §129①5의2 다목)
  it('종신연금은 3.3%를 적용하며, 나이별 세율보다 낮으면 종신 세율이 이긴다', () => {
    expect(pensionWithholdingRate(65, true, rules)).toBe(0.033) // 5.5% 대신 3.3%
    expect(pensionWithholdingRate(72, true, rules)).toBe(0.033) // 4.4% 대신 3.3%
    expect(pensionWithholdingRate(85, true, rules)).toBe(0.033) // 이미 3.3%이므로 동일
  })

  it.each([
    [1, 0.7],
    [10, 0.7],
    [11, 0.6],
    [20, 0.6],
    [21, 0.5],
  ])('연금수령 %i년차의 이연퇴직소득 납부율은 %f', (yearIndex, expected) => {
    expect(severancePayRate(yearIndex, rules)).toBe(expected)
  })
})

describe('법정 인출 순서 (명세서 §2)', () => {
  it('비과세 → 이연퇴직소득 → 세액공제분 순서로 차감한다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: {
          taxFree: 10_000_000,
          deferredSeverance: 20_000_000,
          taxable: 30_000_000,
        },
        targetAmount: 25_000_000,
      }),
    )

    expect(result.lines.map((l) => l.source)).toEqual(['TAX_FREE', 'DEFERRED_SEVERANCE'])
    expect(result.lines[0].amount).toBe(10_000_000)
    expect(result.lines[1].amount).toBe(15_000_000)
    expect(result.withdrawnAmount).toBe(25_000_000)
  })

  it('비과세 재원에는 세금이 붙지 않는다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 10_000_000, deferredSeverance: 0, taxable: 0 },
        targetAmount: 10_000_000,
      }),
    )
    expect(result.totalTax).toBe(0)
    expect(result.netAmount).toBe(10_000_000)
  })

  it('잔액보다 많이 인출하려 하면 잔액까지만 계산하고 경고한다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 5_000_000 },
        targetAmount: 8_000_000,
      }),
    )
    expect(result.withdrawnAmount).toBe(5_000_000)
    expect(result.shortfall).toBe(3_000_000)
    expect(result.warnings.some((w) => w.includes('초과'))).toBe(true)
  })
})

describe('사적연금 분리과세 한도 1,500만 원 (명세서 §5.3)', () => {
  it('1,500만 원 이하면 연령별 원천징수세율로 끝난다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
        targetAmount: 15_000_000,
      }),
    )
    expect(result.overCap.exceeded).toBe(false)
    expect(result.overCap.chosen).toBe('WITHHOLDING')
    expect(result.totalTax).toBe(825_000) // 1,500만 × 5.5%
  })

  it('1,500만 원을 넘으면 종합과세와 16.5% 분리과세를 비교해 유리한 쪽을 택한다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
        targetAmount: 20_000_000,
      }),
    )

    expect(result.overCap.exceeded).toBe(true)
    expect(result.overCap.flatTax).toBe(3_300_000) // 2,000만 × 16.5%
    expect(result.overCap.comprehensiveTax).toBeCloseTo(765_600, 0)
    expect(result.overCap.chosen).toBe('COMPREHENSIVE')
    expect(result.totalTax).toBe(765_600)
  })

  it('타 소득이 크면 종합과세가 불리해져 16.5% 분리과세를 택한다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
        targetAmount: 20_000_000,
        otherIncome: {
          publicPension: 12_000_000,
          earnedAndBusiness: 80_000_000,
          financial: 0,
        },
      }),
    )
    expect(result.overCap.chosen).toBe('FLAT')
    expect(result.totalTax).toBe(3_300_000)
  })

  it('한도 초과 시 얼마를 줄여야 하는지 안내한다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
        targetAmount: 20_000_000,
      }),
    )
    expect(result.warnings.some((w) => w.includes('500만 원 줄이면'))).toBe(true)
  })
})

describe('연금수령한도 초과분 과세 (명세서 §5.4)', () => {
  it('한도를 넘긴 금액은 기타소득세 16.5%가 붙는다', () => {
    // 평가액 1억, 3년차 → 한도 1,500만 원
    const result = calculateWithdrawal(
      makeInput({
        pensionYearIndex: 3,
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 100_000_000 },
        targetAmount: 20_000_000,
      }),
    )

    expect(result.withdrawalLimit).toBe(15_000_000)
    const line = result.lines[0]
    expect(line.withinLimit).toBe(15_000_000)
    expect(line.overLimit).toBe(5_000_000)
    // 한도 이내분은 1,500만 원 "이하"이므로 5.5%, 초과분 500만 원은 16.5%
    expect(result.totalTax).toBe(825_000 + 825_000)
    expect(result.warnings.some((w) => w.includes('연금수령한도'))).toBe(true)
  })
})

describe('이연퇴직소득 감면 (명세서 §5.2)', () => {
  const basis = { severancePay: 100_000_000, serviceYears: 20 } // 실효세율 1.232%

  it('10년차는 퇴직소득세의 70%를 낸다', () => {
    const result = calculateWithdrawal(
      makeInput({
        pensionYearIndex: 10,
        balance: { taxFree: 0, deferredSeverance: 100_000_000, taxable: 0 },
        targetAmount: 10_000_000,
        severanceBasis: basis,
      }),
    )
    // 한도: 1억 ÷ (11−10) × 1.2 = 1억 2,000만 → 1,000만 원은 전액 한도 이내
    expect(result.totalTax).toBe(Math.round(10_000_000 * 0.01232 * 0.7))
  })

  it('11년차는 60%로 줄어 세금이 더 적다', () => {
    const at10 = calculateWithdrawal(
      makeInput({
        pensionYearIndex: 10,
        balance: { taxFree: 0, deferredSeverance: 100_000_000, taxable: 0 },
        targetAmount: 10_000_000,
        severanceBasis: basis,
      }),
    )
    const at11 = calculateWithdrawal(
      makeInput({
        pensionYearIndex: 11,
        balance: { taxFree: 0, deferredSeverance: 100_000_000, taxable: 0 },
        targetAmount: 10_000_000,
        severanceBasis: basis,
      }),
    )
    expect(at11.totalTax).toBeLessThan(at10.totalTax)
    expect(at10.warnings.some((w) => w.includes('11년차'))).toBe(true)
  })
})

describe('건강보험료 판정 (명세서 §7)', () => {
  it('사적연금을 아무리 많이 빼도 피부양자 판정 소득에 포함되지 않는다', () => {
    const result = calculateWithdrawal(
      makeInput({
        balance: { taxFree: 0, deferredSeverance: 0, taxable: 500_000_000 },
        targetAmount: 100_000_000,
        otherIncome: {
          publicPension: 12_000_000,
          earnedAndBusiness: 5_000_000,
          financial: 2_000_000,
        },
        propertyTaxBase: 450_000_000,
      }),
    )

    expect(result.health.countedIncome).toBe(19_000_000) // 사적연금 1억은 미포함
    expect(result.health.dependentKept).toBe(true)
  })

  it('합산소득이 2,000만 원을 넘으면 피부양자 자격을 잃는다', () => {
    const result = calculateWithdrawal(
      makeInput({
        otherIncome: {
          publicPension: 12_000_000,
          earnedAndBusiness: 9_000_000,
          financial: 0,
        },
      }),
    )
    expect(result.health.dependentKept).toBe(false)
    expect(result.health.reasons.some((r) => r.includes('합산소득'))).toBe(true)
  })

  it('재산세 과세표준 9억 초과면 소득과 무관하게 탈락한다', () => {
    const result = calculateWithdrawal(makeInput({ propertyTaxBase: 950_000_000 }))
    expect(result.health.dependentKept).toBe(false)
  })

  it('지역가입자는 피부양자 판정 대상이 아니다', () => {
    const result = calculateWithdrawal(makeInput({ healthInsuranceStatus: 'LOCAL' }))
    expect(result.health.dependentKept).toBeNull()
  })
})
