#!/usr/bin/env node
/**
 * 법제처 국가법령정보 공동활용 OPEN API로 법령 조문 원문을 가져온다.
 *
 * 세법 수치의 근거를 잡을 때 블로그를 거치지 않고 법령 원문을 직접 확인하기 위한 도구다.
 * (AGENTS.md 규칙 4 참조)
 *
 * 사용법:
 *   node scripts/fetch-law.mjs --law 소득세법 --jo 129
 *   node scripts/fetch-law.mjs --law 소득세법 시행령 --jo 40 --branch 2   # 제40조의2
 *   node scripts/fetch-law.mjs --law 소득세법 --jo 129 --save             # docs/sources/ 에 저장
 *   node scripts/fetch-law.mjs --law 국민건강보험법 시행규칙 --tables      # 별표 목록
 *
 * OC(신청자 이메일 ID)는 환경변수 LAW_API_OC 로 지정한다. 없으면 공개 예제 키 'test'를 쓴다.
 * 'test' 키는 호출량 제한이 있을 수 있으므로, 상시 사용하려면 아래에서 직접 신청할 것:
 *   https://open.law.go.kr/LSO/openApi/cuAplList.do
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://www.law.go.kr/DRF'
const OC = process.env.LAW_API_OC || 'test'

function parseArgs(argv) {
  const args = { save: false, tables: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--save') args.save = true
    else if (a === '--tables') args.tables = true
    else if (a === '--law') args.law = argv[++i]
    else if (a === '--jo') args.jo = argv[++i]
    else if (a === '--branch') args.branch = argv[++i]
    else if (a === '--efYd') args.efYd = argv[++i]
  }
  return args
}

/** 조번호(4자리) + 조가지번호(2자리) 형식으로 변환. 제40조의2 → '004002' */
function joParam(jo, branch) {
  return String(jo).padStart(4, '0') + String(branch ?? 0).padStart(2, '0')
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`JSON 파싱 실패. 응답 앞부분:\n${text.slice(0, 300)}`)
  }
}

/** 법령명으로 현행 법령의 일련번호(MST)를 찾는다 */
async function findLaw(name) {
  const url = `${BASE}/lawSearch.do?OC=${OC}&target=law&type=JSON&display=5&query=${encodeURIComponent(name)}`
  const data = await getJson(url)
  const list = data?.LawSearch?.law
  if (!list) throw new Error(`'${name}' 검색 결과가 없습니다.`)
  const rows = Array.isArray(list) ? list : [list]
  // 법령명이 정확히 일치하는 현행 법령을 우선한다
  const exact = rows.find((r) => r['법령명한글'] === name && r['현행연혁코드'] === '현행')
  return exact ?? rows[0]
}

/** 목/호/항 어디에 있든 문자열만 평평하게 뽑아낸다. 표는 ASCII 아트로 내려온다. */
function flatten(value, out = []) {
  if (value == null) return out
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => flatten(v, out))
  else if (typeof value === 'object') Object.values(value).forEach((v) => flatten(v, out))
  return out
}

function renderArticle(unit) {
  const lines = []
  lines.push(`제${unit['조문번호']}조${unit['조문가지번호'] ? '의' + unit['조문가지번호'] : ''}`)
  lines.push(`조문시행일자: ${unit['조문시행일자'] ?? '-'}`)
  if (unit['조문제목']) lines.push(`제목: ${unit['조문제목']}`)
  lines.push('')

  if (unit['조문내용']) lines.push(...flatten(unit['조문내용']))

  const hangs = unit['항'] ? (Array.isArray(unit['항']) ? unit['항'] : [unit['항']]) : []
  for (const hang of hangs) {
    lines.push('')
    lines.push(...flatten(hang['항내용']))
    const hos = hang['호'] ? (Array.isArray(hang['호']) ? hang['호'] : [hang['호']]) : []
    for (const ho of hos) {
      lines.push('  ' + flatten(ho['호내용']).join(' '))
      const moks = ho['목'] ? (Array.isArray(ho['목']) ? ho['목'] : [ho['목']]) : []
      for (const mok of moks) {
        for (const line of flatten(mok['목내용'])) lines.push('    ' + line)
      }
    }
  }
  if (unit['조문참고자료']) {
    lines.push('')
    lines.push(...flatten(unit['조문참고자료']))
  }
  return lines.join('\n')
}

async function listTables(law) {
  const url = `${BASE}/lawSearch.do?OC=${OC}&target=licbyl&type=JSON&display=100&MST=${law['법령일련번호']}`
  const data = await getJson(url)
  console.log(JSON.stringify(data, null, 2).slice(0, 4000))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.law) {
    console.error('사용법: node scripts/fetch-law.mjs --law <법령명> --jo <조번호> [--branch <가지번호>] [--save]')
    process.exit(1)
  }

  const law = await findLaw(args.law)
  console.log('='.repeat(70))
  console.log(`법령명   : ${law['법령명한글']} (${law['법령구분명']})`)
  console.log(`법령ID   : ${law['법령ID']}   법령일련번호(MST): ${law['법령일련번호']}`)
  console.log(`공포     : ${law['공포일자']} 제${law['공포번호']}호 (${law['제개정구분명']})`)
  console.log(`시행일자 : ${law['시행일자']}`)
  console.log(`소관부처 : ${law['소관부처명']}`)
  console.log('='.repeat(70))

  if (args.tables) {
    await listTables(law)
    return
  }
  if (!args.jo) return

  let url = `${BASE}/lawService.do?OC=${OC}&target=law&type=JSON&MST=${law['법령일련번호']}&JO=${joParam(args.jo, args.branch)}`
  if (args.efYd) url += `&efYd=${args.efYd}`

  const data = await getJson(url)
  const unit = data?.['법령']?.['조문']?.['조문단위']
  if (!unit) throw new Error('조문을 찾지 못했습니다. 조번호/가지번호를 확인하세요.')

  const units = Array.isArray(unit) ? unit : [unit]
  const body = units.map(renderArticle).join('\n\n' + '-'.repeat(70) + '\n\n')
  console.log(body)

  if (args.save) {
    const dir = path.join(process.cwd(), 'docs', 'sources')
    await mkdir(dir, { recursive: true })
    const branch = args.branch ? `의${args.branch}` : ''
    const file = path.join(dir, `${law['법령명한글']}_제${args.jo}조${branch}.txt`)
    const header = [
      `# ${law['법령명한글']} 제${args.jo}조${branch}`,
      `# 공포 ${law['공포일자']} 제${law['공포번호']}호 / 시행 ${law['시행일자']}`,
      `# 출처: 법제처 국가법령정보 공동활용 OPEN API`,
      `# ${url.replace(`OC=${OC}`, 'OC=<본인ID>')}`,
      `# 취득일: ${new Date().toISOString().slice(0, 10)}`,
      '',
      '',
    ].join('\n')
    await writeFile(file, header + body + '\n', 'utf8')
    console.log(`\n저장됨: ${path.relative(process.cwd(), file)}`)
  }
}

main().catch((err) => {
  console.error('오류:', err.message)
  process.exit(1)
})
