/**
 * 퇴직연금 인출 계산 엔진 - 타입 정의
 * 근거 문서: docs/tax-rules-2026.md
 *
 * 금액 단위는 전부 "원"이다. 화면에서 만원으로 바꿔 보여주더라도 엔진은 원으로만 계산한다.
 */

/** 연금계좌 재원 구분 (명세서 §1) */
export type FundSource =
  | 'TAX_FREE' // 재원1: 과세제외금액 (세액공제 받지 않은 자기부담금)
  | 'DEFERRED_SEVERANCE' // 재원2: 이연퇴직소득
  | 'TAXABLE' // 재원3: 세액공제 받은 납입액 + 운용수익

export type HealthInsuranceStatus = 'DEPENDENT' | 'LOCAL' | 'EMPLOYEE'

/** 연금계좌 잔액을 재원별로 쪼갠 것 */
export interface AccountBalance {
  taxFree: number
  deferredSeverance: number
  taxable: number
}

/** 이연퇴직소득의 세금을 산출하기 위한 원본 퇴직 정보 (명세서 §6) */
export interface SeveranceBasis {
  /** 퇴직급여액 (비과세소득 제외 전) */
  severancePay: number
  /** 근속연수 (1년 미만은 1년으로 올림) */
  serviceYears: number
  /** 비과세소득 */
  taxExemptAmount?: number
}

/** 연금계좌 밖의 소득 (건보료 판정·종합과세 계산에 사용) */
export interface OtherIncome {
  /** 공적연금 (국민연금 등) */
  publicPension: number
  /** 근로 + 사업 + 임대 소득 */
  earnedAndBusiness: number
  /** 금융소득 (이자 + 배당) */
  financial: number
}

export interface WithdrawalInput {
  /** 수령 시 만 나이 */
  age: number
  /** 연금수령연차 (명세서 §3) */
  pensionYearIndex: number
  balance: AccountBalance
  /** 이번 연도 목표 인출액 */
  targetAmount: number
  severanceBasis?: SeveranceBasis
  /** 종신연금 형태 여부 (명세서 §5.1) */
  isLifetimeAnnuity?: boolean
  otherIncome: OtherIncome
  healthInsuranceStatus: HealthInsuranceStatus
  /** 재산세 과세표준 합계 */
  propertyTaxBase: number
}

/** 재원별 인출·과세 내역 한 줄 */
export interface WithdrawalLine {
  source: FundSource
  label: string
  /** 이 재원에서 인출한 총액 */
  amount: number
  /** 그중 연금수령한도 이내 (= 연금수령) */
  withinLimit: number
  /** 그중 한도 초과분 (= 연금외수령) */
  overLimit: number
  tax: number
  /** 이 재원의 실효세율 (tax / amount) */
  effectiveRate: number
  note: string
}

/** 1,500만 원 초과 시 과세방식 선택 결과 (명세서 §5.3) */
export interface OverCapDecision {
  exceeded: boolean
  /** 판정 대상 금액 = 재원3의 연금수령액 */
  subjectAmount: number
  /** (a) 종합과세로 계산한 세액 — 추정치 */
  comprehensiveTax: number
  /** (b) 16.5% 분리과세로 계산한 세액 */
  flatTax: number
  chosen: 'WITHHOLDING' | 'COMPREHENSIVE' | 'FLAT'
}

export interface HealthAssessment {
  status: HealthInsuranceStatus
  /** 피부양자 자격 유지 가능 여부 (피부양자인 경우에만 의미 있음) */
  dependentKept: boolean | null
  /** 건보료 판정에 합산된 소득 */
  countedIncome: number
  reasons: string[]
}

export interface WithdrawalResult {
  targetAmount: number
  /** 실제로 인출 가능한 금액 (잔액 부족 시 목표보다 작을 수 있음) */
  withdrawnAmount: number
  /** 잔액 부족분 */
  shortfall: number
  /** 연금수령한도. null이면 한도 없음(11년차 이상) */
  withdrawalLimit: number | null
  lines: WithdrawalLine[]
  overCap: OverCapDecision
  totalTax: number
  netAmount: number
  health: HealthAssessment
  warnings: string[]
}
