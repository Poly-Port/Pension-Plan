'use client'

import type { MissingField, WithdrawalRangeResult } from '@/lib/tax'
import { Field, ManInput } from './fields'
import type { FormState } from './types'

/**
 * ③ 더 정확하게 (설계 스펙 §3.2).
 * "입력하세요"가 아니라 "알려주시면 이만큼 정확해집니다"로 제시한다.
 * 질문 목록은 화면이 지어내지 않고 엔진의 `missing` 에서 그대로 나온다.
 */

/** 여기서 직접 답할 수 있는 항목 */
const INLINE = new Set(['taxFree', 'otherIncome'])

/** 다른 자리에 이미 입력칸이 있는 항목 */
const ELSEWHERE: Record<string, string> = {
  'severance.amount': "위 '내 상황'에서 답할 수 있습니다",
  'severance.serviceYears': "위 '내 상황'에서 답할 수 있습니다",
  healthInsuranceStatus: '아래 건강보험료 항목에서 답할 수 있습니다',
  propertyTaxBase: '아래 건강보험료 항목에서 답할 수 있습니다',
}

function ImpactBadge({ impact }: { impact: MissingField['impact'] }) {
  if (impact === 'high') {
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-500/15 dark:text-red-300">
        세금이 크게 달라짐
      </span>
    )
  }
  return (
    <span className="rounded bg-black/[.06] px-1.5 py-0.5 text-[11px] text-black/60 dark:bg-white/10 dark:text-white/60">
      {impact === 'low' ? '조금 달라짐' : '영향 없음'}
    </span>
  )
}

export function RefineQuestions({
  result,
  form,
  onChange,
}: {
  result: WithdrawalRangeResult
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  if (result.missing.length === 0) return null

  const income =
    form.otherIncome === 'unknown' || form.otherIncome === undefined
      ? { publicPension: 0, earnedAndBusiness: 0, financial: 0 }
      : form.otherIncome
  const incomeUnknown = form.otherIncome === 'unknown' || form.otherIncome === undefined

  return (
    <section aria-labelledby="refine" className="space-y-4">
      <div>
        <h2 id="refine" className="text-base font-semibold">
          더 정확하게
        </h2>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          알려주시면 그만큼 범위가 좁아집니다. 답하지 않아도 계산은 됩니다.
        </p>
      </div>

      <ul className="space-y-3">
        {result.missing.map((m) => (
          <li
            key={m.field}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{m.question}</p>
              <ImpactBadge impact={m.impact} />
            </div>

            {ELSEWHERE[m.field] ? (
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                {ELSEWHERE[m.field]}
              </p>
            ) : null}

            {m.field === 'taxFree' && INLINE.has(m.field) ? (
              <div className="mt-3 max-w-xs">
                <ManInput
                  id="tax-free"
                  value={form.taxFree === 'unknown' || form.taxFree === undefined ? 0 : form.taxFree}
                  placeholder="0"
                  onChange={(won) => onChange({ taxFree: won })}
                />
              </div>
            ) : null}

            {m.field === 'otherIncome' && INLINE.has(m.field) ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="공적연금" htmlFor="income-public">
                    <ManInput
                      id="income-public"
                      value={income.publicPension}
                      disabled={incomeUnknown}
                      onChange={(won) =>
                        onChange({ otherIncome: { ...income, publicPension: won } })
                      }
                    />
                  </Field>
                  <Field label="근로·사업" htmlFor="income-earned">
                    <ManInput
                      id="income-earned"
                      value={income.earnedAndBusiness}
                      disabled={incomeUnknown}
                      onChange={(won) =>
                        onChange({ otherIncome: { ...income, earnedAndBusiness: won } })
                      }
                    />
                  </Field>
                  <Field label="금융소득" htmlFor="income-financial">
                    <ManInput
                      id="income-financial"
                      value={income.financial}
                      disabled={incomeUnknown}
                      onChange={(won) => onChange({ otherIncome: { ...income, financial: won } })}
                    />
                  </Field>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={incomeUnknown}
                    onChange={(e) =>
                      onChange({
                        otherIncome: e.target.checked
                          ? 'unknown'
                          : { publicPension: 0, earnedAndBusiness: 0, financial: 0 },
                      })
                    }
                  />
                  잘 모르겠어요
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
