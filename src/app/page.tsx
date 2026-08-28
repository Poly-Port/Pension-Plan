import { calculateWithdrawal } from '@/lib/tax'

// Phase 0 확인용 임시 페이지.
// 계산 엔진이 Next.js 안에서 정상 동작하는지 보여주는 것이 목적이며, Phase 1에서 실제 화면으로 교체한다.
const SAMPLE = {
  age: 63,
  pensionYearIndex: 3,
  balance: {
    taxFree: 20_000_000,
    deferredSeverance: 80_000_000,
    taxable: 150_000_000,
  },
  targetAmount: 25_000_000,
  severanceBasis: { severancePay: 80_000_000, serviceYears: 20 },
  otherIncome: {
    publicPension: 12_000_000,
    earnedAndBusiness: 5_000_000,
    financial: 2_000_000,
  },
  healthInsuranceStatus: 'DEPENDENT' as const,
  propertyTaxBase: 450_000_000,
}

const won = (v: number) => v.toLocaleString('ko-KR') + '원'
const man = (v: number) => Math.round(v / 10000).toLocaleString('ko-KR') + '만원'

export default function Home() {
  const result = calculateWithdrawal(SAMPLE)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
      <header className="border-b border-black/10 pb-6 dark:border-white/15">
        <p className="text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
          Phase 0 — 계산 엔진 검증
        </p>
        <h1 className="mt-2 text-2xl font-bold">퇴직연금 인출 최적화</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          아래는 샘플 입력으로 계산 엔진을 돌린 결과입니다. 실제 입력 화면은 Phase 1에서 만듭니다.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black/50 dark:text-white/50">샘플 입력</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>만 {SAMPLE.age}세 · 연금수령 {SAMPLE.pensionYearIndex}년차</li>
          <li>
            계좌 잔액 — 비과세 {man(SAMPLE.balance.taxFree)} / 이연퇴직소득{' '}
            {man(SAMPLE.balance.deferredSeverance)} / 과세대상 {man(SAMPLE.balance.taxable)}
          </li>
          <li>목표 인출액 {man(SAMPLE.targetAmount)}</li>
        </ul>
      </section>

      <section className="mt-8 grid grid-cols-3 gap-4 rounded-lg bg-black/[.04] p-5 text-center dark:bg-white/[.06]">
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">인출액</p>
          <p className="mt-1 font-bold">{man(result.withdrawnAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">예상 세금</p>
          <p className="mt-1 font-bold text-red-600 dark:text-red-400">{won(result.totalTax)}</p>
        </div>
        <div>
          <p className="text-xs text-black/50 dark:text-white/50">세후 실수령</p>
          <p className="mt-1 font-bold text-blue-600 dark:text-blue-400">{won(result.netAmount)}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black/50 dark:text-white/50">
          재원별 차감 내역 (법정 순서)
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-xs text-black/50 dark:border-white/15 dark:text-white/50">
              <tr>
                <th className="py-2">재원</th>
                <th className="py-2 text-right">인출액</th>
                <th className="py-2 text-right">세금</th>
                <th className="py-2 text-right">실효세율</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.source} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2">
                    {line.label}
                    <span className="block text-xs text-black/45 dark:text-white/45">
                      {line.note}
                    </span>
                  </td>
                  <td className="py-2 text-right align-top">{man(line.amount)}</td>
                  <td className="py-2 text-right align-top">{won(line.tax)}</td>
                  <td className="py-2 text-right align-top">
                    {(line.effectiveRate * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-black/50 dark:text-white/50">건강보험료 판정</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {result.health.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

      {result.warnings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-black/50 dark:text-white/50">최적화 힌트</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 border-t border-black/10 pt-6 text-xs text-black/45 dark:border-white/15 dark:text-white/45">
        본 계산 결과는 참고용 추정치이며 세무 자문이 아닙니다. 실제 신고·납부는 세무 전문가 또는
        국세청 확인을 거치시기 바랍니다. 계산 근거는 <code>docs/tax-rules-2026.md</code> 참조.
      </footer>
    </main>
  )
}
