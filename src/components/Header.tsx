import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { ARC_MAINNET_CHAIN_ID } from '../contracts/ArcAgentEscrowSplit'

const CHAIN_LABEL = 'Arc Testnet'

export default function Header() {
  const { chainId } = useAccount()
  const onMainnet = chainId === ARC_MAINNET_CHAIN_ID

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
      style={{
        background: 'rgba(13,27,47,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-8 items-center justify-center rounded-xl"
          style={{ background: 'var(--surface-strong)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
            <path d="M9 6L12.5 8V12L9 14L5.5 12V8L9 6Z" fill="var(--accent)" opacity="0.4" />
          </svg>
        </div>
        <div>
          <span className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>ArcPay</span>
          <span className="ml-1.5 text-xs" style={{ color: 'var(--subtle)' }}>Agentic USDC Escrow</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {chainId && (
          <div
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 sm:flex"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="size-1.5 rounded-full"
              style={{ background: onMainnet ? 'var(--success)' : 'var(--danger)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              {onMainnet ? CHAIN_LABEL : 'Wrong Network'}
            </span>
          </div>
        )}
        <ConnectKitButton />
      </div>
    </header>
  )
}
