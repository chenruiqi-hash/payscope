# PayScope — Scoped Payment Authorization for AI Agents

> Built for The Synthesis 2026 Hackathon · Track: Agents That Pay

## The Problem

When an AI agent moves money on your behalf, three things can go wrong:
1. **No spending limits** — the agent can drain your wallet
2. **No purpose enforcement** — the agent can pay for anything, not just what you authorized
3. **No audit trail** — you can't verify what was spent or why

## The Solution

**PayScope** is a smart contract that creates cryptographically-enforced "payment scopes" for AI agents.

An owner funds a scope with ETH and specifies:
- Which agent address can spend it
- The maximum amount
- The purpose (e.g. "cloud services only")

The agent can only execute payments within those constraints. Every payment is recorded on-chain with a human-readable memo. Owners can revoke scopes and get unspent ETH back at any time.

## Architecture

```
Owner ──creates──► PaymentScope Contract ◄──executes── AI Agent
         (funds)         │                              (within limits)
                         │
                    on-chain audit log
```

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your private key and RPC URL
```

### 3. Deploy to Sepolia testnet
```bash
# Get free Sepolia ETH from https://sepoliafaucet.com
npm run deploy:sepolia
```

### 4. Run the AI agent demo
```bash
npm run demo
```

## Contract: PaymentScope.sol

### Key Functions

| Function | Who | Description |
|----------|-----|-------------|
| `createScope(agent, purpose)` | Owner | Fund a scope with ETH, authorize an agent |
| `executePayment(scopeId, to, amount, memo)` | Agent | Make a payment within scope |
| `revokeScope(scopeId)` | Owner | Cancel scope, get refund |
| `remaining(scopeId)` | Anyone | Check available balance |

### Events (on-chain audit trail)
- `ScopeCreated` — when a scope is funded
- `PaymentExecuted` — every payment with memo
- `ScopeRevoked` — when owner cancels

## Deployed on Sepolia

> Contract address: _(run deploy script to populate)_

## Why This Matters

As AI agents gain autonomy over financial decisions, the infrastructure must guarantee that:
- Agents **cannot exceed** their authorized budget
- Every transaction is **auditable** by the owner
- Trust is **enforced by code**, not by assuming the agent behaves correctly

PayScope makes Ethereum the trust layer for AI-powered payments.

## License
MIT
