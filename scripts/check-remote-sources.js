import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// Pre-push guard. Validates the package.json in the COMMIT(S) being pushed — NOT
// the working tree — so a commit that still references local @6njp sources
// (file:/link:) can't reach GitHub, even if you've since run `sources:remote`
// locally. (The working tree can be clean while the committed snapshot is not.)
//
// git pipes the push payload to stdin, one line per ref:
//   <local ref> <local sha> <remote ref> <remote sha>
// We check each pushed tip (<local sha>) — that's the package.json that lands on
// the remote and that teammates install from.

const ZERO = '0'.repeat(40)
const git = args => execFileSync('git', args, { encoding: 'utf8' })

// Read git's stdin synchronously. When run by hand (a TTY, no payload), fall back
// to HEAD so this stays useful as a manual check.
let payload = ''
if (!process.stdin.isTTY) {
  try { payload = readFileSync(0, 'utf8') } catch { /* no stdin available */ }
}

const tips = new Set()
for (const line of payload.split('\n').filter(Boolean)) {
  const [, localSha] = line.trim().split(/\s+/)
  if (localSha && localSha !== ZERO) tips.add(localSha) // skip branch deletions
}
if (!tips.size) {
  try { tips.add(git(['rev-parse', 'HEAD']).trim()) } catch { /* no HEAD yet */ }
}

const offending = []
for (const sha of tips) {
  let pkg
  try {
    pkg = JSON.parse(git(['show', `${sha}:package.json`]))
  } catch {
    continue // package.json absent or unparseable in this commit
  }
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      if (name.startsWith('@6njp/') && /^(file:|link:)/.test(spec)) {
        offending.push(`  ${sha.slice(0, 9)}  ${name}: ${spec}`)
      }
    }
  }
}

if (offending.length) {
  console.error('\n✖ Push blocked — the commit being pushed references LOCAL @6njp sources:\n')
  console.error([...new Set(offending)].join('\n'))
  console.error('\nThe committed package.json must use github: sources. Fix it, then push again:\n')
  console.error('  pnpm run source:remote')
  console.error('  git add package.json pnpm-lock.yaml')
  console.error('  git commit --amend --no-edit     # fold into the same commit (or make a new one)')
  console.error('  git push\n')
  process.exit(1)
}
