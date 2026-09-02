'use client'

import type { HealthInsuranceStatus, WithdrawalResult } from '@/lib/tax'
import { ChoiceGroup, Field, ManInput } from './fields'
import type { FormState } from './types'

/**
 * ⑤ 건강보험료 판정 — 접힘 상태로 두고 펼칠 때 묻는다 (설계 스펙 §3.3).
 * 값이 비면 엔진이 판정을 생략하고, 화면은 그 사실을 그대로 보여준다.
 */
const STATUS_OPTIONS = [
  { value: 'DEPENDENT' as const, label: '피부양자' },
  { value: 'LOCAL' as const, label: '지역가입자' },
  { value: 'EMPLOYEE' as const, label: '직장가입자' },
  { value: 'unknown' as const, label: '잘 모르겠어요' },
]

export function HealthInsuranceSection({
  result,
  form,
  onChange,
}: {
  result: WithdrawalResult
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  const status = form.healthInsuranceStatus ?? 'unknown'
  const propertyUnknown = form.propertyTaxBase === 'unknown' || form.propertyTaxBase === undefined
  const kept = result.health.dependentKept

  return (
    <details className="rounded-lg border border-black/10 dark:border-white/15">
      <summary className="cursor-pointer px-4 py-3 text-base font-semibold">
        건강보험료에 영향이 있나요?
      </summary>

      <div className="space-y-5 border-t border-black/10 px-4 py-4 dark:border-white/15">
        <p className="text-sm text-black/60 dark:text-white/60">
          사적연금 수령액 자체는 건강보험료 산정에 들어가지 않습니다. 다만 피부양자라면 다른
          소득·재산 때문에 자격을 잃을 수 있어 함께 확인합니다.
        </p>

        <Field label="건강보험 자격">
          <ChoiceGroup
            name="건강보험 자격"
            value={status as HealthInsuranceStatus | 'unknown'}
            options={STATUS_OPTIONS}
            onChange={(v) => onChange({ healthInsuranceStatus: v })}
          />
        </Field>

        <Field
          label="재산세 과세표준 합계"
          htmlFor="property-tax-base"
          hint="위택스(wetax.go.kr) → 재산세 조회에서 확인할 수 있습니다."
        >
          <div className="max-w-xs">
            <ManInput
              id="property-tax-base"
              value={propertyUnknown ? 0 : (form.propertyTaxBase as number)}
              disabled={propertyUnknown}
              placeholder="예: 45,000"
              onChange={(won) => onChange({ propertyTaxBase: won })}
            />
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={propertyUnknown}
              onChange={(e) =>
                onChange({ propertyTaxBase: e.target.checked ? 'unknown' : 0 })
              }
            />
            잘 모르겠어요
          </label>
        </Field>

        <div
          className={
            'rounded-lg px-4 py-3 text-sm ' +
            (kept === null
              ? 'bg-black/[.04] dark:bg-white/[.06]'
              : kept
                ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100'
                : 'bg-red-50 text-red-950 dark:bg-red-500/10 dark:text-red-100')
          }
        >
          <p className="font-medium">
            {kept === null ? '판정 생략' : kept ? '피부양자 자격 유지 가능' : '피부양자 자격 상실 가능'}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {result.health.reasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
