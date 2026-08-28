/**
 * 세법 규칙 데이터 로더.
 * 세율·한도 같은 숫자는 코드에 박지 않고 src/lib/rules/<연도>.json 에서만 읽는다.
 * 세법이 개정되면 JSON 파일만 추가하면 된다. (docs/tax-rules-2026.md 참조)
 */
import rules2026 from '../rules/2026.json'

export type TaxRules = typeof rules2026

const REGISTRY: Record<number, TaxRules> = {
  2026: rules2026,
}

export const DEFAULT_RULE_YEAR = 2026

export function getRules(year: number = DEFAULT_RULE_YEAR): TaxRules {
  const found = REGISTRY[year]
  if (!found) {
    throw new Error(
      `${year}년 세법 규칙이 없습니다. 사용 가능한 연도: ${Object.keys(REGISTRY).join(', ')}`,
    )
  }
  return found
}

export function availableRuleYears(): number[] {
  return Object.keys(REGISTRY)
    .map(Number)
    .sort((a, b) => a - b)
}
