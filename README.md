# ArcPay — Agentic USDC Escrow & Atomic Revenue Split

A full-stack dApp on Arc Mainnet for conditional AI-agent task escrows with atomic 3-way USDC revenue splitting (85% worker / 10% verifier / 5% treasury).

Built with [Arc Studio](https://studio.arc.io)

## What it does

Operators lock 0.20 USDC into a task escrow for an AI agent. When the worker submits a deliverable and the requester or verifier approves, the contract atomically splits USDC across three parties via a pull-claim pattern. If no one approves before the deadline, the requester reclaims the full amount. If a deliverable was submitted but approval never comes, the worker can claim their allocation after a 7-day grace period.

## Tech stack

- Solidity 0.8.28 / Foundry (contracts)
- OpenZeppelin 5.6.1 (`SafeERC20`, `ReentrancyGuard`)
- React 18 + TypeScript + Vite
- wagmi v2 + ConnectKit (wallet connection)
- Tailwind CSS (Arc Dark design system)
- Arc Mainnet (chain ID 5042) — USDC as native gas token

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh) (for contract work)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_CONTRACT_ADDRESS` | Deployed `ArcAgentEscrowSplit` address on Arc Mainnet. Set after deployment. |
| `RPC_PROXY_BASE_URL` | Optional — Arc Studio RPC proxy base URL (provisioned automatically in Arc Studio). |
| `RPC_PROXY_TOKEN` | Optional — Arc Studio RPC proxy token (provisioned automatically in Arc Studio). |
| `RPC_PROXY_CHAINS` | Optional — Comma-separated chain keys covered by the proxy (provisioned automatically in Arc Studio). |

### Run

```bash
bun run dev
```

### Build

```bash
bunx vite build
```

### Test contracts

```bash
bun run contracts:test
```

### Compile contracts

```bash
bun run contracts:build
```

## Contract: ArcAgentEscrowSplit

Located at `contracts/ArcAgentEscrowSplit.sol`. Key functions:

- `createTaskEscrow` — locks USDC; requires prior ERC-20 approval
- `submitDeliverable` — worker records deliverable hash
- `approveAndSplit` — requester or verifier triggers pull-claim split (85/10/5)
- `claim` — each recipient pulls their claimable USDC allocation
- `reclaimExpired` — requester reclaims 100% after deadline with no submission
- `workerClaimAfterTimeout` — worker claims after deadline + 7-day grace period

Constructor args: `(address _usdcToken, address _treasury)`.
On Arc Mainnet: `_usdcToken = 0x3600000000000000000000000000000000000000`.

## Deployment (Arc Mainnet)

Mainnet deployment must be done independently outside Arc Studio using your own wallet and credentials.

1. Complete [Circle mainnet enablement](https://console.circle.com/)
2. Fund your deployer wallet with USDC on Arc Mainnet
3. Build: `cd /path/to/project && forge build`
4. Deploy using your preferred tool, passing the USDC address and your treasury address as constructor args
5. Set `VITE_CONTRACT_ADDRESS` in `.env` to the deployed address

> **Warning:** Mainnet transactions involve real funds and are irreversible. Independently review, test, and audit the contract before deploying with real funds.

## Security

- All transfers use `SafeERC20`
- Reentrancy protected via `OpenZeppelin ReentrancyGuard`
- Pull-claim pattern prevents blocklisted-recipient fund lock
- `receive()` and `fallback()` both revert (no native USDC entry)
- `usdcToken` and `treasury` are `immutable`
- Minimum escrow amount: 100 base units (0.0001 USDC)
- 30 forge unit tests (happy path, reverts, fuzz, invariants) — all passing
- `max` depth security review completed (Critical + High + Medium + Low)

> This code has not been independently professionally audited. Do not deploy with real funds without a third-party audit.
