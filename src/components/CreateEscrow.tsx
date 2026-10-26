import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, ExternalLink } from 'lucide-react'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { parseAmount } from '@/onchain-money'
import { ABI, CONTRACT_ADDRESS, ARC_MAINNET_CHAIN_ID } from '../contracts/ArcAgentEscrowSplit'
import { hashString, parseOnchainError } from '../utils/format'

const TASK_AMOUNT_USDC = '0.20'
const CHAIN = ARC_MAINNET_CHAIN_ID
const usdcFact = getUsdc(CHAIN)
const USDC_ADDRESS = usdcFact?.address as `0x${string}`

const glass = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' },
  inner: { background: 'var(--surface-strong)', border: '1px solid var(--border)' },
}

export default function CreateEscrow({ onCreated }: { onCreated: () => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== CHAIN

  const [worker, setWorker] = useState('')
  const [verifier, setVerifier] = useState('')
  const [taskSpec, setTaskSpec] = useState('')
  const [deadlineHours, setDeadlineHours] = useState('24')

  // Step 1: Approve USDC
  const { writeContract: approve, data: approveHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash })

  // Step 2: Create escrow
  const { writeContract: createEscrow, data: createHash, isPending: createPending } = useWriteContract()
  const { isLoading: createConfirming, isSuccess: createConfirmed } = useWaitForTransactionReceipt({ hash: createHash })

  // Read current allowance
  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
    chainId: CHAIN,
    query: { enabled: !!address },
  })

  const parsedAmount = usdcFact ? parseAmount(CHAIN, TASK_AMOUNT_USDC) : null
  const needsApproval = parsedAmount && (allowance === undefined || allowance < parsedAmount.raw)

  const handleApprove = () => {
    if (!parsedAmount) return
    approve(
      { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, parsedAmount.raw] },
      { onError: (e) => toast.error(parseOnchainError(e)) },
    )
  }

  const handleCreate = () => {
    if (!parsedAmount) return
    const deadlineSec = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineHours) * 3600)
    const specHash = hashString(taskSpec || 'default-task')
    createEscrow(
      {
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'createTaskEscrow',
        args: [worker as `0x${string}`, verifier as `0x${string}`, specHash, deadlineSec, parsedAmount.raw],
        chainId: CHAIN,
      },
      {
        onError: (e) => toast.error(parseOnchainError(e)),
        onSuccess: () => { onCreated(); toast.success('Task escrow created!') },
      },
    )
  }

  const isWorking = approvePending || approveConfirming || createPending || createConfirming

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg" style={{ background: 'rgba(172,198,233,0.12)' }}>
          <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>Create Task Escrow</span>
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: 'rgba(172,198,233,0.12)', color: 'var(--accent)' }}
        >
          0.20 USDC
        </span>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl p-3" style={glass.inner}>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--subtle)' }}>Worker Address</label>
          <input
            className="w-full bg-transparent text-sm outline-none mono placeholder:opacity-40"
            style={{ color: 'var(--ink-2)' }}
            placeholder="0x..."
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
          />
        </div>

        <div className="rounded-2xl p-3" style={glass.inner}>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--subtle)' }}>Verifier Address</label>
          <input
            className="w-full bg-transparent text-sm outline-none mono placeholder:opacity-40"
            style={{ color: 'var(--ink-2)' }}
            placeholder="0x..."
            value={verifier}
            onChange={(e) => setVerifier(e.target.value)}
          />
        </div>

        <div className="rounded-2xl p-3" style={glass.inner}>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--subtle)' }}>Task Specification</label>
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: 'var(--ink-2)' }}
            placeholder="Describe the agent task…"
            value={taskSpec}
            onChange={(e) => setTaskSpec(e.target.value)}
          />
          {taskSpec && (
            <div className="mt-1.5 text-xs mono opacity-50" style={{ color: 'var(--muted)' }}>
              hash: {hashString(taskSpec).slice(0, 18)}…
            </div>
          )}
        </div>

        <div className="rounded-2xl p-3" style={glass.inner}>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--subtle)' }}>Deadline (hours from now)</label>
          <input
            type="number"
            min="1"
            className="w-full bg-transparent text-sm outline-none tabular-nums placeholder:opacity-40"
            style={{ color: 'var(--ink-2)' }}
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(e.target.value)}
          />
        </div>
      </div>

      {/* Split preview */}
      <div className="mt-4 rounded-2xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>ATOMIC SPLIT PREVIEW</div>
        {[['Worker', '85%', '0.1700 USDC'], ['Verifier', '10%', '0.0200 USDC'], ['Treasury', '5%', '0.0100 USDC']].map(([role, pct, amt]) => (
          <div key={role} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{role}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{pct}</span>
              <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>{amt}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {wrongChain && (
          <button
            onClick={() => switchChain({ chainId: CHAIN })}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            Switch to Arc Testnet
          </button>
        )}

        {!wrongChain && needsApproval && !approveConfirmed && (
          <button
            disabled={!isConnected || isWorking}
            onClick={handleApprove}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--surface-strong)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            {approvePending || approveConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {approvePending ? 'Confirm in wallet…' : 'Approving USDC…'}
              </span>
            ) : 'Approve 0.20 USDC'}
          </button>
        )}

        <button
          disabled={!isConnected || wrongChain || isWorking || (!!needsApproval && !approveConfirmed) || createConfirmed}
          onClick={handleCreate}
          className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0d1b2f' }}
        >
          {!isConnected ? 'Connect Wallet'
            : createPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
            : createConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span>
            : createConfirmed ? 'Escrow Created!'
            : 'Lock 0.20 USDC in Escrow'}
        </button>
      </div>

      {createHash && createConfirmed && (
        <a
          href={buildTxExplorerUrl(CHAIN, createHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          View on explorer.arc.io <ExternalLink className="size-3" />
        </a>
      )}
    </section>
  )
}
