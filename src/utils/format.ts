import { keccak256, toBytes } from 'viem'

export const formatAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`

export const formatUsdc = (raw: bigint, decimals = 6) => {
  const n = Number(raw) / 10 ** decimals
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export const TASK_STATUS = ['Pending', 'Submitted', 'Settled', 'Refunded'] as const
export type TaskStatusLabel = typeof TASK_STATUS[number]

export const statusColor = (status: number): string => {
  switch (status) {
    case 0: return 'var(--accent)'
    case 1: return '#f59e0b'
    case 2: return 'var(--success)'
    case 3: return 'var(--subtle)'
    default: return 'var(--subtle)'
  }
}

export const hashString = (s: string): `0x${string}` =>
  keccak256(toBytes(s))

export const parseOnchainError = (error: unknown): string => {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) return 'Transaction cancelled.'
  if (msg.includes('zeroaddress')) return 'Invalid address — check worker and verifier fields.'
  if (msg.includes('invaliddeadline')) return 'Deadline must be in the future.'
  if (msg.includes('zeroamount')) return 'Amount must be at least 0.0001 USDC.'
  if (msg.includes('invalidtaskstatus')) return 'Task is not in the correct state for this action.'
  if (msg.includes('unauthorized')) return 'Your wallet is not authorized for this action.'
  if (msg.includes('deadlinenotpassed')) return 'Deadline has not yet passed.'
  if (msg.includes('deadlinepassed')) return 'Deadline has already passed.'
  if (msg.includes('nothingtoclaim')) return 'No claimable USDC for this address.'
  if (msg.includes('workerclaimtooearly')) return 'Grace period not yet elapsed (deadline + 7 days).'
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) return 'Insufficient USDC balance or allowance.'
  if (msg.includes('reverted')) return 'Transaction reverted — check your inputs.'
  return 'Something went wrong. Please try again.'
}
