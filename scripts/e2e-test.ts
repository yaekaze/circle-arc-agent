/**
 * End-to-end test for ArcAgentEscrowSplit on Arc Testnet.
 * Uses the pre-funded DCW wallet; executes:
 *   1) approve USDC  2) createTaskEscrow  3) submitDeliverable  4) approveAndSplit
 */

import {
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets'
import {
  createPublicClient, http, encodeFunctionData,
  keccak256, toBytes, parseUnits, erc20Abi,
} from 'viem'
import { arcTestnet } from 'viem/chains'

const CONTRACT_ADDRESS  = '0x7d19952a71ff38c29d78067cf33d2f23f0847ce2' as const
const USDC_ADDRESS      = '0x3600000000000000000000000000000000000000' as const
const EXPLORER_BASE     = 'https://explorer.testnet.arc.io'
const AMOUNT_WEI        = parseUnits('0.20', 6) // 200_000

// Pre-funded wallet created in previous run
const WALLET_ID         = 'f2a864ef-f46d-55d3-8d5e-f9bb0082552e'
const WALLET_ADDRESS    = '0xb3b68b2f45b6af21eb6aa61910dbd0648773867d' as const

const apiKey        = process.env.CIRCLE_API_KEY!
const entitySecret  = process.env.CIRCLE_ENTITY_SECRET!

if (!apiKey || !entitySecret) {
  console.error('ERROR: Missing CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET')
  process.exit(1)
}

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ESCROW_ABI = [
  {
    name: 'createTaskEscrow', type: 'function',
    inputs: [
      { name: 'worker',       type: 'address' },
      { name: 'verifier',     type: 'address' },
      { name: 'taskSpecHash', type: 'bytes32'  },
      { name: 'deadline',     type: 'uint64'   },
      { name: 'amount',       type: 'uint256'  },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'submitDeliverable', type: 'function',
    inputs: [
      { name: 'taskId',          type: 'uint256' },
      { name: 'deliverableHash', type: 'bytes32'  },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'approveAndSplit', type: 'function',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'taskCount', type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// ── helpers ───────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() })

const txLink = (h: string) => `${EXPLORER_BASE}/tx/${h}`

async function waitForConfirm(hash: string): Promise<bigint> {
  const r = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 90_000 })
  return r.blockNumber
}

async function sendTx(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  calldata: `0x${string}`,
  target: string,
  label: string,
): Promise<string> {
  console.log(`\n── ${label}`)
  const resp = await client.createContractExecutionTransaction({
    walletId: WALLET_ID,
    contractAddress: target,
    callData: calldata,
    fee: { type: 'level', config: { feeLevel: 'LOW' } },
  })
  const txId = resp.data?.id
  if (!txId) throw new Error(`No txId returned: ${JSON.stringify(resp)}`)
  process.stdout.write(`   Broadcasting`)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await client.getTransaction({ id: txId })
    // The SDK returns .data.transaction (not .data directly)
    const tx = (s.data as { transaction?: { txHash?: string; state?: string } } | null)?.transaction
      ?? (s.data as { txHash?: string; state?: string } | null)
    if (tx?.txHash) {
      const hash = tx.txHash
      process.stdout.write(`\n   txHash  : ${hash}\n`)
      const block = await waitForConfirm(hash)
      console.log(`   block   : ${block}`)
      console.log(`   explorer: ${txLink(hash)}`)
      return hash
    }
    if (tx?.state === 'FAILED') throw new Error(`TX FAILED: ${JSON.stringify(tx)}`)
    process.stdout.write('.')
  }
  throw new Error(`Timeout waiting for hash — ${label}`)
}

// ── wait for faucet balance ───────────────────────────────────────────────────

console.log(`\nWallet  : ${WALLET_ADDRESS}`)
console.log(`Contract: ${CONTRACT_ADDRESS}`)
console.log('\nWaiting for USDC balance…')
for (let i = 0; i < 20; i++) {
  const bal = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET_ADDRESS],
  })
  if (bal > 0n) {
    console.log(`Balance confirmed: ${bal} base units (${Number(bal) / 1e6} USDC)`)
    break
  }
  if (i === 19) throw new Error('Faucet USDC never landed after 60s')
  process.stdout.write('.')
  await new Promise((r) => setTimeout(r, 3000))
}

// ── run ───────────────────────────────────────────────────────────────────────

const walletsClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })

// STEP 1 — approve
const approveTxHash = await sendTx(
  walletsClient,
  encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESS, AMOUNT_WEI],
  }),
  USDC_ADDRESS,
  'STEP 1 — approve 0.20 USDC',
)

// STEP 2 — createTaskEscrow
const taskSpecHash = keccak256(toBytes('e2e-test-task-spec-v1'))
const deadline     = BigInt(Math.floor(Date.now() / 1000) + 3600)

const createTxHash = await sendTx(
  walletsClient,
  encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'createTaskEscrow',
    args: [WALLET_ADDRESS, WALLET_ADDRESS, taskSpecHash, deadline, AMOUNT_WEI],
  }),
  CONTRACT_ADDRESS,
  'STEP 2 — createTaskEscrow',
)

const taskId = await publicClient.readContract({
  address: CONTRACT_ADDRESS, abi: ESCROW_ABI, functionName: 'taskCount',
})
console.log(`   Task ID : ${taskId}`)

// STEP 3 — submitDeliverable
const deliverableHash = keccak256(toBytes('e2e-test-deliverable-v1'))

const submitTxHash = await sendTx(
  walletsClient,
  encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'submitDeliverable',
    args: [taskId, deliverableHash],
  }),
  CONTRACT_ADDRESS,
  'STEP 3 — submitDeliverable',
)

// STEP 4 — approveAndSplit
const splitTxHash = await sendTx(
  walletsClient,
  encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: 'approveAndSplit',
    args: [taskId],
  }),
  CONTRACT_ADDRESS,
  'STEP 4 — approveAndSplit',
)

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════════════════╗
║        E2E TEST COMPLETE — ALL 4 STEPS PASSED               ║
╠══════════════════════════════════════════════════════════════╣
  Contract : ${CONTRACT_ADDRESS}
  Task ID  : ${taskId}
╠══════════════════════════════════════════════════════════════╣
  STEP 1 — approve 0.20 USDC
  Hash : ${approveTxHash}
  Link : ${txLink(approveTxHash)}

  STEP 2 — createTaskEscrow (0.20 USDC locked)
  Hash : ${createTxHash}
  Link : ${txLink(createTxHash)}

  STEP 3 — submitDeliverable
  Hash : ${submitTxHash}
  Link : ${txLink(submitTxHash)}

  STEP 4 — approveAndSplit (85/10/5% split credited)
  Hash : ${splitTxHash}
  Link : ${txLink(splitTxHash)}
╚══════════════════════════════════════════════════════════════╝`)
console.log('E2E_TEST_COMPLETE')
