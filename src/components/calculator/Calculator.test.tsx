// @vitest-environment jsdom
/**
 * 상호작용 테스트 3개 (설계 스펙 §7.2).
 *
 * 표시 컴포넌트에는 테스트를 붙이지 않는다. props 를 JSX 로 그리기만 하는 곳을 테스트하면
 * 리팩터링할 때마다 깨지기만 하고 버그는 잡지 못한다.
 * 여기서 다루는 셋은 실제로 회귀 위험이 있는 것들이다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calculator } from './Calculator'
import { EMPTY_FORM } from './types'

const STORAGE_KEY = 'pension-plan:form:v1'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

/** 1단계 입력을 채운다 (금액은 만원 단위로 친다) */
async function fillBasics(balanceMan: string, targetMan: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('연금계좌 총잔액'), balanceMan)
  await user.type(screen.getByLabelText('올해 인출하려는 금액'), targetMan)
  return user
}

describe('"잘 모르겠어요" 를 답으로 채우면 범위가 단일 값이 된다', () => {
  it('퇴직금 금액·근속연수를 알려주면 범위 표시가 사라진다', async () => {
    render(<Calculator />)
    const user = await fillBasics('25000', '1000')
    await user.click(screen.getByLabelText('네, 받았어요'))

    // 금액도 근속연수도 모르는 상태 → 범위
    expect(screen.getByText('가장 불리한 경우')).toBeDefined() // 범위 안내 배너
    // 하단 고정 바는 공백 없이 "9만원~202만원" 으로 줄여 쓰므로 헤드라인만 잡힌다
    expect(screen.getByText(/만원 ~ /)).toBeDefined()

    const unknownToggles = screen.getAllByLabelText('잘 모르겠어요')
    await user.click(unknownToggles[0]) // 퇴직금 금액
    await user.click(unknownToggles[1]) // 근속연수
    await user.type(screen.getByLabelText('받은 퇴직금'), '8000')

    // 세금을 가르는 값이 모두 채워졌다 → 단일 값
    expect(screen.queryByText('가장 불리한 경우')).toBeNull()
  })
})

describe('저장된 입력이 재방문 시 복원된다', () => {
  it('localStorage 에 있던 값으로 화면이 채워진다', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...EMPTY_FORM,
        age: 71,
        totalBalance: 180_000_000,
        targetAmount: 12_000_000,
        severance: null,
        severanceAnswered: true,
      }),
    )

    render(<Calculator />)

    await waitFor(() => {
      expect((screen.getByLabelText('만 나이') as HTMLInputElement).value).toBe('71')
    })
    expect((screen.getByLabelText('연금계좌 총잔액') as HTMLInputElement).value).toBe('18,000')
    expect((screen.getByLabelText('올해 인출하려는 금액') as HTMLInputElement).value).toBe('1,200')
    // 공용 PC를 쓸 수 있으므로 지우는 수단이 항상 보여야 한다 (§5.4)
    expect(screen.getByRole('button', { name: '지우기' })).toBeDefined()
  })

  it('저장된 값이 없으면 빈 폼으로 시작한다', () => {
    render(<Calculator />)
    expect((screen.getByLabelText('연금계좌 총잔액') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('button', { name: '지우기' })).toBeNull()
  })
})

describe('슬라이더로 1,500만 원을 넘기면 경고가 나타난다', () => {
  it('넘기기 전에는 경고가 없고, 넘기면 나타난다', async () => {
    render(<Calculator />)
    const user = await fillBasics('25000', '1000')
    await user.click(screen.getByLabelText('아니요'))

    expect(screen.queryByText(/1,500만 원을 초과/)).toBeNull()

    fireEvent.change(screen.getByLabelText('인출액'), { target: { value: '40000000' } })

    expect(screen.getByText(/1,500만 원을 초과/)).toBeDefined()
  })
})
