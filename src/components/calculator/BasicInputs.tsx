'use client'

import { DEFAULT_RULE_YEAR } from '@/lib/tax'
import { ChoiceGroup, Field, ManInput } from './fields'
import type { FormState } from './types'

/**
 * ① 기본 입력 (설계 스펙 §3.1).
 * 처음 방문한 사람이 즉답할 수 있는 것만 묻는다. 나머지는 결과를 보여준 뒤에 묻는다.
 */
export function BasicInputs({
  form,
  onChange,
}: {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}) {
  const severanceChoice = !form.severanceAnswered ? '' : form.severance === null ? 'no' : 'yes'
  const sev = form.severance

  return (
    <section aria-labelledby="basic-inputs" className="space-y-5">
      <h2 id="basic-inputs" className="text-base font-semibold">
        내 상황
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="만 나이" htmlFor="age">
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={40}
            max={100}
            value={form.age}
            onChange={(e) => onChange({ age: Number(e.target.value) })}
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-right text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/20 dark:bg-white/5"
          />
        </Field>

        <Field
          label="연금을 받기 시작한 해"
          htmlFor="pension-start-year"
          hint="연금수령연차를 여기서 계산합니다. 아직 안 받았으면 1년차입니다."
        >
          <div className="flex items-center gap-3">
            <input
              id="pension-start-year"
              type="number"
              inputMode="numeric"
              min={2000}
              max={DEFAULT_RULE_YEAR}
              disabled={form.pensionStartYear === null}
              value={form.pensionStartYear ?? ''}
              onChange={(e) => onChange({ pensionStartYear: Number(e.target.value) })}
              className="w-28 rounded-md border border-black/15 bg-white px-3 py-2 text-right text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-black/5 disabled:text-black/40 dark:border-white/20 dark:bg-white/5 dark:disabled:bg-white/5"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={form.pensionStartYear === null}
                onChange={(e) =>
                  onChange({ pensionStartYear: e.target.checked ? null : DEFAULT_RULE_YEAR })
                }
              />
              아직 받기 전이에요
            </label>
          </div>
        </Field>

        <Field
          label="연금계좌 총잔액"
          htmlFor="total-balance"
          hint="IRP·연금저축 등 이 계좌의 전체 평가액"
        >
          <ManInput
            id="total-balance"
            value={form.totalBalance}
            placeholder="예: 25,000"
            onChange={(won) => onChange({ totalBalance: won })}
          />
        </Field>

        <Field
          label="올해 인출하려는 금액"
          htmlFor="target-amount"
          hint="아래 슬라이더로도 조절할 수 있습니다."
        >
          <ManInput
            id="target-amount"
            value={form.targetAmount}
            placeholder="예: 1,500"
            onChange={(won) => onChange({ targetAmount: won })}
          />
        </Field>
      </div>

      <Field
        label="퇴직금을 이 계좌로 받으셨나요?"
        hint="이 답 하나로 세금이 크게 갈립니다. 금액을 몰라도 괜찮습니다."
      >
        <ChoiceGroup
          name="퇴직금 수령 여부"
          value={severanceChoice}
          options={[
            { value: 'no', label: '아니요' },
            { value: 'yes', label: '네, 받았어요' },
          ]}
          onChange={(v) =>
            onChange(
              v === 'no'
                ? { severance: null, severanceAnswered: true }
                : {
                    severance: { amount: 'unknown', serviceYears: 'unknown' },
                    severanceAnswered: true,
                  },
            )
          }
        />
      </Field>

      {sev !== null && form.severanceAnswered ? (
        <div className="grid gap-5 rounded-lg border border-black/10 bg-black/[.02] p-4 sm:grid-cols-2 dark:border-white/15 dark:bg-white/[.03]">
          <Field label="받은 퇴직금" htmlFor="severance-amount">
            <ManInput
              id="severance-amount"
              value={sev.amount === 'unknown' ? 0 : sev.amount}
              disabled={sev.amount === 'unknown'}
              placeholder="예: 8,000"
              onChange={(won) => onChange({ severance: { ...sev, amount: won } })}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={sev.amount === 'unknown'}
                onChange={(e) =>
                  onChange({ severance: { ...sev, amount: e.target.checked ? 'unknown' : 0 } })
                }
              />
              잘 모르겠어요
            </label>
          </Field>

          <Field label="퇴직할 때 근속연수" htmlFor="service-years">
            <div className="relative">
              <input
                id="service-years"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                disabled={sev.serviceYears === 'unknown'}
                value={sev.serviceYears === 'unknown' ? '' : sev.serviceYears}
                onChange={(e) =>
                  onChange({ severance: { ...sev, serviceYears: Number(e.target.value) } })
                }
                className="w-full rounded-md border border-black/15 bg-white py-2 pr-10 pl-3 text-right text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-black/5 disabled:text-black/40 dark:border-white/20 dark:bg-white/5 dark:disabled:bg-white/5"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-black/45 dark:text-white/45">
                년
              </span>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={sev.serviceYears === 'unknown'}
                onChange={(e) =>
                  onChange({
                    severance: { ...sev, serviceYears: e.target.checked ? 'unknown' : 20 },
                  })
                }
              />
              잘 모르겠어요
            </label>
          </Field>
        </div>
      ) : null}
    </section>
  )
}
