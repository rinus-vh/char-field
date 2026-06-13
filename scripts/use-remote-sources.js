import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Point every shared @6njp source back at its canonical GitHub repo (github:).
// Use for committing / CI / sharing — no machine-specific paths.

const pkgPath = resolve(import.meta.dirname, '../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

// devDependencies — lint plugins (monorepo, addressed by subpath)
pkg.devDependencies['@6njp/eslint-plugin']    = 'github:rinus-vh/plugins#path:eslint-plugin'
pkg.devDependencies['@6njp/stylelint-plugin'] = 'github:rinus-vh/plugins#path:stylelint-plugin'

// dependencies — component library (single package at repo root)
pkg.dependencies['@6njp/prototype-library'] = 'github:rinus-vh/prototype-library'

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.warn('Switched to REMOTE sources (github:). Run pnpm install.')
