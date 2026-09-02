/**
 * 금액 표시·입력 변환.
 *
 * 엔진은 "원"으로만 계산하고, 화면은 "만원"으로만 묻고 답한다 (설계 스펙 §5.5).
 * 그 경계를 이 파일 하나로 모은다.
 */
const MAN = 10_000

export function manToWon(man: number): number {
  return man * MAN
}

export function wonToMan(won: number): number {
  return Math.round(won / MAN)
}

export function formatComma(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function formatMan(won: number): string {
  return formatComma(wonToMan(won)) + '만원'
}

/** 사용자가 만원 단위로 친 값을 읽는다. 읽을 수 없으면 null */
export function parseManInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (cleaned === '') return null
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}
