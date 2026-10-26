import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ABI, CONTRACT_ADDRESS, ARC_MAINNET_CHAIN_ID } from '../contracts/ArcAgentEscrowSplit'
import { formatAddress, formatUsdc, TASK_STATUS, statusColor, hashString, parseOnchainError } from '../utils/format'

const CHAIN = ARC_MAINNET_CHAIN_ID

const glass = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' },
  inner: { background: 'var(--surface-strong)', border: '1px solid var(--border)' },
}

interface TaskData {
  taskId: bigint
  requester: string
  worker: string
  verifier: string
  taskSpecHash: string
  deliverableHash: string
  amount: bigint
  deadline: bigint
  status: number
}

export default function TaskCard({ task, onAction }: { task: TaskData; onAction: () => void }) {
  const { address, chainId } = useAccount()
  const wrongChain = chainId !== CHAIN
  const [expanded, setExpanded] = useState(false)
  const [deliverable, setDeliverable] = useState('')

  const isRequester = address?.toLowerCase() === task.requester.toLowerCase()
  const isWorker = address?.toLowerCase() === task.worker.toLowerCase()
  const isVerifier = address?.toLowerCase() === task.verifier.toLowerCase()
  const nowSecRef = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)))[0]
  const deadlinePassed = nowSecRef > task.deadline
  const gracePassed = nowSecRef > task.deadline + 604800n

  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const write = (args: Parameters<typeof writeContract>[0]) => {
    writeContract(
      { ...args, chainId: CHAIN },
      {
        onError: (e) => { toast.error(parseOnchainError(e)); reset() },
        onSuccess: () => { onAction(); toast.success('Transaction confirmed!') },
      },
    )
  }

  const handleSubmitDeliverable = () => {
    if (!deliverable) { toast.error('Enter deliverable content first'); return }
    write({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'submitDeliverable', args: [task.taskId, hashString(deliverable)] })
  }

  const handleApproveAndSplit = () => {
    write({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'approveAndSplit', args: [task.taskId] })
  }

  const handleReclaim = () => {
    write({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'reclaimExpired', args: [task.taskId] })
  }

  const handleWorkerClaim = () => {
    write({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'workerClaimAfterTimeout', args: [task.taskId] })
  }

  const handleClaim = () => {
    write({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'claim', args: [] })
  }

  const statusLabel = TASK_STATUS[task.status] ?? 'Unknown'
  const color = statusColor(task.status)
  const isWorking = isPending || confirming

  return (
    <div className="rounded-3xl p-5 transition-all" style={glass.card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>Task #{task.taskId.toString()}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: `${color}18`, color }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatUsdc(task.amount)}
            </span>
            <span className="text-sm" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="mt-1 rounded-lg p-1.5" style={{ background: 'var(--surface-strong)' }}>
          {expanded ? <ChevronUp className="size-4" style={{ color: 'var(--muted)' }} /> : <ChevronDown className="size-4" style={{ color: 'var(--muted)' }} />}
        </button>
      </div>

      {/* Deadline */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>Deadline:</span>
        <span className="text-xs tabular-nums font-medium" style={{ color: deadlinePassed ? 'var(--danger)' : 'var(--muted)' }}>
          {new Date(Number(task.deadline) * 1000).toLocaleString()}
          {deadlinePassed && ' · Expired'}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 text-xs" style={{ color: 'var(--subtle)' }}>
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span>Requester</span><span className="mono" style={{ color: 'var(--muted)' }}>{formatAddress(task.requester)}</span>
            <span>Worker</span><span className="mono" style={{ color: 'var(--muted)' }}>{formatAddress(task.worker)}</span>
            <span>Verifier</span><span className="mono" style={{ color: 'var(--muted)' }}>{formatAddress(task.verifier)}</span>
          </div>
          {task.deliverableHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
            <div>
              <span style={{ color: 'var(--subtle)' }}>Deliverable: </span>
              <span className="mono" style={{ color: 'var(--muted)' }}>{task.deliverableHash.slice(0, 18)}…</span>
            </div>
          )}
          {/* Split preview when settled */}
          {task.status === 2 && (
            <div className="rounded-xl p-3 mt-2 space-y-1" style={glass.inner}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>SETTLED SPLIT</div>
              {[['Worker 85%', task.amount * 85n / 100n], ['Verifier 10%', task.amount * 10n / 100n], ['Treasury 5%', task.amount - task.amount * 85n / 100n - task.amount * 10n / 100n]].map(([label, amt]) => (
                <div key={label as string} className="flex justify-between">
                  <span>{label as string}</span>
                  <span className="tabular-nums font-semibold" style={{ color: 'var(--success)' }}>{formatUsdc(amt as bigint)} USDC</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!wrongChain && (
        <div className="mt-4 space-y-2">
          {/* Worker: submit deliverable */}
          {isWorker && task.status === 0 && !deadlinePassed && (
            <div className="space-y-2">
              <div className="rounded-2xl p-3" style={glass.inner}>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--subtle)' }}>Deliverable content / URL</label>
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
                  style={{ color: 'var(--ink-2)' }}
                  placeholder="Paste result, IPFS hash, or URL…"
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                />
              </div>
              <ActionButton isWorking={isWorking} label="Submit Deliverable" onClick={handleSubmitDeliverable} />
            </div>
          )}

          {/* Requester/Verifier: approve & split */}
          {(isRequester || isVerifier) && task.status === 1 && (
            <ActionButton isWorking={isWorking} label="Approve & Split 85/10/5%" onClick={handleApproveAndSplit} accent />
          )}

          {/* Requester: reclaim expired */}
          {isRequester && task.status === 0 && deadlinePassed && (
            <ActionButton isWorking={isWorking} label="Reclaim Expired Escrow" onClick={handleReclaim} />
          )}

          {/* Worker: claim after timeout */}
          {isWorker && task.status === 1 && gracePassed && (
            <ActionButton isWorking={isWorking} label="Claim After Grace Period" onClick={handleWorkerClaim} />
          )}

          {/* Settled: claim allocation */}
          {task.status === 2 && (isWorker || isVerifier) && (
            <ActionButton isWorking={isWorking} label="Claim My Allocation" onClick={handleClaim} accent />
          )}
        </div>
      )}

      {txHash && isSuccess && (
        <a
          href={buildTxExplorerUrl(CHAIN, txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          View on explorer.arc.io <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}

function ActionButton({ label, onClick, isWorking, accent }: { label: string; onClick: () => void; isWorking: boolean; accent?: boolean }) {
  return (
    <button
      disabled={isWorking}
      onClick={onClick}
      className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={accent
        ? { background: 'var(--accent)', color: '#0d1b2f' }
        : { background: 'var(--surface-strong)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
    >
      {isWorking ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Processing…</span> : label}
    </button>
  )
}
