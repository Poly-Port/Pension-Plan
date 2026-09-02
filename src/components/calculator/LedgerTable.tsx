import type { WithdrawalResult } from '@/lib/tax'
import { formatMan } from '@/lib/format'

/**
 * ④ 상세 리포트 — 재원별 차감 내역.
 * 인출 순서(비과세 → 이연퇴직소득 → 세액공제분)는 법정이라 사용자가 바꿀 수 없다.
 * 그래서 이 표는 "어떻게 빠져나갔는지"를 보여줄 뿐 조작 대상이 아니다.
 */
export function LedgerTable({ result }: { result: WithdrawalResult }) {
  if (result.lines.length === 0) return null

  return (
    <section aria-labelledby="ledger" className="space-y-3">
      <h2 id="ledger" className="text-base font-semibold">
        재원별 차감 내역
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs text-black/55 dark:border-white/15 dark:text-white/55">
              <th scope="col" className="py-2 pr-3 font-medium">
                재원 (법정 인출 순서)
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                인출액
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                한도 초과분
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                세금
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                실효세율
              </th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line, i) => (
              <tr key={line.source} className="border-b border-black/[.06] dark:border-white/10">
                <td className="py-2.5 pr-3">
                  <span className="text-black/40 dark:text-white/40">{i + 1}. </span>
                  {line.label}
                  <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{line.note}</p>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{formatMan(line.amount)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {line.overLimit > 0 ? formatMan(line.overLimit) : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{formatMan(line.tax)}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {(line.effectiveRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2.5 pr-3">합계</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {formatMan(result.withdrawnAmount)}
              </td>
              <td />
              <td className="py-2.5 pr-3 text-right tabular-nums">{formatMan(result.totalTax)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
