#!/usr/bin/env node
/**
 * Выпуск новой версии Pulse одной командой.
 *
 *   npm run release -- patch            0.1.0 → 0.1.1
 *   npm run release -- minor            0.1.0 → 0.2.0
 *   npm run release -- major            0.1.0 → 1.0.0
 *   npm run release -- minor --beta     0.1.0 → 0.2.0-beta.1   (бета-канал, GitHub pre-release)
 *   npm run release -- beta             0.2.0-beta.1 → 0.2.0-beta.2
 *   npm run release -- minor --dry-run  показать, что будет, ничего не меняя
 *
 * Что делает: проверяет, что всё закоммичено и пункты в «## [Unreleased]» есть;
 * поднимает версию в package.json и package-lock.json; переносит пункты в раздел новой версии
 * в CHANGELOG.md; коммитит, ставит тег vX.Y.Z и пушит ветку и тег.
 * Пуш тега запускает GitHub Actions, который собирает .exe и публикует релиз.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const kind = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const asBeta = args.includes('--beta')

const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1) }
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim()

// ---------- версия ----------
export function bump(current, kind, beta = false) {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/)
  if (!m) throw new Error(`Непонятная версия в package.json: ${current}`)
  let [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const betaN = m[4] !== undefined ? Number(m[4]) : null
  if (kind === 'beta') {
    if (betaN === null) throw new Error('Текущая версия не бета. Для первой беты: npm run release -- minor --beta')
    return `${maj}.${min}.${pat}-beta.${betaN + 1}`
  }
  // Из беты 0.2.0-beta.3 команда patch/minor/major без --beta выпускает 0.2.0 (если подходит)
  if (betaN !== null && !beta) {
    const finalOk = kind === 'patch' || (kind === 'minor' && pat === 0) || (kind === 'major' && min === 0 && pat === 0)
    if (finalOk) return `${maj}.${min}.${pat}`
  }
  if (kind === 'major') { maj++; min = 0; pat = 0 }
  else if (kind === 'minor') { min++; pat = 0 }
  else pat++
  return `${maj}.${min}.${pat}${beta ? '-beta.1' : ''}`
}

// ---------- CHANGELOG ----------
export function releaseChangelog(md, version, date) {
  const re = /^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m
  const m = md.match(re)
  if (!m) throw new Error('В CHANGELOG.md нет раздела «## [Unreleased]»')
  const body = m[1].trim()
  if (!body || !/^\s*[-*]\s+\S/m.test(body)) throw new Error('Раздел «## [Unreleased]» пуст — опиши изменения перед выпуском')
  return md.replace(re, `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n`)
}

function main() {
  if (!['patch', 'minor', 'major', 'beta'].includes(kind ?? '')) {
    fail('Укажи, что поднять: npm run release -- patch | minor | major | beta  (флаги: --beta, --dry-run)')
  }
  const pkgPath = path.join(ROOT, 'package.json')
  const lockPath = path.join(ROOT, 'package-lock.json')
  const changelogPath = path.join(ROOT, 'CHANGELOG.md')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  let next
  try { next = bump(pkg.version, kind, asBeta) } catch (e) { fail(e.message) }
  const tag = `v${next}`
  const date = new Date().toISOString().slice(0, 10)

  // Проверки до любых изменений
  const dirty = git('status', '--porcelain', '--', '.')
  if (dirty && !dryRun) fail(`Есть незакоммиченные изменения в pulse/:\n${dirty}\nСначала закоммить их.`)
  if (git('tag', '--list', tag)) fail(`Тег ${tag} уже есть локально — эту версию уже выпускали`)
  try {
    if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) fail(`Тег ${tag} уже есть на GitHub — эту версию уже выпускали`)
  } catch { fail('Не удалось связаться с origin — проверь интернет и доступ к репозиторию') }

  let changelog
  try { changelog = releaseChangelog(fs.readFileSync(changelogPath, 'utf8'), next, date) } catch (e) { fail(e.message) }

  console.log(`Pulse ${pkg.version} → ${next}${next.includes('-') ? '  (бета, pre-release)' : ''}`)
  if (dryRun) {
    console.log('\n--dry-run: ничего не изменено. Раздел, который уйдёт в релиз:\n')
    console.log(changelog.match(new RegExp(`## \\[${next.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=\\n## \\[|$)`))[0])
    return
  }

  pkg.version = next
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    lock.version = next
    if (lock.packages?.['']) lock.packages[''].version = next
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  }
  fs.writeFileSync(changelogPath, changelog)

  git('add', 'package.json', 'package-lock.json', 'CHANGELOG.md')
  git('commit', '-m', `Release Pulse ${tag}`)
  git('tag', '-a', tag, '-m', `Pulse ${next}`)
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  console.log(`Пушу ветку ${branch} и тег ${tag}…`)
  git('push', 'origin', branch)
  git('push', 'origin', tag)
  console.log(`\n✔ Готово. GitHub Actions собирает ${tag} и опубликует релиз через ~5–10 минут.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
