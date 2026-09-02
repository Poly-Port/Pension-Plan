import { Calculator } from '@/components/calculator/Calculator'

/**
 * 서버 컴포넌트로 남겨 둔다 (설계 스펙 §5.2).
 * 소개문이 HTML에 포함돼야 검색엔진이 읽는다. 상태와 상호작용은 <Calculator/> 안에만 있다.
 */
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-28 sm:px-6 sm:pt-14 sm:pb-14">
      <header className="space-y-3">
        <p className="text-xs font-medium tracking-widest text-blue-600 uppercase dark:text-blue-400">
          2026년 세법 기준
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">퇴직연금 인출 세금 계산기</h1>
        <p className="text-sm leading-relaxed text-black/65 dark:text-white/65">
          IRP·연금저축에서 올해 얼마를 빼면 세금이 얼마나 나오는지 계산합니다. 연금계좌는 인출
          순서가 법으로 정해져 있어(과세제외금액 → 이연퇴직소득 → 세액공제분), 같은 금액을
          빼도 계좌 구성에 따라 세금이 크게 달라집니다.
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span aria-hidden>🔒</span>
          모든 계산은 브라우저 안에서 끝납니다. 입력값이 서버로 전송되지 않습니다.
        </p>
      </header>

      <hr className="my-8 border-black/10 dark:border-white/15" />

      <main>
        <Calculator />
      </main>

      <footer className="mt-14 space-y-3 border-t border-black/10 pt-6 text-xs leading-relaxed text-black/50 dark:border-white/15 dark:text-white/50">
        <p>
          <strong className="text-black/70 dark:text-white/70">
            이 계산 결과는 참고용 추정치이며 세무 자문이 아닙니다.
          </strong>{' '}
          실제 납부세액은 개인의 다른 소득·공제 항목과 금융기관의 원천징수 방식에 따라 달라질 수
          있습니다. 중요한 결정 전에는 세무 전문가나 금융기관에 확인하시기 바랍니다.
        </p>
        <p>
          세율·한도는 소득세법과 같은 법 시행령의 조문을 근거로 하며, 근거 조문과 시행일은{' '}
          <a
            href="https://github.com/Poly-Port/pension-plan/blob/main/docs/tax-rules-2026.md"
            className="underline underline-offset-2 hover:text-black dark:hover:text-white"
          >
            세법 규칙 명세서
          </a>
          에 정리돼 있습니다.
        </p>
      </footer>
    </div>
  )
}
