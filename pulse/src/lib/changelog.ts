import raw from '../../CHANGELOG.md?raw'

export interface ChangelogBlock {
  heading?: string
  items: string[]
  text: string[]
}

export interface ChangelogEntry {
  version: string
  date?: string
  blocks: ChangelogBlock[]
}

/** Разбор CHANGELOG.md в формате Keep a Changelog: «## [1.2.0] - 2026-11-24», «### Добавлено», «- пункт» */
export function parseChangelog(md: string = raw): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let entry: ChangelogEntry | null = null
  let block: ChangelogBlock | null = null
  for (const line of md.split(/\r?\n/)) {
    const v = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(\S+))?/)
    if (v) {
      entry = { version: v[1], date: v[2], blocks: [] }
      entries.push(entry)
      block = null
      continue
    }
    if (!entry) continue
    const h = line.match(/^###\s+(.+)/)
    if (h) {
      block = { heading: h[1].trim(), items: [], text: [] }
      entry.blocks.push(block)
      continue
    }
    if (!block) { block = { items: [], text: [] }; entry.blocks.push(block) }
    const item = line.match(/^\s*[-*]\s+(.+)/)
    if (item) block.items.push(stripMd(item[1]))
    else if (line.trim()) block.text.push(stripMd(line.trim()))
  }
  return entries.filter((e) => e.version.toLowerCase() !== 'unreleased')
}

/** Убираем разметку Markdown — показываем как обычный текст */
const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\([^)]*\)/g, '$1')

export const changelogFor = (version: string) => parseChangelog().find((e) => e.version === version)
