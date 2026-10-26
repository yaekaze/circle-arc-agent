import { useState, useCallback } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { Layers, RefreshCw, AlertTriangle } from 'lucide-react'
import CreateEscrow from './CreateEscrow'
import TaskCard from './TaskCard'
import { ABI, CONTRACT_ADDRESS, ARC_MAINNET_CHAIN_ID } from '../contracts/ArcAgentEscrowSplit'

const CHAIN = ARC_MAINNET_CHAIN_ID
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const glass = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' },
}

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const [_refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const contractDeployed = CONTRACT_ADDRESS !== ZERO_ADDR

  // Read global taskCount
  const { data: countData } = useReadContracts({
    contracts: [{ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'taskCount', chainId: CHAIN }],
    query: { enabled: contractDeployed, refetchInterval: 8000, staleTime: 0 },
  })
  const taskCount = countData?.[0]?.result

  // Build task reads (up to 50 most recent)
  const count = Number(taskCount ?? 0n)
  const ids = Array.from({ length: Math.min(count, 50) }, (_, i) => BigInt(count - i))
  const taskContracts = ids.flatMap((id) => [
    { address: CONTRACT_ADDRESS, abi: ABI, functionName: 'tasks' as const, args: [id] as const, chainId: CHAIN },
  ])

  const { data: taskData, isFetching } = useReadContracts({
    contracts: taskContracts,
    query: { enabled: contractDeployed && ids.length > 0, staleTime: 0 },
  })

  interface RawTask {
    requester: `0x${string}`
    worker: `0x${string}`
    verifier: `0x${string}`
    taskSpecHash: `0x${string}`
    deliverableHash: `0x${string}`
    amount: bigint
    deadline: bigint
    status: number
  }

  const tasks = (taskData ?? []).map((r, i) => {
    const raw = r.result as RawTask | undefined
    if (!raw) return null
    return { taskId: ids[i], ...raw }
  }).filter(Boolean)

  // My tasks
  const myTasks = address
    ? tasks.filter((t) => t && (
        t.requester.toLowerCase() === address.toLowerCase() ||
        t.worker.toLowerCase() === address.toLowerCase() ||
        t.verifier.toLowerCase() === address.toLowerCase()
      ))
    : []

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Banner when contract not yet deployed */}
      {!contractDeployed && (
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(232,109,122,0.10)', border: '1px solid rgba(232,109,122,0.30)' }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>Contract not yet deployed.</strong>
            {' '}Set <code className="mono text-xs">VITE_CONTRACT_ADDRESS</code> in your <code className="mono text-xs">.env</code> to the deployed Arc Mainnet address, then restart the dev server.
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: task feed */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4" style={{ color: 'var(--accent)' }} />
              <span className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {address ? 'My Tasks' : 'Recent Tasks'}
              </span>
              {taskCount !== undefined && (
                <span className="rounded-full px-2 py-0.5 text-xs tabular-nums" style={{ background: 'var(--surface-strong)', color: 'var(--muted)' }}>
                  {count} total
                </span>
              )}
            </div>
            <button
              onClick={refresh}
              className="rounded-lg p-1.5 transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          {!isConnected && (
            <div className="flex flex-col items-center justify-center rounded-3xl py-16 text-center" style={glass.card}>
              <div className="mb-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>Connect your wallet to see your tasks</div>
              <div className="text-xs" style={{ color: 'var(--subtle)' }}>Requester, worker, and verifier roles all shown here</div>
            </div>
          )}

          {isConnected && myTasks.length === 0 && !isFetching && (
            <div className="flex flex-col items-center justify-center rounded-3xl py-16 text-center" style={glass.card}>
              <div className="mb-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>No tasks yet</div>
              <div className="text-xs" style={{ color: 'var(--subtle)' }}>Create a task escrow to get started</div>
            </div>
          )}

          <div className="space-y-4">
            {myTasks.map((t) => t && (
              <TaskCard key={t.taskId.toString()} task={t} onAction={refresh} />
            ))}
          </div>
        </div>

        {/* Right: create */}
        <div>
          <CreateEscrow onCreated={refresh} />

          {/* Protocol info card */}
          <div className="mt-4 rounded-3xl p-5" style={glass.card}>
            <div className="text-xs font-semibold mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>PROTOCOL MECHANICS</div>
            <div className="space-y-2.5 text-xs" style={{ color: 'var(--muted)' }}>
              <InfoRow label="Worker" value="85% via pull-claim" />
              <InfoRow label="Verifier" value="10% via pull-claim" />
              <InfoRow label="Treasury" value="5% via pull-claim" />
              <InfoRow label="Expiry refund" value="100% to requester" />
              <InfoRow label="Grace period" value="Deadline + 7 days" />
              <InfoRow label="Chain" value="Arc Testnet" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--subtle)' }}>{label}</span>
      <span className="font-medium tabular-nums" style={{ color: 'var(--muted)' }}>{value}</span>
    </div>
  )
}
