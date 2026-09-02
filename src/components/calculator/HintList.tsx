/**
 * 엔진이 내놓은 경고·최적화 힌트를 그대로 보여준다.
 * (한도 초과, 1,500만 원 초과, 내년에 감면율이 올라가는 시점 등)
 */
export function HintList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null

  return (
    <section aria-labelledby="hints" className="space-y-3">
      <h2 id="hints" className="text-base font-semibold">
        참고할 점
      </h2>
      <ul className="space-y-2">
        {warnings.map((w) => (
          <li
            key={w}
            className="rounded-lg border border-blue-500/30 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:bg-blue-500/10 dark:text-blue-100"
          >
            {w}
          </li>
        ))}
      </ul>
    </section>
  )
}
