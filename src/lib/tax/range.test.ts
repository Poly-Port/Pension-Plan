/**
 * range.ts — 미지값을 범위로 다루는 래퍼의 성질 테스트
 * 설계 근거: docs/superpowers/specs/2026-08-28-phase1-calculator-ui-design.md §4, §7.1
 */
import { describe, expect, it } from 'vitest'
import { calculateWithdrawal } from './withdrawal'
import { calculateWithdrawalRange } from './range'
import type { PartialWithdrawalInput } from './range'
import type { WithdrawalInput } from './types'

const YEAR = 2026

/** 13개 값이 전부 확정된 입력 */
const CONFIRMED: PartialWithdrawalInput = {
  age: 63,
  pensionStartYear: 2024,
  totalBalance: 250_000_000,
  severance: { amount: 80_000_000, serviceYears: 20 },
  targetAmount: 25_000_000,
  taxFree: 20_000_000,
  otherIncome: {
    publicPension: 12_000_000,
    earnedAndBusiness: 5_000_000,
    financial: 2_000_000,
  },
  healthInsuranceStatus: 'DEPENDENT',
  propertyTaxBase: 450_000_000,
}

/** CONFIRMED 를 손으로 기존 엔진 입력으로 옮긴 것 (§4.3 파생 규칙) */
const EQUIVALENT: WithdrawalInput = {
  age: 63,
  pensionYearIndex: 3, // 2026 − 2024 + 1
  balance: {
    taxFree: 20_000_000,
    deferredSeverance: 80_000_000,
    taxable: 150_000_000, // 250M − 20M − 80M
  },
  targetAmount: 25_000_000,
  severanceBasis: { severancePay: 80_000_000, serviceYears: 20 },
  otherIncome: {
    publicPension: 12_000_000,
    earnedAndBusiness: 5_000_000,
    financial: 2_000_000,
  },
  healthInsuranceStatus: 'DEPENDENT',
  propertyTaxBase: 450_000_000,
}

/** CONFIRMED 에서 조건부 입력 하나를 빼서 "아직 답하지 않은" 상태를 만든다 */
const without = (
  key: 'taxFree' | 'otherIncome' | 'healthInsuranceStatus' | 'propertyTaxBase',
): PartialWithdrawalInput => {
  const copy: PartialWithdrawalInput = { ...CONFIRMED }
  delete copy[key]
  return copy
}

describe('성질 4 — 확정 입력은 기존 엔진과 결과가 완전히 일치한다', () => {
  it('대표값이 calculateWithdrawal 결과와 같다', () => {
    const range = calculateWithdrawalRange(CONFIRMED, YEAR)
    expect(range.representative).toEqual(calculateWithdrawal(EQUIVALENT, YEAR))
  })

  it('확정 입력에는 가정이 없다', () => {
    expect(calculateWithdrawalRange(CONFIRMED, YEAR).assumptions).toEqual([])
  })

  it('확정 입력에는 미확인 항목이 없다', () => {
    expect(calculateWithdrawalRange(CONFIRMED, YEAR).missing).toEqual([])
  })
})

describe('성질 2 — certain 이면 min·max·representative 가 모두 같다', () => {
  it('확정 입력은 certain 이다', () => {
    expect(calculateWithdrawalRange(CONFIRMED, YEAR).certain).toBe(true)
  })

  it('세 값이 서로 같다', () => {
    const r = calculateWithdrawalRange(CONFIRMED, YEAR)
    expect(r.min).toEqual(r.max)
    expect(r.representative).toEqual(r.max)
  })
})

describe('§4.3 파생 규칙', () => {
  it('연금을 아직 받지 않았으면 1년차다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, pensionStartYear: null }, YEAR)
    const expected = calculateWithdrawal({ ...EQUIVALENT, pensionYearIndex: 1 }, YEAR)
    expect(r.representative).toEqual(expected)
  })

  it('연금수령연차는 계산 대상 연도 − 개시 연도 + 1 이다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, pensionStartYear: 2018 }, YEAR)
    const expected = calculateWithdrawal({ ...EQUIVALENT, pensionYearIndex: 9 }, YEAR)
    expect(r.representative).toEqual(expected)
  })

  it('퇴직금을 받지 않았으면 잔액에서 비과세를 뺀 전부가 과세대상이다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, severance: null }, YEAR)
    const expected = calculateWithdrawal(
      {
        ...EQUIVALENT,
        balance: { taxFree: 20_000_000, deferredSeverance: 0, taxable: 230_000_000 },
        severanceBasis: undefined,
      },
      YEAR,
    )
    expect(r.representative).toEqual(expected)
  })

  it('계산 대상 연도를 생략하면 기본 규칙 연도를 쓴다', () => {
    expect(calculateWithdrawalRange(CONFIRMED)).toEqual(calculateWithdrawalRange(CONFIRMED, 2026))
  })
})

/** 범위의 폭 = 가장 불리한 세금 − 가장 유리한 세금 */
const width = (r: { min: { totalTax: number }; max: { totalTax: number } }) =>
  r.max.totalTax - r.min.totalTax

describe('성질 3 — 미지 필드가 하나라도 있으면 가정이 비지 않는다', () => {
  it('과세제외금액을 안 알려주면 0으로 가정하고 그 사실을 남긴다', () => {
    const r = calculateWithdrawalRange(without('taxFree'), YEAR)
    expect(r.assumptions.map((a) => a.field)).toContain('taxFree')
  })

  it('과세제외금액을 모르겠다고 답해도 같다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, taxFree: 'unknown' }, YEAR)
    expect(r.assumptions.map((a) => a.field)).toContain('taxFree')
  })

  it('가정에는 확인 방법이 함께 담긴다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, taxFree: 'unknown' }, YEAR)
    const a = r.assumptions.find((x) => x.field === 'taxFree')
    expect(a?.howToConfirm).toBeTruthy()
    expect(a?.reason).toBeTruthy()
  })

  it('미지 필드는 후속 질문 목록에도 올라간다', () => {
    const r = calculateWithdrawalRange(
      { ...CONFIRMED, severance: { amount: 'unknown', serviceYears: 20 } },
      YEAR,
    )
    const q = r.missing.find((m) => m.field === 'severance.amount')
    expect(q?.question).toBeTruthy()
    expect(q?.impact).toBe('high')
  })
})

describe('성질 1 — 답을 추가하면 폭은 절대 넓어지지 않는다', () => {
  const base: PartialWithdrawalInput = {
    age: 63,
    pensionStartYear: 2024,
    totalBalance: 250_000_000,
    severance: { amount: 'unknown', serviceYears: 'unknown' },
    targetAmount: 25_000_000,
  }

  it('아무것도 모르면 폭이 0보다 크다', () => {
    expect(width(calculateWithdrawalRange(base, YEAR))).toBeGreaterThan(0)
  })

  it('근속연수 → 퇴직급여액 순으로 답하면 폭이 단조 감소한다', () => {
    const w0 = width(calculateWithdrawalRange(base, YEAR))
    const w1 = width(
      calculateWithdrawalRange(
        { ...base, severance: { amount: 'unknown', serviceYears: 20 } },
        YEAR,
      ),
    )
    const w2 = width(
      calculateWithdrawalRange(
        { ...base, severance: { amount: 80_000_000, serviceYears: 20 } },
        YEAR,
      ),
    )
    expect(w1).toBeLessThanOrEqual(w0)
    expect(w2).toBeLessThanOrEqual(w1)
    expect(w2).toBe(0)
  })

  it('퇴직금을 받지 않았다고 답해도 타 소득이 미지면 폭은 남는다', () => {
    // 퇴직금이 없으면 인출액 2,500만 원이 전부 과세대상에서 나가 1,500만 원 한도를 넘는다.
    // 그때부터 타 소득이 세액을 가르므로, 퇴직금만 답해서는 확정되지 않는다.
    const r = calculateWithdrawalRange({ ...base, severance: null }, YEAR)
    expect(r.max.overCap.exceeded).toBe(true)
    expect(width(r)).toBeGreaterThan(0)
    expect(width(r)).toBeLessThanOrEqual(width(calculateWithdrawalRange(base, YEAR)))
  })

  it('세금을 가르는 값을 모두 답하면 폭이 0이 된다', () => {
    const answered = calculateWithdrawalRange(
      {
        ...base,
        severance: null,
        taxFree: 0,
        otherIncome: { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
      },
      YEAR,
    )
    expect(width(answered)).toBe(0)
    expect(answered.certain).toBe(true)
  })
})

describe('§4.2 — 대표값은 보수적으로 max 를 쓴다', () => {
  const unsure: PartialWithdrawalInput = {
    age: 63,
    pensionStartYear: 2024,
    totalBalance: 250_000_000,
    severance: { amount: 'unknown', serviceYears: 20 },
    targetAmount: 25_000_000,
  }

  it('대표값이 max 와 같다', () => {
    const r = calculateWithdrawalRange(unsure, YEAR)
    expect(r.representative).toEqual(r.max)
  })

  it('min 세금이 max 세금보다 크지 않다', () => {
    const r = calculateWithdrawalRange(unsure, YEAR)
    expect(r.min.totalTax).toBeLessThanOrEqual(r.max.totalTax)
  })

  it('세금이 확정되지 않았으므로 certain 이 아니다', () => {
    expect(calculateWithdrawalRange(unsure, YEAR).certain).toBe(false)
  })
})

describe('§4.4 — 미지 퇴직금의 경계값', () => {
  const base: PartialWithdrawalInput = {
    age: 63,
    pensionStartYear: 2024,
    totalBalance: 250_000_000,
    severance: { amount: 'unknown', serviceYears: 20 },
    targetAmount: 25_000_000,
    taxFree: 20_000_000,
    otherIncome: { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
    healthInsuranceStatus: 'LOCAL',
    propertyTaxBase: 0,
  }

  const engine = (deferredSeverance: number, serviceYears: number) =>
    calculateWithdrawal(
      {
        age: 63,
        pensionYearIndex: 3,
        balance: {
          taxFree: 20_000_000,
          deferredSeverance,
          taxable: 230_000_000 - deferredSeverance,
        },
        targetAmount: 25_000_000,
        severanceBasis:
          deferredSeverance > 0
            ? { severancePay: deferredSeverance, serviceYears }
            : undefined,
        otherIncome: { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
        healthInsuranceStatus: 'LOCAL',
        propertyTaxBase: 0,
      },
      YEAR,
    )

  it('퇴직급여액 경계는 0 과 (총잔액 − 과세제외금액) 이다', () => {
    const r = calculateWithdrawalRange(base, YEAR)
    const candidates = [engine(0, 20), engine(230_000_000, 20)].map((x) => x.totalTax)
    expect(r.min.totalTax).toBe(Math.min(...candidates))
    expect(r.max.totalTax).toBe(Math.max(...candidates))
  })

  it('근속연수 경계는 1년과 (나이 − 18)년 이다', () => {
    const r = calculateWithdrawalRange(
      { ...base, severance: { amount: 80_000_000, serviceYears: 'unknown' } },
      YEAR,
    )
    const withYears = (y: number) =>
      calculateWithdrawal(
        {
          age: 63,
          pensionYearIndex: 3,
          balance: { taxFree: 20_000_000, deferredSeverance: 80_000_000, taxable: 150_000_000 },
          targetAmount: 25_000_000,
          severanceBasis: { severancePay: 80_000_000, serviceYears: y },
          otherIncome: { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
          healthInsuranceStatus: 'LOCAL',
          propertyTaxBase: 0,
        },
        YEAR,
      ).totalTax
    const candidates = [withYears(1), withYears(45)]
    expect(r.min.totalTax).toBe(Math.min(...candidates))
    expect(r.max.totalTax).toBe(Math.max(...candidates))
  })
})

describe('§3.4 — 모르는 값을 그럴듯한 기본값으로 덮지 않는다', () => {
  it('재산세 과세표준을 모르면 피부양자 판정을 생략한다', () => {
    const r = calculateWithdrawalRange(without('propertyTaxBase'), YEAR)
    expect(r.representative.health.dependentKept).toBeNull()
    expect(r.representative.health.reasons.join(' ')).toContain('생략')
    expect(r.missing.map((m) => m.field)).toContain('propertyTaxBase')
  })

  it('건강보험 자격을 모르면 판정을 생략한다', () => {
    const r = calculateWithdrawalRange({ ...CONFIRMED, healthInsuranceStatus: 'unknown' }, YEAR)
    expect(r.representative.health.dependentKept).toBeNull()
    expect(r.missing.map((m) => m.field)).toContain('healthInsuranceStatus')
  })

  it('건보 입력만 모르면 세금은 여전히 확정이다', () => {
    expect(calculateWithdrawalRange(without('propertyTaxBase'), YEAR).certain).toBe(true)
  })
})

describe('§5.3 — 타 소득을 모를 때의 1,500만 원 초과 처리', () => {
  const overCap: PartialWithdrawalInput = {
    age: 63,
    pensionStartYear: null, // 1년차 → 한도 250M/10*1.2 = 3,000만
    totalBalance: 250_000_000,
    severance: null,
    targetAmount: 40_000_000,
  }

  it('타 소득을 모르면 가장 불리한 쪽은 16.5% 분리과세다', () => {
    const r = calculateWithdrawalRange(overCap, YEAR)
    expect(r.max.overCap.exceeded).toBe(true)
    expect(r.max.overCap.chosen).toBe('FLAT')
  })

  it('타 소득을 모르면 후속 질문에 올라간다', () => {
    const r = calculateWithdrawalRange(overCap, YEAR)
    const q = r.missing.find((m) => m.field === 'otherIncome')
    expect(q?.impact).toBe('high')
  })

  it('1,500만 원을 넘지 않으면 타 소득을 몰라도 세금이 확정된다', () => {
    const r = calculateWithdrawalRange(
      { ...without('otherIncome'), targetAmount: 10_000_000 },
      YEAR,
    )
    expect(r.certain).toBe(true)
  })
})

describe('입력이 서로 어긋날 때', () => {
  // 재원 합계가 총잔액을 넘도록 입력할 수 있다. 이때 과세대상은 음수가 되는데,
  // 엔진은 세 재원의 합으로 인출 가능액을 잡으므로 음수가 정확히 상쇄되어 총잔액이 유지된다.
  // 과세대상을 0으로 잘라내면 오히려 잔액이 부풀려져 없는 돈을 인출하게 된다.
  const overstated: PartialWithdrawalInput = {
    age: 63,
    pensionStartYear: 2024,
    totalBalance: 100_000_000,
    severance: null,
    targetAmount: 150_000_000,
    taxFree: 200_000_000,
    otherIncome: { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
    healthInsuranceStatus: 'LOCAL',
    propertyTaxBase: 0,
  }

  it('재원 합계가 총잔액을 넘어도 총잔액보다 많이 인출되지 않는다', () => {
    const r = calculateWithdrawalRange(overstated, YEAR)
    expect(r.representative.withdrawnAmount).toBe(100_000_000)
    expect(r.representative.shortfall).toBe(50_000_000)
  })

  it('퇴직금이 총잔액보다 커도 마찬가지다', () => {
    const r = calculateWithdrawalRange(
      { ...overstated, taxFree: 0, severance: { amount: 300_000_000, serviceYears: 20 } },
      YEAR,
    )
    expect(r.representative.withdrawnAmount).toBe(100_000_000)
    expect(r.representative.totalTax).toBeGreaterThanOrEqual(0)
  })

  it('미지 퇴직금의 상한은 총잔액에서 과세제외금액을 뺀 값이다', () => {
    const r = calculateWithdrawalRange(
      {
        ...overstated,
        taxFree: 10_000_000,
        targetAmount: 20_000_000,
        severance: { amount: 'unknown', serviceYears: 20 },
      },
      YEAR,
    )
    for (const result of [r.min, r.max]) {
      expect(result.withdrawnAmount).toBeLessThanOrEqual(100_000_000)
      expect(result.totalTax).toBeGreaterThanOrEqual(0)
    }
  })
})
