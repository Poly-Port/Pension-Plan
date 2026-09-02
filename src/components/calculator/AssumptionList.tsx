import type { Assumption } from '@/lib/tax'

/**
 * 몰라서 대신 세운 전제를 숨기지 않고 보여준다 (설계 스펙 §3.4).
 * 문구는 화면이 짓지 않고 엔진이 만든 것을 그대로 쓴다. 가정이 코드 한 곳에만 있게 된다.
 */
export function AssumptionList({ assumptions }: { assumptions: Assumption[] }) {
  if (assumptions.length === 0) return null

  return (
    <section aria-labelledby="assumptions" className="space-y-3">
      <h2 id="assumptions" className="text-base font-semibold">
        이렇게 가정했습니다
      </h2>
      <ul className="space-y-2">
        {assumptions.map((a) => (
          <li
            key={a.field}
            className="rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/15"
          >
            <p>{a.reason}</p>
            {a.howToConfirm ? (
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">{a.howToConfirm}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
