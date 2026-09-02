'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateWithdrawalRange, type WithdrawalRangeResult } from '@/lib/tax'
import { AssumptionList } from './AssumptionList'
import { BasicInputs } from './BasicInputs'
import { HealthInsuranceSection } from './HealthInsuranceSection'
import { HintList } from './HintList'
import { LedgerTable } from './LedgerTable'
import { RefineQuestions } from './RefineQuestions'
import { ResultSummary } from './ResultSummary'
import { EMPTY_FORM, isReady, type FormState } from './types'

/**
 * 유일한 상태 보유자 (설계 스펙 §5.2).
 * 나머지 컴포넌트는 props 만 받는 표시 컴포넌트다. Phase 2 다년도 화면에서
 * LedgerTable·AssumptionList·HintList 를 연도별로 그대로 재사용하기 위한 경계다.
 *
 * 계산은 순수 함수라 매우 빠르다. 디바운스 없이 매 입력마다 다시 계산한다 (§5.3).
 * 슬라이더를 끌 때 숫자가 즉시 따라오는 것이 이 화면의 핵심 경험이다.
 */
const STORAGE_KEY = 'pension-plan:form:v1'
const SAVE_DEBOUNCE_MS = 500
const PENSION_MIN_AGE = 55

type Calculated =
  | { ok: true; result: WithdrawalRangeResult }
  | { ok: false; message: string }

export function Calculator() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [restored, setRestored] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 복원은 마운트 이후에만 한다. 서버 렌더 결과와 어긋나면 hydration 이 깨진다 (§5.4).
  // 렌더 중에 localStorage 를 읽으면 서버(빈 폼)와 클라이언트(저장된 폼)의 첫 렌더가 달라진다.
  // 그래서 effect 안의 setState 가 여기서는 회피 대상이 아니라 요구사항이다. 마운트 시 1회만 돈다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 위 주석 참조
        setForm({ ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<FormState>) })
        setSaved(true)
      }
    } catch {
      // 시크릿 모드·저장 차단 환경에서는 그냥 복원하지 않는다
    }
    setRestored(true)
  }, [])

  const serialized = JSON.stringify(form)
  const untouched = serialized === JSON.stringify(EMPTY_FORM)

  useEffect(() => {
    if (!restored) return // 복원 전에 빈 폼을 덮어쓰지 않는다
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        // 손대지 않은 폼까지 저장하면 아무것도 입력하지 않은 사람에게 "저장됨"이 뜬다
        if (untouched) {
          window.localStorage.removeItem(STORAGE_KEY)
          setSaved(false)
        } else {
          window.localStorage.setItem(STORAGE_KEY, serialized)
          setSaved(true)
        }
      } catch {
        // 저장이 막혀 있어도 계산은 계속된다
      }
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [serialized, untouched, restored])

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const clearSaved = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 지울 게 없으면 그만이다
    }
    setForm(EMPTY_FORM)
    setSaved(false)
  }

  const ready = isReady(form)

  const calculated = useMemo<Calculated | null>(() => {
    if (!ready) return null
    try {
      return { ok: true, result: calculateWithdrawalRange(form) }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : '알 수 없는 오류' }
    }
  }, [form, ready])

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3 text-xs text-black/50 dark:text-white/50">
        <span>입력값은 이 브라우저에만 저장되며 서버로 전송되지 않습니다.</span>
        {saved ? (
          <span className="whitespace-nowrap">
            저장됨 ·{' '}
            <button
              type="button"
              onClick={clearSaved}
              className="underline underline-offset-2 hover:text-black dark:hover:text-white"
            >
              지우기
            </button>
          </span>
        ) : null}
      </div>

      {form.age < PENSION_MIN_AGE ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          연금 형태의 수령은 만 {PENSION_MIN_AGE}세부터 가능합니다. 아래 계산은 만{' '}
          {PENSION_MIN_AGE}세 이상이라는 전제에서만 의미가 있습니다.
        </p>
      ) : null}

      <BasicInputs form={form} onChange={update} />

      {calculated === null ? (
        <section className="rounded-xl border border-dashed border-black/15 px-5 py-10 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
          계좌 총잔액을 입력하고 퇴직금 수령 여부를 선택하시면 계산해 드립니다.
        </section>
      ) : !calculated.ok ? (
        <section className="rounded-xl border border-red-500/40 bg-red-50 px-5 py-6 text-sm text-red-950 dark:bg-red-500/10 dark:text-red-100">
          <p className="font-medium">계산 중 문제가 발생했습니다.</p>
          <p className="mt-1 text-xs">{calculated.message}</p>
          <p className="mt-2 text-xs">
            입력값을 바꿔 다시 시도해 보시거나,{' '}
            <a
              href="https://github.com/Poly-Port/pension-plan/blob/main/docs/tax-rules-2026.md"
              className="underline underline-offset-2"
            >
              계산 근거 문서
            </a>
            를 확인해 주세요.
          </p>
        </section>
      ) : (
        <>
          <ResultSummary
            result={calculated.result}
            totalBalance={form.totalBalance}
            targetAmount={form.targetAmount}
            onTargetChange={(won) => update({ targetAmount: won })}
          />
          <RefineQuestions result={calculated.result} form={form} onChange={update} />
          <LedgerTable result={calculated.result.representative} />
          <AssumptionList assumptions={calculated.result.assumptions} />
          <HintList warnings={calculated.result.representative.warnings} />
          <HealthInsuranceSection
            result={calculated.result.representative}
            form={form}
            onChange={update}
          />
        </>
      )}
    </div>
  )
}
