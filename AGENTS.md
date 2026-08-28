<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 퇴직연금 인출 최적화 — 프로젝트 규칙

## 이게 뭔가

퇴직연금·연금저축을 **언제 얼마씩 인출해야 세금이 가장 적은지** 계산해 주는 공개 웹 서비스.
불특정 다수가 쓰는 사이트이며, 사용자는 로그인 없이 계산기를 쓸 수 있다.

## 반드시 지켜야 할 것

### 1. 개인정보를 서버로 보내지 않는다
연령·소득·재산 같은 민감 정보를 입력받는다. **계산은 전부 브라우저에서 끝낸다.**
서버로 데이터를 보내는 설계를 제안하지 말 것. (회원이 명시적으로 "저장"을 누르는 경우는 예외 — Phase 4)

### 2. 세율·한도를 코드에 박지 않는다
모든 숫자는 `src/lib/rules/<연도>.json` 에만 있다. 코드에 `0.055` 같은 리터럴이 등장하면 잘못된 것이다.
세법이 개정되면 JSON 파일을 새로 추가한다.

### 3. 계산 엔진은 React를 모른다
`src/lib/tax/` 는 순수 TypeScript다. `import` 에 react/next가 들어가면 안 된다.
화면·서버·테스트 어디서든 재사용할 수 있어야 한다.

### 4. 세법 숫자는 1차 출처로만 근거를 잡는다
모든 세율·한도·공제는 `docs/tax-rules-2026.md` 에 대응 항목이 있어야 하고, 코드 주석에 `§` 조항 번호를 단다.
문서에 없는 규칙이 필요하면 **먼저 문서에 추가하고 출처를 남긴 뒤** 구현한다.

**근거로 쓸 수 있는 것은 법령 원문(국가법령정보센터)과 소관 기관(국세청·국민건강보험공단) 자료뿐이다.**
증권사·언론·블로그는 근거가 될 수 없다. 각 수치에 근거 조문·1차 출처 URL·시행일을 남긴다.
확인하지 못한 항목은 추측으로 채우지 말고 명세서에 ⚠️로 남긴다.
세법은 매년 바뀐다. 2025년 이전 자료를 그대로 쓰면 틀린다(예: 2026년 종신연금 4%→3%, 이연퇴직소득 감면 3단계화).

### 5. `output: 'export'` 를 켜지 않는다
정적 export를 켜면 Route Handler가 죽어 Phase 4(회원·DB)에서 되돌려야 한다.

### 6. 인출 순서는 최적화 대상이 아니다
계좌 내 재원 인출 순서(비과세 → 이연퇴직소득 → 세액공제분)는 법정이라 사용자가 못 바꾼다.
순서를 고르게 하는 UI를 만들지 말 것. 조절 가능한 건 **연도별 금액 / 개시 시점 / 계좌 분리** 세 가지뿐이다.

### 7. 면책 문구를 빼지 않는다
계산 결과를 보여주는 모든 화면에 "참고용 추정치이며 세무 자문이 아님" 문구를 유지한다.

## 구조

```
docs/tax-rules-2026.md   세법 규칙 명세서 — 모든 숫자의 근거
src/lib/rules/2026.json  규칙 데이터 (연도별)
src/lib/tax/             계산 엔진 (순수 TS)
  types.ts               입출력 타입
  rules.ts               규칙 로더
  severance.ts           퇴직소득세 원천 계산 (§6)
  withdrawal.ts          연간 인출 계산 (§8)
  tax.test.ts            엔진 테스트
src/app/                 화면
```

## 명령어

```
npm run dev     개발 서버 (localhost:3000)
npm test        엔진 테스트
npm run build   프로덕션 빌드
```

## 로드맵

- **Phase 0** ✅ 뼈대 + 세법 명세서 + 단년도 계산 엔진 + 테스트
- **Phase 1** 입력 화면 + 결과 리포트 → Vercel 배포
- **Phase 2** 다년도 시뮬레이션 (55→90세 배분 최적화) — 서비스의 핵심 차별점
- **Phase 3** 해설 콘텐츠 + SEO
- **Phase 4** 회원 + 시나리오 저장 (DB)
- **Phase 5** 전 연금 통합 관리 / ETF 추천 — 착수 전 투자자문업 규제 확인 필요

## 개발 기록 (포트폴리오)

이 저장소는 GitHub에 공개되며, `docs/portfolio/` 에 개발 과정을 기록한다.
작업하면서 아래에 해당하는 일이 생기면 **그 자리에서** 문서를 추가한다. 나중에 몰아 쓰지 않는다.

| 상황 | 남길 곳 | 형식 |
|---|---|---|
| 설계 결정을 내렸을 때 | `docs/portfolio/decisions/` | 맥락 / 검토한 선택지 / 결정 / 근거 / 결과 / 되돌리는 비용 |
| 문제를 해결했을 때 | `docs/portfolio/troubleshooting/` | 증상 / 원인 / 해결 / 재발 방지 / 배운 것 |
| 한 주가 끝났을 때 | `docs/portfolio/journal/` | 한 일 / 가장 큰 사건 / 다음 주 / 회고 |

새 문서를 만들면 `docs/portfolio/README.md` 의 표에 한 줄 추가한다.

**작성 원칙**
- 독자는 이 프로젝트를 모르는 사람이다. 배경부터 쓴다.
- 실패와 오류를 지우지 않는다. **틀렸던 과정이 결과보다 가치 있다.**
- "잘 만들었다" 같은 자평을 쓰지 않는다. 사실과 숫자로 남긴다.
- 감수한 것(trade-off)을 반드시 적는다. 장점만 적힌 결정 기록은 신뢰를 잃는다.
