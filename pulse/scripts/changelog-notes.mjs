#!/usr/bin/env node
/**
 * Печатает раздел CHANGELOG.md для указанной версии — это текст GitHub Release.
 *   node scripts/changelog-notes.mjs 0.2.0 > notes.md
 * Если раздела нет — завершается с ошибкой (выпуск без описания не допускается).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = (process.argv[2] || '').replace(/^v/, '')
if (!version) { console.error('Укажи версию: node scripts/changelog-notes.mjs 0.2.0'); process.exit(1) }

const md = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const m = md.match(new RegExp(`^## \\[${esc}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm'))
if (!m || !m[1].trim()) { console.error(`В CHANGELOG.md нет раздела «## [${version}]»`); process.exit(1) }
process.stdout.write(m[1].trim() + '\n')
