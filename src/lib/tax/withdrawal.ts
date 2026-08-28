/**
 * 연간 인출 세금 계산 엔진 (명세서 §8)
 *
 * 이 파일은 React/DOM을 전혀 모른다. 순수 함수만 있으므로 화면·서버·테스트 어디서든 쓸 수 있다.
 */
import type {
  AccountBalance,
  HealthAssessment,
  OverCapDecision,
  WithdrawalInput,
  WithdrawalLine,
  WithdrawalResult,
} from './types'
import { getRules, type TaxRules } from './rules'
import { applyBaseRates, calculateSeveranceTax } from './severance'

const SOURCE_LABEL = {
  TAX_FREE: '과세제외금액 (비과세)',
  DEFERRED_SEVERANCE: '이연퇴직소득',
  TAXABLE: '세액공제분 + 운용수익',
} as const

const MAN = 10000

function toMan(won: number): string {
  return Math.round(won / MAN).toLocaleString()
}

function totalBalance(b: AccountBalance): number {
  return b.taxFree + b.deferredSeverance + b.taxable
}

/** 연금수령한도 (명세서 §4). null이면 한도 없음 */
export function calcWithdrawalLimit(
  balance: AccountBalance,
  pensionYearIndex: number,
  rules: TaxRules,
): number | null {
  const { denominatorBase, multiplier, unlimitedFromYearIndex } = rules.withdrawalLimit
  if (pensionYearIndex >= unlimitedFromYearIndex) return null

  const denominator = denominatorBase - pensionYearIndex
  if (denominator <= 0) return null
  return (totalBalance(balance) / denominator) * multiplier
}

/** 연령별 연금소득 원천징수세율 (명세서 §5.1) */
export function pensionWithholdingRate(
  age: number,
  isLifetimeAnnuity: boolean,
  rules: TaxRules,
): number {
  const byAge = rules.pensionIncomeWithholding.byAgeDesc.find((b) => age >= b.minAge)
  const ageRate = byAge?.rate ?? rules.pensionIncomeWithholding.byAgeDesc[0].rate

  const life = rules.pensionIncomeWithholding.lifetimeAnnuity
  if (isLifetimeAnnuity && age >= life.minAge) {
    // 각 목의 요건을 동시에 충족하면 낮은 세율을 적용한다 (소득세법 §129①5의2)
    return Math.min(ageRate, life.rate)
  }
  return ageRate
}

/** 이연퇴직소득 납부율 (명세서 §5.2) */
export function severancePayRate(pensionYearIndex: number, rules: TaxRules): number {
  for (const band of rules.deferredSeverance.payRateByYearIndex) {
    if (band.upToYearIndex === null || pensionYearIndex <= band.upToYearIndex) {
      return band.payRate
    }
  }
  return 1
}

/** 연금소득공제 (명세서 §5.3(a) 계산용) */
function pensionIncomeDeduction(grossPension: number, rules: TaxRules): number {
  if (grossPension <= 0) return 0
  for (const band of rules.pensionIncomeDeduction.brackets) {
    if (band.upTo === null || grossPension <= band.upTo) {
      const d = band.base + (grossPension - band.from) * band.rate
      return Math.min(d, rules.pensionIncomeDeduction.cap)
    }
  }
  return 0
}

/**
 * 종합과세를 택했을 때 "사적연금 때문에 늘어나는 세액"을 추정한다 (명세서 §5.3(a)).
 *
 * 주의: 인적공제를 본인 기본공제만 반영하고, 금융소득은 2,000만 원을 넘을 때만
 * 종합과세에 넣는 단순화가 들어가 있다. 실제 신고세액과 차이가 날 수 있는 추정치다.
 */
function estimateComprehensiveTax(
  privatePension: number,
  input: WithdrawalInput,
  rules: TaxRules,
): number {
  const BASIC_DEDUCTION = 1_500_000
  const FINANCIAL_SEPARATE_CAP = 20_000_000

  const financialComprehensive =
    input.otherIncome.financial > FINANCIAL_SEPARATE_CAP ? input.otherIncome.financial : 0

  const taxOf = (pensionPart: number) => {
    const grossPension = input.otherIncome.publicPension + pensionPart
    const pensionIncome = Math.max(
      0,
      grossPension - pensionIncomeDeduction(grossPension, rules),
    )
    const totalIncome =
      pensionIncome + input.otherIncome.earnedAndBusiness + financialComprehensive
    const taxBase = Math.max(0, totalIncome - BASIC_DEDUCTION)
    const incomeTax = Math.max(0, applyBaseRates(taxBase, rules))
    return incomeTax * (1 + rules.localIncomeTaxSurcharge)
  }

  // 사적연금을 넣었을 때와 뺐을 때의 차이 = 사적연금에 귀속되는 세액
  return Math.max(0, taxOf(privatePension) - taxOf(0))
}

function assessHealthInsurance(input: WithdrawalInput, rules: TaxRules): HealthAssessment {
  const hi = rules.healthInsurance
  const reasons: string[] = []

  // 사적연금 수령액은 건보료 부과 대상 소득이 아니다 (명세서 §7.1)
  const countedIncome =
    input.otherIncome.publicPension +
    input.otherIncome.earnedAndBusiness +
    input.otherIncome.financial

  if (input.healthInsuranceStatus !== 'DEPENDENT') {
    reasons.push(
      input.healthInsuranceStatus === 'LOCAL'
        ? '지역가입자입니다. 사적연금 수령액은 건강보험료 산정에 포함되지 않습니다.'
        : '직장가입자입니다. 사적연금 수령액은 건강보험료 산정에 포함되지 않습니다.',
    )
    return {
      status: input.healthInsuranceStatus,
      dependentKept: null,
      countedIncome,
      reasons,
    }
  }

  const incomeOver = countedIncome > hi.dependent.annualIncomeLimit
  const propertyHardFail = input.propertyTaxBase > hi.dependent.propertyTaxBaseHard
  const propertyMidFail =
    input.propertyTaxBase > hi.dependent.propertyTaxBaseSafe &&
    countedIncome > hi.dependent.propertyMidIncomeLimit

  if (incomeOver) {
    reasons.push(
      '합산소득 ' +
        toMan(countedIncome) +
        '만 원이 기준 ' +
        toMan(hi.dependent.annualIncomeLimit) +
        '만 원을 초과합니다.',
    )
  }
  if (propertyHardFail) {
    reasons.push(
      '재산세 과세표준이 ' +
        hi.dependent.propertyTaxBaseHard / 100000000 +
        '억 원을 초과합니다.',
    )
  } else if (propertyMidFail) {
    reasons.push(
      '재산세 과세표준이 ' +
        hi.dependent.propertyTaxBaseSafe / 100000000 +
        '억 원을 초과하면서 소득이 ' +
        toMan(hi.dependent.propertyMidIncomeLimit) +
        '만 원을 초과합니다.',
    )
  }

  const kept = !(incomeOver || propertyHardFail || propertyMidFail)
  if (kept) {
    reasons.push('소득·재산 요건을 모두 충족해 피부양자 자격을 유지할 수 있습니다.')
    reasons.push('사적연금 인출액은 이 판정에 합산되지 않습니다.')
  }

  return { status: 'DEPENDENT', dependentKept: kept, countedIncome, reasons }
}

export function calculateWithdrawal(input: WithdrawalInput, year?: number): WithdrawalResult {
  const rules = getRules(year)
  const warnings: string[] = []

  const available = totalBalance(input.balance)
  const withdrawnAmount = Math.min(Math.max(0, input.targetAmount), available)
  const shortfall = Math.max(0, input.targetAmount - available)
  if (shortfall > 0) {
    warnings.push(
      '목표 인출액이 보유 잔액을 ' +
        toMan(shortfall) +
        '만 원 초과합니다. 잔액까지만 계산했습니다.',
    )
  }

  const limit = calcWithdrawalLimit(input.balance, input.pensionYearIndex, rules)
  const ageRate = pensionWithholdingRate(input.age, input.isLifetimeAnnuity ?? false, rules)
  const payRate = severancePayRate(input.pensionYearIndex, rules)

  const severanceRate = input.severanceBasis
    ? calculateSeveranceTax(input.severanceBasis, year).effectiveRate
    : 0
  if (input.balance.deferredSeverance > 0 && !input.severanceBasis) {
    warnings.push(
      '이연퇴직소득 잔액이 있으나 퇴직급여·근속연수 정보가 없어 퇴직소득세를 0으로 계산했습니다.',
    )
  }

  // 법정 인출 순서: 재원1 → 재원2 → 재원3 (명세서 §2)
  const order: Array<{ key: keyof AccountBalance; kind: WithdrawalLine['source'] }> = [
    { key: 'taxFree', kind: 'TAX_FREE' },
    { key: 'deferredSeverance', kind: 'DEFERRED_SEVERANCE' },
    { key: 'taxable', kind: 'TAXABLE' },
  ]

  let remaining = withdrawnAmount
  let cumulative = 0
  const lines: WithdrawalLine[] = []

  for (const { key, kind } of order) {
    if (remaining <= 0) break
    const amount = Math.min(remaining, input.balance[key])
    if (amount <= 0) continue

    // 누적 인출액 기준으로 한도 이내분 / 초과분을 나눈다
    const roomLeft = limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - cumulative)
    const withinLimit = Math.min(amount, roomLeft)
    const overLimit = amount - withinLimit

    let tax = 0
    let note = ''

    if (kind === 'TAX_FREE') {
      tax = 0
      note = '이미 세금을 낸 돈이라 인출해도 과세되지 않습니다.'
    } else if (kind === 'DEFERRED_SEVERANCE') {
      // 명세서 §5.2 / §5.4
      tax =
        withinLimit * severanceRate * payRate +
        overLimit * severanceRate * rules.nonPensionWithdrawal.deferredSeverancePayRate
      note =
        '퇴직소득세의 ' +
        Math.round(payRate * 100) +
        '% 적용 (연금수령 ' +
        input.pensionYearIndex +
        '년차)'
      if (overLimit > 0) note += ' / 한도 초과분은 감면 없이 100% 과세'
    } else {
      // 명세서 §5.1 / §5.4. 1,500만 원 초과 판정은 아래에서 다시 계산한다.
      tax = withinLimit * ageRate + overLimit * rules.nonPensionWithdrawal.taxableRate
      note = '연금소득세 ' + (ageRate * 100).toFixed(1) + '% (만 ' + input.age + '세)'
      if (overLimit > 0) {
        note +=
          ' / 한도 초과분은 기타소득세 ' +
          (rules.nonPensionWithdrawal.taxableRate * 100).toFixed(1) +
          '%'
      }
    }

    lines.push({
      source: kind,
      label: SOURCE_LABEL[kind],
      amount,
      withinLimit,
      overLimit,
      tax,
      effectiveRate: amount > 0 ? tax / amount : 0,
      note,
    })

    remaining -= amount
    cumulative += amount
  }

  // ---- 명세서 §5.3: 사적연금 분리과세 한도 판정 ----
  const taxableLine = lines.find((l) => l.source === 'TAXABLE')
  const subjectAmount = taxableLine?.withinLimit ?? 0
  const cap = rules.separateTaxation.annualCap

  const overCap: OverCapDecision = {
    exceeded: subjectAmount > cap,
    subjectAmount,
    comprehensiveTax: 0,
    flatTax: 0,
    chosen: 'WITHHOLDING',
  }

  if (overCap.exceeded && taxableLine) {
    overCap.flatTax = subjectAmount * rules.separateTaxation.overCapFlatRate
    overCap.comprehensiveTax = estimateComprehensiveTax(subjectAmount, input, rules)
    const useComprehensive = overCap.comprehensiveTax < overCap.flatTax
    overCap.chosen = useComprehensive ? 'COMPREHENSIVE' : 'FLAT'

    const chosenTax = useComprehensive ? overCap.comprehensiveTax : overCap.flatTax
    // 한도 이내분의 세액을 원천징수세율분에서 선택된 방식으로 교체한다
    taxableLine.tax = chosenTax + taxableLine.overLimit * rules.nonPensionWithdrawal.taxableRate
    taxableLine.effectiveRate =
      taxableLine.amount > 0 ? taxableLine.tax / taxableLine.amount : 0
    taxableLine.note = useComprehensive
      ? '연 1,500만 원 초과 → 종합과세가 유리하여 종합과세로 계산 (추정치)'
      : '연 1,500만 원 초과 → ' +
        (rules.separateTaxation.overCapFlatRate * 100).toFixed(1) +
        '% 분리과세가 유리'

    warnings.push(
      '사적연금 과세대상 수령액이 연 ' +
        toMan(cap) +
        '만 원을 초과했습니다. 인출액을 ' +
        toMan(subjectAmount - cap) +
        '만 원 줄이면 저율 분리과세로 끝낼 수 있습니다.',
    )
  }

  if (limit !== null && cumulative > limit) {
    warnings.push(
      '연금수령한도(' +
        toMan(limit) +
        '만 원)를 초과했습니다. 초과분은 연금외수령으로 불리하게 과세됩니다.',
    )
  }

  // 최적화 힌트 (명세서 §5.2) — 감면율 계단은 10년·20년 두 군데에 있다
  if (input.balance.deferredSeverance > 0) {
    if (input.pensionYearIndex === 10) {
      warnings.push(
        '내년(11년차)부터 이연퇴직소득 감면율이 30% → 40%로 올라갑니다. 인출을 미루면 유리할 수 있습니다.',
      )
    } else if (input.pensionYearIndex === 20) {
      warnings.push(
        '내년(21년차)부터 이연퇴직소득 감면율이 40% → 50%로 올라갑니다. 2026년 신설된 구간입니다.',
      )
    }
  }
  if (input.age === 69 || input.age === 79) {
    warnings.push(
      '내년에 연금소득세율이 ' +
        (ageRate * 100).toFixed(1) +
        '% → ' +
        (input.age === 69 ? '4.4' : '3.3') +
        '%로 내려갑니다.',
    )
  }

  const totalTax = Math.round(lines.reduce((sum, l) => sum + l.tax, 0))

  return {
    targetAmount: input.targetAmount,
    withdrawnAmount,
    shortfall,
    withdrawalLimit: limit,
    lines: lines.map((l) => ({ ...l, tax: Math.round(l.tax) })),
    overCap,
    totalTax,
    netAmount: withdrawnAmount - totalTax,
    health: assessHealthInsurance(input, rules),
    warnings,
  }
}
