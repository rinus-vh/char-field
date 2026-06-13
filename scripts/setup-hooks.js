import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Installs git hooks from scripts/ into .git/hooks/.
// Runs automatically via the `postinstall` npm script so any clone or template
// fork picks up the hooks on first `pnpm install` — no manual step required.

const root = resolve(import.meta.dirname, '..')
const hooksDir = resolve(root, '.git/hooks')

if (!existsSync(hooksDir)) {
  // Not a git repo (e.g. a bare CI checkout without .git) — skip silently.
  process.exit(0)
}

mkdirSync(hooksDir, { recursive: true })

const hooks = {
  'pre-push': [
    '#!/bin/sh',
    '# Block pushes whose committed package.json references local @6njp sources',
    '# (file:/link:). git pipes the push payload on stdin; `exec` hands it to node so',
    '# the guard can inspect the actual commits being pushed.',
    '# Fix a blocked push with `pnpm run source:remote` then recommit. See',
    '# scripts/check-remote-sources.js.',
    'exec node scripts/check-remote-sources.js',
  ].join('\n'),
}

for (const [name, content] of Object.entries(hooks)) {
  const hookPath = resolve(hooksDir, name)
  writeFileSync(hookPath, content + '\n', 'utf8')
  chmodSync(hookPath, 0o755)
  console.warn(`✔ installed .git/hooks/${name}`)
}
