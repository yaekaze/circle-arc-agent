/**
 * ArcAgentEscrowSplit contract config
 * Update CONTRACT_ADDRESS after mainnet deployment.
 * Built with Arc Studio — https://studio.arc.io
 */

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

// Deployed on Arc Testnet: 0x7d19952a71ff38c29d78067cf33d2f23f0847ce2
// Switch to 5042 when deploying to Arc Mainnet
export const ARC_MAINNET_CHAIN_ID = 5042002 // Arc Testnet

export const ABI = [
  // ── state reads ──────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'usdcToken',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'taskCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tasks',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      { name: 'requester', type: 'address' },
      { name: 'worker', type: 'address' },
      { name: 'verifier', type: 'address' },
      { name: 'taskSpecHash', type: 'bytes32' },
      { name: 'deliverableHash', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimable',
    inputs: [{ name: 'address', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  // ── write ─────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createTaskEscrow',
    inputs: [
      { name: 'worker', type: 'address' },
      { name: 'verifier', type: 'address' },
      { name: 'taskSpecHash', type: 'bytes32' },
      { name: 'deadline', type: 'uint64' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitDeliverable',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'deliverableHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveAndSplit',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reclaimExpired',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'workerClaimAfterTimeout',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ── events ────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'TaskCreated',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: true },
      { name: 'worker', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DeliverableSubmitted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'worker', type: 'address', indexed: true },
      { name: 'deliverableHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskSettled',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'workerAmount', type: 'uint256', indexed: false },
      { name: 'verifierAmount', type: 'uint256', indexed: false },
      { name: 'treasuryAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskRefunded',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // ── errors ────────────────────────────────────────────────────────────────
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'InvalidDeadline', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'InvalidTaskStatus', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'DeadlineNotPassed', inputs: [] },
  { type: 'error', name: 'DeadlinePassed', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'WorkerClaimTooEarly', inputs: [] },
] as const
