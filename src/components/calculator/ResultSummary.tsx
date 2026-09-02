'use client'

import { getRules, type WithdrawalRangeResult } from '@/lib/tax'
import { formatMan } from '@/lib/format'

/**
 * ② 결과 (설계 스펙 §5.1).
 * 슬라이더 눈금에 1,500만 원과 연금수령한도를 찍는다.
 * 세금이 계단식으로 튀는 지점을 직접 만져보게 하는 것이 설명 열 줄보다 낫다.
 */
export function ResultSummary({
  result,
  totalBalance,
  targetAmount,
  onTargetChange,
}: {
  result: WithdrawalRangeResult
  totalBalance: number
  targetAmount: number
  onTargetChange: (won: number) => void
}) {
  const rep = result.representative
  const cap = getRules().separateTaxation.annualCap
  const limit = rep.withdrawalLimit

  // 눈금이 서로 가까우면 아래 줄로 내려 글자가 겹치지 않게 한다.
  // 1,500만 원과 연금수령한도는 잔액이 클수록 붙어 버린다.
  const CROWDED_GAP_PERCENT = 18
  const marks = [
    { at: cap, label: '1,500만' },
    ...(limit !== null && limit <= totalBalance ? [{ at: limit, label: '연금수령한도' }] : []),
  ]
    .filter((m) => m.at > 0 && m.at <= totalBalance)
    .sort((a, b) => a.at - b.at)
    .reduce<Array<{ at: number; label: string; percent: number; row: number }>>((acc, m) => {
      const percent = (m.at / totalBalance) * 100
      const prev = acc[acc.length - 1]
      const crowded = prev !== undefined && percent - prev.percent < CROWDED_GAP_PERCENT
      return [...acc, { ...m, percent, row: crowded ? prev.row + 1 : 0 }]
    }, [])

  const effectiveRate = rep.withdrawnAmount > 0 ? rep.totalTax / rep.withdrawnAmount : 0

  return (
    <section aria-labelledby="result" className="space-y-5">
      <h2 id="result" className="text-base font-semibold">
        결과
      </h2>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <label htmlFor="target-slider" className="font-medium">
            인출액
          </label>
          <span className="tabular-nums">{formatMan(targetAmount)}</span>
        </div>
        <input
          id="target-slider"
          type="range"
          min={0}
          max={totalBalance}
          step={1_000_000}
          value={Math.min(targetAmount, totalBalance)}
          onChange={(e) => onTargetChange(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="relative h-10 text-[11px] text-black/50 dark:text-white/50">
          {marks.map((m) => (
            <div key={m.label} className="absolute top-0" style={{ left: `${m.percent}%` }}>
              <span aria-hidden className="block h-2 w-px bg-black/25 dark:bg-white/30" />
              <span
                className={
                  'absolute whitespace-nowrap ' +
                  // 양 끝에서는 가운데 정렬하면 라벨이 트랙 밖으로 잘린다
                  (m.percent < 10
                    ? 'left-0'
                    : m.percent > 90
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2')
                }
                style={{ top: 12 + m.row * 14 }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl bg-black/[.04] p-5 sm:grid-cols-2 dark:bg-white/[.06]">
        <div>
          <p className="text-xs text-black/55 dark:text-white/55">예상 세금</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {result.certain
              ? formatMan(rep.totalTax)
              : `${formatMan(result.min.totalTax)} ~ ${formatMan(result.max.totalTax)}`}
          </p>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            실효세율 {(effectiveRate * 100).toFixed(1)}%
            {result.certain ? '' : ' (가장 불리한 경우)'}
          </p>
        </div>
        <div>
          <p className="text-xs text-black/55 dark:text-white/55">세후 실수령액</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {formatMan(rep.netAmount)}
          </p>
          {rep.shortfall > 0 ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
              잔액이 {formatMan(rep.shortfall)} 부족합니다
            </p>
          ) : null}
        </div>
      </div>

      {!result.certain ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          아직 모르는 값이 있어 범위로 계산했습니다. 위 실수령액은{' '}
          <strong>가장 불리한 경우</strong>를 기준으로 합니다. 아래 질문에 답하시면 좁혀집니다.
        </p>
      ) : null}

      <p className="text-xs text-black/50 dark:text-white/50">
        참고용 추정치이며 세무 자문이 아닙니다. 실제 납부세액은 개인의 다른 소득·공제에 따라
        달라질 수 있습니다.
      </p>

      {/* 모바일에서는 아래로 스크롤해도 세금·실수령액이 계속 보여야 한다 (§5.1) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-white/95 px-5 py-2.5 backdrop-blur sm:hidden dark:border-white/15 dark:bg-black/90">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-3 text-sm">
          <span className="text-black/55 dark:text-white/55">
            세금{' '}
            <strong className="font-semibold tabular-nums text-black dark:text-white">
              {result.certain
                ? formatMan(rep.totalTax)
                : `${formatMan(result.min.totalTax)}~${formatMan(result.max.totalTax)}`}
            </strong>
          </span>
          <span className="text-black/55 dark:text-white/55">
            실수령{' '}
            <strong className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
              {formatMan(rep.netAmount)}
            </strong>
          </span>
        </div>
      </div>
    </section>
  )
}
