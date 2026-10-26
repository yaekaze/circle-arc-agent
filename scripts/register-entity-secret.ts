/**
 * One-time entity secret registration for Circle developer-controlled wallets.
 * Run once per Circle entity. Non-idempotent.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) {
  console.error('ERROR: CIRCLE_API_KEY not set in .env')
  process.exit(1)
}

// 1. Generate secret without printing it
const entitySecret = crypto.randomBytes(32).toString('hex')

// 2. Ensure recovery dir exists under /home/user/app
const recoveryDir = '/home/user/app/.circle'
fs.mkdirSync(recoveryDir, { recursive: true })
const recoveryPath = path.join(recoveryDir, 'recovery_file.dat')

// 3. Register ciphertext
console.log('Registering entity secret ciphertext with Circle...')
let response
try {
  response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDir,
  })
} catch (err: unknown) {
  console.error('Registration failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
}

// Persist recovery file if SDK did not write it
if (response.data?.recoveryFile && !fs.existsSync(recoveryPath)) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile)
}

console.log('Ciphertext registered. Recovery file written to .circle/recovery_file.dat')

// 4. Persist secret to .env
const envPath = path.join('/home/user/app', '.env')
fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, 'utf-8')
console.log('CIRCLE_ENTITY_SECRET written to .env')

// 5. Verify registration with a read-only call
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
await client.listWalletSets({ pageSize: 1 })
console.log('VERIFICATION OK — entity secret is live')
console.log('REGISTRATION_COMPLETE')
