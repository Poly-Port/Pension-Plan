/**
 * 미지값을 범위로 다루는 래퍼 (설계 스펙 §4)
 *
 * 기존 calculateWithdrawal 은 수정하지 않는다. 그 위에 얹는다.
 * 미지값을 어떻게 다룰지는 도메인 판단이므로 React 컴포넌트가 아니라 여기에 둔다.
 */
import type {
  HealthAssessment,
  HealthInsuranceStatus,
  OtherIncome,
  SeveranceBasis,
  WithdrawalInput,
  WithdrawalResult,
} from './types'
import { DEFAULT_RULE_YEAR, getRules } from './rules'
import { calculateWithdrawal } from './withdrawal'

export type Maybe<T> = T | 'unknown'

/** 퇴직금 정보. 금액·근속연수는 각각 따로 모를 수 있다 */
export interface PartialSeverance {
  amount: Maybe<number>
  serviceYears: Maybe<number>
}

export interface PartialWithdrawalInput {
  /** 1단계 (필수) */
  age: number
  /** 연금을 받기 시작한 해. null 이면 아직 미수령 → 1년차 */
  pensionStartYear: number | null
  totalBalance: number
  /** null = 퇴직금을 이 계좌로 받지 않음 */
  severance: PartialSeverance | null
  targetAmount: number

  /** 2단계 이후 (조건부) */
  taxFree?: Maybe<number>
  otherIncome?: Maybe<OtherIncome>
  healthInsuranceStatus?: Maybe<HealthInsuranceStatus>
  propertyTaxBase?: Maybe<number>
  isLifetimeAnnuity?: boolean
}

export type Impact = 'none' | 'low' | 'high'

/** 몰라서 대신 세운 전제. 화면 문구를 그대로 만든다 */
export interface Assumption {
  field: string
  reason: string
  impact: Impact
  howToConfirm?: string
}

/** 아직 답하지 않은 값. 화면의 후속 질문을 그대로 만든다 */
export interface MissingField {
  field: string
  question: string
  impact: Impact
}

export interface WithdrawalRangeResult {
  /** true면 세금이 확정됐다는 뜻 (min.totalTax === max.totalTax) */
  certain: boolean
  min: WithdrawalResult
  max: WithdrawalResult
  representative: WithdrawalResult
  assumptions: Assumption[]
  missing: MissingField[]
}

/** §4.3 — 연금수령연차는 "받기 시작한 해"에서 도출한다. 미수령이면 1년차 */
export function derivePensionYearIndex(
  pensionStartYear: number | null,
  year: number,
): number {
  if (pensionStartYear === null) return 1
  return Math.max(1, year - pensionStartYear + 1)
}

/**
 * 근속연수를 모를 때의 상한.
 * 근로 가능 최소 연령(만 18세)부터 지금까지 쉬지 않고 일했다고 볼 때의 연수다.
 * 근속연수가 길수록 근속연수공제가 커져 퇴직소득세가 낮아지므로, 1년과 이 값이 양 끝이 된다.
 */
const MIN_WORKING_AGE = 18

const NO_OTHER_INCOME: OtherIncome = {
  publicPension: 0,
  earnedAndBusiness: 0,
  financial: 0,
}

const ZERO_TAX_FREE_ASSUMPTION: Assumption = {
  field: 'taxFree',
  reason:
    '과세제외금액(세액공제를 받지 않은 납입액)이 없다고 가정했습니다. ' +
    '세액공제 한도를 넘겨 납입한 적이 없다면 실제로 0원입니다.',
  impact: 'low',
  howToConfirm: '증권사·은행 앱 → 연금계좌 → 과세구분에서 "과세제외금액"을 확인하세요.',
}

const QUESTION: Record<string, string> = {
  taxFree: '세액공제를 받지 않고 납입한 금액(과세제외금액)이 있나요?',
  'severance.amount': '이 계좌로 받은 퇴직금은 얼마인가요?',
  'severance.serviceYears': '퇴직할 때 근속연수는 몇 년이었나요?',
  otherIncome: '연금계좌 밖 소득(공적연금·근로·사업·금융)이 연간 얼마인가요?',
  healthInsuranceStatus: '건강보험 자격이 무엇인가요? (피부양자 / 지역가입자 / 직장가입자)',
  propertyTaxBase: '재산세 과세표준 합계가 얼마인가요?',
}

const isUnknown = <T>(v: Maybe<T> | undefined): v is 'unknown' | undefined =>
  v === 'unknown' || v === undefined

/** 한 번의 계산에 실제로 들어가는, 미지가 사라진 값 묶음 */
interface Scenario {
  deferredSeverance: number
  severanceBasis?: SeveranceBasis
  otherIncome: OtherIncome
}

/**
 * 타 소득을 모를 때의 "가장 불리한" 쪽.
 *
 * 1,500만 원 초과분의 세액은 min(종합과세, 16.5% 분리과세)로 정해지고
 * 종합과세액은 타 소득이 많을수록 커지므로, 세액의 상한은 언제나 16.5% 분리과세다.
 * 최고세율 구간의 소득을 넣어 그 상한을 그대로 끌어낸다.
 * (이 값은 세액 상한을 뽑아내는 수단일 뿐이며, 건보 판정은 아래에서 생략 처리한다.)
 */
function pessimisticOtherIncome(year: number): OtherIncome {
  const rates = getRules(year).severanceTax.baseRates
  const topBracketFrom = rates[rates.length - 2].upTo ?? 0
  return { ...NO_OTHER_INCOME, earnedAndBusiness: topBracketFrom }
}

/** 미지 필드마다 경계값을 뽑아 조합을 만든다 (§4.4) */
function buildScenarios(
  input: PartialWithdrawalInput,
  taxFree: number,
  year: number,
): Scenario[] {
  const severanceRoom = Math.max(0, input.totalBalance - taxFree)

  const amounts: number[] =
    input.severance === null
      ? [0]
      : isUnknown(input.severance.amount)
        ? [0, severanceRoom]
        : [input.severance.amount]

  const serviceYearsList: number[] =
    input.severance === null || isUnknown(input.severance.serviceYears)
      ? [1, Math.max(1, input.age - MIN_WORKING_AGE)]
      : [input.severance.serviceYears]

  const incomes: OtherIncome[] = isUnknown(input.otherIncome)
    ? [NO_OTHER_INCOME, pessimisticOtherIncome(year)]
    : [input.otherIncome]

  const scenarios: Scenario[] = []
  for (const amount of amounts) {
    for (const serviceYears of serviceYearsList) {
      for (const otherIncome of incomes) {
        scenarios.push({
          deferredSeverance: amount,
          // 이연퇴직소득이 없으면 퇴직소득세 계산 자체가 필요 없다
          severanceBasis:
            amount > 0 ? { severancePay: amount, serviceYears } : undefined,
          otherIncome,
        })
      }
    }
  }
  return scenarios
}

/**
 * §3.4 — 모르는 값을 그럴듯한 기본값으로 덮어 정확한 척하지 않는다.
 * 건보 판정에 필요한 값이 하나라도 비면 판정 자체를 생략한다.
 */
function omitHealthAssessment(
  status: HealthInsuranceStatus,
  reasons: string[],
): HealthAssessment {
  return { status, dependentKept: null, countedIncome: 0, reasons }
}

export function calculateWithdrawalRange(
  input: PartialWithdrawalInput,
  year: number = DEFAULT_RULE_YEAR,
): WithdrawalRangeResult {
  const assumptions: Assumption[] = []
  const missing: MissingField[] = []
  const ask = (field: string, impact: Impact) =>
    missing.push({ field, question: QUESTION[field], impact })

  const taxFreeUnknown = isUnknown(input.taxFree)
  const taxFree = taxFreeUnknown ? 0 : (input.taxFree as number)
  if (taxFreeUnknown) {
    assumptions.push(ZERO_TAX_FREE_ASSUMPTION)
    ask('taxFree', 'low')
  }

  if (input.severance !== null) {
    if (isUnknown(input.severance.amount)) ask('severance.amount', 'high')
    if (isUnknown(input.severance.serviceYears)) ask('severance.serviceYears', 'high')
  }

  const statusUnknown = isUnknown(input.healthInsuranceStatus)
  const propertyUnknown = isUnknown(input.propertyTaxBase)
  const incomeUnknown = isUnknown(input.otherIncome)
  const status = statusUnknown ? 'DEPENDENT' : (input.healthInsuranceStatus as HealthInsuranceStatus)

  if (statusUnknown) ask('healthInsuranceStatus', 'low')
  if (propertyUnknown) ask('propertyTaxBase', 'low')

  const pensionYearIndex = derivePensionYearIndex(input.pensionStartYear, year)

  const results = buildScenarios(input, taxFree, year).map((s) => {
    const engineInput: WithdrawalInput = {
      age: input.age,
      pensionYearIndex,
      balance: {
        taxFree,
        deferredSeverance: s.deferredSeverance,
        taxable: input.totalBalance - taxFree - s.deferredSeverance,
      },
      targetAmount: input.targetAmount,
      severanceBasis: s.severanceBasis,
      isLifetimeAnnuity: input.isLifetimeAnnuity,
      otherIncome: s.otherIncome,
      healthInsuranceStatus: status,
      propertyTaxBase: propertyUnknown ? 0 : (input.propertyTaxBase as number),
    }
    return calculateWithdrawal(engineInput, year)
  })

  // 건보 판정에 쓰이는 값이 비었으면 판정 결과를 지우고 그 이유를 남긴다
  const omitReasons: string[] = []
  if (statusUnknown) omitReasons.push('건강보험 자격을 몰라 판정을 생략했습니다.')
  if (propertyUnknown) {
    omitReasons.push(
      '재산세 과세표준을 몰라 피부양자 판정을 생략했습니다. ' +
        '위택스(wetax.go.kr) → 재산세 조회에서 확인하실 수 있습니다.',
    )
  }
  if (incomeUnknown) {
    omitReasons.push('연금계좌 밖 소득을 몰라 건강보험 판정을 생략했습니다.')
  }
  const assessed = omitReasons.length
    ? results.map((r) => ({ ...r, health: omitHealthAssessment(status, omitReasons) }))
    : results

  const sorted = [...assessed].sort((a, b) => a.totalTax - b.totalTax)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  if (incomeUnknown) ask('otherIncome', max.overCap.exceeded ? 'high' : 'low')

  return {
    certain: min.totalTax === max.totalTax,
    min,
    max,
    // §4.2 — 세금 계산기에서 낙관적 값을 대표로 보여주면 실제 납부 시 "더 나왔다"가 된다
    representative: max,
    assumptions,
    missing,
  }
}
