import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Point every shared @6njp source at a local checkout on this machine.
// Ideal for developing the plugins or the component library alongside a prototype.
//
// Never commit this state — the pre-push guard (scripts/check-remote-sources.js)
// blocks any push while these point local. Run `pnpm run source:remote` first.

const pkgPath = resolve(import.meta.dirname, '../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

// All shared @6njp sources use `link:` (a live symlink) so edits take effect
// immediately with no reinstall — hot reload for the library, live rules for the
// lint plugins.
//
// The library's symlink would normally risk two React copies ("Invalid hook
// call"), but vite.config.js handles it: `resolve.dedupe` pins React (and the
// shared React-context peers) to this project's single copy, and `server.watch`
// un-ignores the package so HMR actually fires. See the comment block there.
pkg.devDependencies['@6njp/eslint-plugin']    = 'link:../plugins/eslint-plugin'
pkg.devDependencies['@6njp/stylelint-plugin'] = 'link:../plugins/stylelint-plugin'
pkg.dependencies['@6njp/prototype-library']   = 'link:../prototype-library'

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.warn('Switched to LOCAL sources (all → link:). Run pnpm install.')
