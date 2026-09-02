import type { PartialWithdrawalInput } from '@/lib/tax'

/**
 * 화면 상태는 엔진 입력 타입 그 자체다 (설계 스펙 §5.3).
 * 중간 변환 계층을 만들지 않기 위해서다.
 *
 * 딱 하나 UI 전용 값을 얹는다. 엔진의 `severance: … | null` 에서 null 은
 * "퇴직금을 안 받았다"는 **답**이고, "아직 안 물어봤다"는 상태가 아니다.
 * 답하기 전에 안 받은 것으로 계산해 버리면 §3.4가 금지한 "그럴듯한 기본값"이 된다.
 */
export type FormState = PartialWithdrawalInput & {
  severanceAnswered: boolean
}

export const EMPTY_FORM: FormState = {
  age: 60,
  pensionStartYear: null,
  totalBalance: 0,
  severance: null,
  severanceAnswered: false,
  targetAmount: 0,
}

/** 결과를 보여줄 수 있는 최소 조건 (§5.6 — 잔액 0/미입력이면 안내 문구로) */
export function isReady(form: FormState): boolean {
  return form.totalBalance > 0 && form.severanceAnswered
}
