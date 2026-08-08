// Removes Turbopack's dev-server cache before a deploy.
//
// `next dev` writes .next/dev, which grew to ~1.7 GB and was being copied
// wholesale into the Cloud Function package. It is not needed at runtime --
// production serves from .next/server and .next/static.
//
// Wired up as a hosting predeploy hook in firebase.json. Kept as a file rather
// than an inline `node -e` because firebase-tools passes predeploy commands
// through cross-spawn, which strips the quotes an inline script needs.

import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const devCache = join(projectRoot, '.next', 'dev')

rmSync(devCache, { recursive: true, force: true })
console.log('cleaned .next/dev')
