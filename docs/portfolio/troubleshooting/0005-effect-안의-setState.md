# TS 0005 — lint가 막은 `useEffect` 안의 setState 두 건, 결론은 서로 달랐다

- **일자**: 2026-09-02
- **관련**: [ADR 0006](../decisions/0006-화면상태를-엔진타입-그대로.md)

## 증상

화면 컴포넌트를 다 만들고 `npm run lint` 를 돌리자 같은 규칙이 두 곳을 막았다.

```
error  Calling setState synchronously within an effect can trigger cascading renders
       react-hooks/set-state-in-effect
```

`eslint-config-next` 16이 켜 놓은 규칙이다. 같은 오류 메시지였지만 **원인이 서로 달랐고,
한쪽은 진짜 고쳐야 할 코드였고 다른 쪽은 아니었다.**

## 사례 ①  금액 입력칸 — 진짜 고쳐야 했다

`ManInput` 은 편집 중인 글자를 자기가 들고 있는다. 부모는 원 단위 숫자만 갖는다.
슬라이더로 바깥에서 값이 바뀌면 글자도 따라가야 해서 이렇게 썼다.

```tsx
useEffect(() => {
  const parsed = parseManInput(text)
  if (parsed === null || manToWon(parsed) !== value) {
    setText(value ? formatComma(wonToMan(value)) : '')
  }
}, [value])
```

**effect 는 렌더가 끝난 뒤에 돈다.** 즉 화면에 옛날 글자를 한 번 그린 다음 다시 그린다.
슬라이더를 끄는 동안 이게 매 프레임 일어난다.

React 문서가 말하는 "prop이 바뀔 때 state 조정"은 렌더 중에 하는 것이다.

```tsx
if (value !== syncedValue) {
  setSyncedValue(value)
  const parsed = parseManInput(text)
  if (parsed === null || manToWon(parsed) !== value) {
    setText(value ? formatComma(wonToMan(value)) : '')
  }
}
```

`syncedValue` 를 같이 두는 게 핵심이다. 없으면 매 렌더마다 조건이 참이 되어 무한 루프가 된다.

그리고 **내가 친 글자가 만든 변경이면 글자를 건드리지 않는다**(파싱 결과가 새 값과 같은 경우).
건드리면 `"2,5"` 처럼 입력 중인 형태가 되돌려 쓰이면서 커서가 끝으로 밀린다.

## 사례 ②  localStorage 복원 — 규칙이 틀렸다

```tsx
useEffect(() => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw) setForm({ ...EMPTY_FORM, ...JSON.parse(raw) })
  setRestored(true)
}, [])
```

여기서는 effect 가 **회피 대상이 아니라 요구사항**이다.

서버에서 렌더할 때는 `localStorage` 가 없다. 클라이언트 첫 렌더에서 저장값을 읽어 버리면
서버가 만든 HTML(빈 폼)과 달라져 hydration 이 깨진다.
그래서 첫 렌더는 반드시 빈 폼으로 하고, 마운트 이후에 바꿔야 한다.

규칙을 우회하려고 `useSyncExternalStore` 로 바꿀 수도 있었지만,
`getSnapshot` 이 매번 `JSON.parse` 로 새 객체를 만들면 무한 루프가 된다.
캐싱 장치를 덧붙이는 것은 이 한 줄을 위해 치를 비용이 아니었다.

**해당 줄 하나만 예외 처리하고 이유를 주석으로 남겼다.**

```tsx
// eslint-disable-next-line react-hooks/set-state-in-effect -- 위 주석 참조
```

## 배운 것

**같은 lint 오류가 같은 문제를 뜻하지 않는다.**

①은 규칙이 정확히 옳았다. 지적당한 코드는 성능만이 아니라 **화면이 한 번 튀는** 실제 결함이었다.
②는 규칙이 모르는 제약(SSR hydration)이 있었다.

lint 를 전부 끄는 것도, 전부 따르려고 코드를 비트는 것도 답이 아니었다.
**한 줄 단위로 예외를 두고 왜인지 적는 것**이 답이었다. 범위를 좁힐수록 다음 사람이 판단할 거리가 줄어든다.

여담으로, ②에 예외 주석을 세 줄 붙였다가 두 줄은 `Unused eslint-disable directive` 경고를 받았다.
막힌 건 한 줄뿐이었다. **예외는 필요한 만큼만 달아야 한다는 걸 lint 가 다시 알려줬다.**
