# ArcPay — Agentic USDC Escrow & Atomic Revenue Split

> Built with Arc Studio — money-powered apps in minutes

## What this app does

ArcPay is an operator dashboard for AI-agent task escrows on Arc Mainnet. Requesters lock USDC for tasks; workers submit deliverables; approvers trigger a 3-way atomic split (85% worker / 10% verifier / 5% treasury) via a pull-claim pattern. Expired tasks refund the requester. Unreviewed deliverables can be claimed by the worker after a 7-day grace period.

## Tech stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry + OpenZeppelin 5.6.1
- Chain: Arc Mainnet (Chain ID 5042, `defineChain` in `src/config.ts`)
- Token: USDC (6 decimals, ERC-20 address: 0x3600000000000000000000000000000000000000)
- Design: Arc Dark mode

## Contract

- Source: `contracts/ArcAgentEscrowSplit.sol`
- ABI + address config: `src/contracts/ArcAgentEscrowSplit.ts`
- Tests: `contracts/test/ArcAgentEscrowSplit.*.t.sol` (30 passing)
- **ARC TESTNET ADDRESS**: `0x7d19952a71ff38c29d78067cf33d2f23f0847ce2`
- Explorer: https://explorer.testnet.arc.io/address/0x7d19952a71ff38c29d78067cf33d2f23f0847ce2

## Key files

- `src/App.tsx` — root composition
- `src/components/Header.tsx` — nav + wallet connect + network indicator
- `src/components/Dashboard.tsx` — task feed + contract reads
- `src/components/CreateEscrow.tsx` — approve USDC + create escrow flow
- `src/components/TaskCard.tsx` — per-task actions (submit, approve, reclaim, claim)
- `src/contracts/ArcAgentEscrowSplit.ts` — ABI + address constant
- `src/utils/format.ts` — address formatting, USDC formatting, error parsing
- `src/config.ts` — wagmi config with Arc Mainnet + Arc Testnet + mainnet (ENS)

## Deployment instructions

1. Build contract: `forge build`
2. Deploy to Arc Mainnet with constructor args `(_usdcToken=0x3600000000000000000000000000000000000000, _treasury=<your_treasury>)`
3. Add `VITE_CONTRACT_ADDRESS=<deployed_address>` to `.env`
4. Restart dev server

## Security notes

- Pull-claim pattern prevents blocklisted-address fund lock
- `receive()` + `fallback()` both revert — no native USDC entry
- `usdcToken` and `treasury` are `immutable`
- ReentrancyGuard on all fund-moving functions
- Max security review (Critical + High + Medium + Low) passed
- 30 forge unit tests all passing
- Slither: no actionable High/Medium findings
- Third-party audit still recommended before real-value mainnet use
