'use client'

import { useState } from 'react'
import { formatComma, manToWon, parseManInput, wonToMan } from '@/lib/format'

/**
 * 만원 단위 금액 입력 (§5.5).
 * 화면은 만원으로 묻고 표시는 천단위로 끊는다. 밖으로는 "원"만 내보낸다.
 *
 * 편집 중인 글자는 이 컴포넌트가 들고 있는다. 부모가 원 단위 숫자만 갖고 있으면
 * 지우는 도중("2,50" → "") 값이 튀어 커서가 밀린다.
 */
export function ManInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string
  value: number
  onChange: (won: number) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [text, setText] = useState(() => (value ? formatComma(wonToMan(value)) : ''))
  const [syncedValue, setSyncedValue] = useState(value)

  // 슬라이더처럼 바깥에서 값이 바뀌면 따라간다.
  // 렌더 중에 조정하는 이유는 effect 로 하면 한 프레임 늦게 반영돼 화면이 한 번 튀기 때문이다.
  // 내가 친 글자가 만든 변경이면(파싱 결과가 새 값과 같으면) 글자를 건드리지 않는다.
  // 건드리면 "2,5" 처럼 입력 중인 형태가 되돌려 쓰이면서 커서가 밀린다.
  if (value !== syncedValue) {
    setSyncedValue(value)
    const parsed = parseManInput(text)
    if (parsed === null || manToWon(parsed) !== value) {
      setText(value ? formatComma(wonToMan(value)) : '')
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value
          const parsed = parseManInput(raw)
          // 정수만 들어온 상태면 치는 즉시 천단위로 끊어 보여준다 (§5.5).
          // 소수점을 찍는 중("1.")에는 건드리지 않는다. 되돌려 쓰면 점을 못 찍는다.
          const digitsOnly = /^\d+$/.test(raw.replace(/,/g, ''))
          setText(parsed !== null && digitsOnly ? formatComma(parsed) : raw)
          onChange(parsed === null ? 0 : manToWon(parsed))
        }}
        onBlur={() => {
          const parsed = parseManInput(text)
          setText(parsed === null ? '' : formatComma(parsed))
        }}
        className="w-full rounded-md border border-black/15 bg-white py-2 pr-12 pl-3 text-right text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-black/5 disabled:text-black/40 dark:border-white/20 dark:bg-white/5 dark:disabled:bg-white/5 dark:disabled:text-white/40"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-black/45 dark:text-white/45">
        만원
      </span>
    </div>
  )
}

/** 라디오 한 줄. "잘 모르겠어요"를 1급 선택지로 두기 위한 공통 껍데기 (§3.4) */
export function ChoiceGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.value === value
        return (
          <label
            key={o.value}
            className={
              'cursor-pointer rounded-md border px-3 py-1.5 text-sm transition ' +
              (selected
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40')
            }
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={selected}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        )
      })}
    </div>
  )
}

/** 입력 한 덩어리 — 라벨 + 도움말 + 컨트롤 */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-black/50 dark:text-white/50">{hint}</p> : null}
    </div>
  )
}
