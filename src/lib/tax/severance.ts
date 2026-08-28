/**
 * 퇴직소득세 원천 계산 (명세서 §6)
 *
 * 이연퇴직소득(재원2)을 인출할 때 매기는 세금은 "퇴직 시점에 계산됐을 퇴직소득세"를
 * 기준으로 하므로, 그 원본을 먼저 구해야 한다.
 */
import type { SeveranceBasis } from './types'
import { getRules, type TaxRules } from './rules'

export interface SeveranceTaxResult {
  /** 퇴직소득금액 = 퇴직급여액 − 비과세소득 */
  incomeAmount: number
  serviceYearDeduction: number
  /** 환산급여 */
  convertedIncome: number
  convertedIncomeDeduction: number
  taxBase: number
  /** 퇴직소득세 (지방소득세 제외) */
  incomeTax: number
  localTax: number
  /** 지방소득세 포함 총 퇴직소득세 */
  totalTax: number
  /** 퇴직급여액 대비 실효세율. 인출액에 곱해 쓰기 위한 값 */
  effectiveRate: number
}

/** 근속연수공제 (명세서 §6) */
function serviceYearDeduction(years: number, rules: TaxRules): number {
  for (const band of rules.severanceTax.serviceYearDeduction) {
    if (band.upToYears === null || years <= band.upToYears) {
      return band.base + (years - band.fromYear) * band.perYear
    }
  }
  return 0
}

/** 환산급여공제 (명세서 §6) */
function convertedIncomeDeduction(converted: number, rules: TaxRules): number {
  for (const band of rules.severanceTax.convertedIncomeDeduction) {
    if (band.upTo === null || converted <= band.upTo) {
      return band.base + (converted - band.from) * band.rate
    }
  }
  return 0
}

/** 기본세율 누진 계산 (명세서 §6) */
export function applyBaseRates(taxBase: number, rules: TaxRules): number {
  if (taxBase <= 0) return 0
  for (const band of rules.severanceTax.baseRates) {
    if (band.upTo === null || taxBase <= band.upTo) {
      return taxBase * band.rate - band.progressiveDeduction
    }
  }
  return 0
}

export function calculateSeveranceTax(
  basis: SeveranceBasis,
  year?: number,
): SeveranceTaxResult {
  const rules = getRules(year)
  const years = Math.max(1, Math.ceil(basis.serviceYears))

  const incomeAmount = Math.max(0, basis.severancePay - (basis.taxExemptAmount ?? 0))
  const yearDeduction = serviceYearDeduction(years, rules)

  // 환산급여 = (퇴직소득금액 − 근속연수공제) ÷ 근속연수 × 12
  const convertedIncome = Math.max(0, ((incomeAmount - yearDeduction) / years) * 12)
  const convDeduction = Math.min(
    convertedIncome,
    convertedIncomeDeduction(convertedIncome, rules),
  )

  const taxBase = Math.max(0, convertedIncome - convDeduction)

  // 환산산출세액 ÷ 12 × 근속연수
  const incomeTax = Math.max(0, (applyBaseRates(taxBase, rules) / 12) * years)
  const localTax = incomeTax * rules.localIncomeTaxSurcharge
  const totalTax = incomeTax + localTax

  return {
    incomeAmount,
    serviceYearDeduction: yearDeduction,
    convertedIncome,
    convertedIncomeDeduction: convDeduction,
    taxBase,
    incomeTax,
    localTax,
    totalTax,
    effectiveRate: incomeAmount > 0 ? totalTax / incomeAmount : 0,
  }
}
