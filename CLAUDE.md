# FBMXDAO — Claude Code Guide

## Project Overview

FBMXDAO is a DeFi rewards protocol on **Binance Smart Chain (BSC)**. Users register via a referral tree, deposit USDT to activate ranks, earn passive/binary rewards, and withdraw through a tier system. The frontend is a React + Wagmi v2 dApp.

---

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| UI | React | 19.0.0 |
| Build | Vite | 6.0.5 |
| Styling | Tailwind CSS | 3.4.16 |
| Web3 reads/writes | wagmi | 2.14.0 |
| Web3 primitives | viem | 2.21.0 |
| Server state | @tanstack/react-query | 5.62.0 |
| Icons | lucide-react | 0.468.0 |
| Animation | framer-motion | 11.15.0 |
| Routing | react-router-dom | 6.28.0 |

---

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
npm gh-pages -d dist # Publish on github page
```

---

## Project Structure

```
src/
├── config/
│   ├── contracts.js          # All contract addresses, ABIs, and domain constants
│   └── wagmi.js              # Wagmi config, BSC chain, WalletConnect project ID
├── hooks/
│   ├── useUserData.js        # Primary hook — 16 parallel contract reads, cooldown logic
│   └── useCountdown.js       # Live countdown formatter for cooldown timers
├── lib/
│   └── migration.js          # Event-log scanner, BFS tree traversal, localStorage cache
├── components/
│   ├── Navbar.jsx            # Fixed nav with wallet connect, network switch, mobile menu
│   └── dashboard/
│       ├── RegisterPanel.jsx          # register(address, uint8)
│       ├── DepositPanel.jsx           # depositUSDT(targetLevel) + depositFBMX(amount)
│       ├── UpgradePanel.jsx           # activateRank()
│       ├── CollectWithdrawPanels.jsx  # collectPassiveRewards / collectBinaryRewards / withdrawBalance
│       └── GenealogyTree.jsx          # Affiliate + binary tree viewer (read-only)
└── pages/
    ├── Landing.jsx    # Marketing page (stats ticker, reward types, tokenomics, how-it-works)
    ├── Dashboard.jsx  # Main user hub (tabs: overview / register / deposit / upgrade / passive / binary / withdraw / tree)
    ├── Rewards.jsx    # Educational: LEVELS array, allocation %, withdraw tiers — source of truth for rank data
    ├── Swap.jsx       # PancakeSwap V3 USDT ↔ FBMX swap interface
    └── Admin.jsx      # Migration tools (user discovery, per-user migrate + verify)
```

---

## Routes

| Path | Page | Notes |
|------|------|-------|
| `/` | Landing | Public marketing page |
| `/dashboard` | Dashboard | Requires wallet connection |
| `/swap` | Swap | PancakeSwap V3 DEX |
| `/rewards` | Rewards | Educational, no wallet required |
| `/admin` | Admin | Migration panel, owner-only write functions |

---

## Contract Addresses (BSC Mainnet)

```js
FBMXDAO_ADDRESS     = '0x19176d7BA657D0697C67873d6ad38e27213D7B87'  // current V2
FBMXDAO_ADDRESS_OLD = '0xCac3c8Cdc5649fa2575da8F6F06431af6D529494'  // old (migration source)
USDT_ADDRESS        = '0x55d398326f99059fF775485246999027B3197955'
FBMX_ADDRESS        = '0x5951F937ff590239D38c10e871F9982359E56C36'
PANCAKE_V3_POOL     = '0x200410102224189d502e33a1691f13f1b872755a'
PANCAKE_V3_ROUTER   = '0x1b81D678ffb9C0263b24A97847620C99d213eB14'
```

All contract interaction constants live in `src/config/contracts.js`. **Never hardcode addresses or ABIs elsewhere.**

---

## Key Domain Constants

```js
ENTRY_FEE          = 5 USDT × 2^level    // cost per sequential level-up
MIN_FBMX_REQUIRED  = 0.05 FBMX           // burned on every collect / withdraw
MAX_RANK           = 14                   // highest rank (Fortress)
COOLDOWN_24H       = 86400               // passive / binary / withdraw cooldown (seconds)
COOLDOWN_TX_DEFAULT = 60                 // fallback anti-spam cooldown (seconds)

WITHDRAW_TIERS = [
  { label: '$15',   minLevel: 1  },
  { label: '$50',   minLevel: 4  },
  { label: '$100',  minLevel: 7  },
  { label: '$500',  minLevel: 10 },
  { label: '$1000', minLevel: 13 },
]
```

---

## Rank System — Source of Truth

Rank names and colors are defined in `src/pages/Rewards.jsx` (`LEVELS` array). All other files that show rank labels **must** copy from there.

| Level | Name | Color |
|-------|------|-------|
| 0 | Registered | `#6B7280` |
| 1 | Initiate | `#CD7F32` |
| 2 | Scout | `#C0C0C0` |
| 3 | Pioneer | `#F5A623` |
| 4 | Challenger | `#E5E4E2` |
| 5 | Builder | `#00D4AA` |
| 6 | Trailblazer | `#3B82F6` |
| 7 | Guardian | `#A855F7` |
| 8 | Commander | `#EC4899` |
| 9 | Vanguard | `#F97316` |
| 10 | Warlord | `#EF4444` |
| 11 | Sovereign | `#8B5CF6` |
| 12 | Archon | `#06B6D4` |
| 13 | Titan | `#F59E0B` |
| 14 | Fortress | `#F5A623` |

Files that contain `RANK_LABELS` / `RANK_COLORS` arrays (keep in sync):
- `src/pages/Dashboard.jsx`
- `src/components/dashboard/UpgradePanel.jsx`
- `src/components/dashboard/GenealogyTree.jsx`

---

## Contract Write Pattern

All panels follow this same flow:

```jsx
const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

// ERC20 approval first (if needed), then the contract call
writeContract(
  { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'collectPassiveRewards', args: [] },
  { onSuccess: () => onSuccess?.(), onError: () => setStep('idle') }
)
```

**Approval flow** (DepositPanel only): approve `maxUint256` to FBMXDAO_ADDRESS, then call the deposit.

---

## useUserData Hook

`src/hooks/useUserData.js` — single source for all on-chain user state. Refetches every 10 seconds.

Returns (key fields):

```js
// User struct (null if not registered)
user.level          // current rank 0–14
user.hasActivated   // V2: true after first depositUSDT call
user.walletBalance  // USDT earned in contract (formatted)
user.capping        // max earnable USDT (formatted)
user.totalIncome    // lifetime USDT earned (formatted)
user.passiveReward  // claimable passive (formatted)
user.upgradeAmount  // cost of next sequential level-up (raw BigInt)
user.upgradeAmountFmt // formatted string

// Wallet balances
usdtBalance / usdtBalanceRaw
fbmxBalance / fbmxBalanceRaw
usdtAllowanceRaw / fbmxAllowanceRaw

// Cooldowns (Unix timestamps for useCountdown)
isGlobalCooldown  / globalCooldownEnds   // per-user anti-spam (txCooldownSecs)
isPassiveCooldown / passiveCooldownEnds  // 24h passive collect
isBinaryCooldown  / binaryCooldownEnds   // 24h binary collect
isWithdrawCooldown / withdrawCooldownEnds // 24h withdraw

// Stats
stats.totalUsers / totalUSDT / totalFBMX / totalDeposits / totalRewards / totalWithdrawals
```

**Contract return values are positional tuples** — always access by index (`aff[0]`, `bin[1]`, etc.), not by name. Index map:
- `affiliates`: `[0]`=parent, `[1]`=agent, `[2]`=totalDirect, `[3]`=level
- `binaries`: `[0]`=parent, `[1]`=leftAddress, `[2]`=rightAddress, `[3]`=leftVolume, `[4]`=rightVolume, `[5]`=coolDown
- `wallets`: `[0]`=balance, `[1]`=capping, `[2]`=totalIncome, `[3]`=coolDown
- `passives`: `[0]`=totalPassive, `[1]`=totalEquity, `[2]`=coolDown

---

## V2 Contract Features

The current contract (`FBMXDAO_ADDRESS`) is V2. New features vs old:

| Feature | Details |
|---------|---------|
| `hasActivated` | Bool flag — set to `true` after first `depositUSDT` call |
| `transactionCooldown()` | Configurable anti-spam cooldown (seconds); falls back to `COOLDOWN_TX_DEFAULT = 60` if unavailable |
| `depositUSDT(targetLevel)` | `targetLevel = 0` → sequential; `targetLevel > 0` → jump to level in one tx (only when `hasActivated == false`) |
| `activateRank()` | Upgrade rank using wallet balance (no USDT top-up needed) |

**Level-jump cost formula:**
```js
jumpCost(targetLevel) = ENTRY_FEE * (2^targetLevel - 1)
// e.g. jump to level 3: 5 * (8 - 1) = 35 USDT
```

---

## Cooldown System

Three independent 24h cooldowns + one global anti-spam:

| Cooldown | Contract field | Resets on |
|----------|---------------|-----------|
| Passive | `passives.coolDown` | `collectPassiveRewards()` |
| Binary | `binaries.coolDown` | `collectBinaryRewards()` |
| Withdraw | `wallets.coolDown` | `withdrawBalance()` |
| Global (anti-spam) | `lastCallTime` + `transactionCooldown` | any write |

UI: all panels receive `cooldownEnds` (Unix timestamp) and `globalCooldownEnds`, then use `useCountdown()` for live countdowns.

---

## Migration Tools (Admin.jsx)

Used to migrate users from old contract to new:

1. **Discover users** — two modes:
   - Log Scan: `eth_getLogs` with incremental chunks (blocked on public BSC RPCs)
   - Tree Scan: BFS via `getChildren()` (eth_call, works everywhere)
2. **Per-user migrate** — 4 sequential transactions: `updateAffiliateData`, `updateBinaryData`, `updateWalletData`, `updatePassiveData`
3. **Per-user verify** — multicall old vs new contract, shows field-level mismatches

Scan state persisted to `localStorage` key `fbmx_scan_cache_v1` — supports pause/resume.

---

## Tailwind Brand Colors

Defined in `tailwind.config.js`:

```
brand-dark    #0A0C10   page background
brand-surface #10141C   section background
brand-card    #161B27   card background
brand-border  #1E2535   borders
brand-muted   #8892A4   secondary text
brand-gold    #F5A623   primary actions, highlights
brand-green   #00D4AA   success, ready states
brand-red     #FF4D6D   errors, warnings
```

Custom classes in `index.css`:
- `.btn-gold` — primary gold button
- `.card-glow` — hover glow on cards
- `.gold-text` — gradient gold text
- `.animate-marquee` — horizontal ticker
- `.animate-grid` — animated background grid

Fonts: **Syne** (display/headings), **DM Sans** (body), **JetBrains Mono** (addresses/numbers).

---

## No Environment Variables

All config (RPC URL, contract addresses, WalletConnect project ID) is hardcoded in `src/config/`. If adding env support, use `VITE_` prefix for Vite to expose them to the browser.

---

## BSC Network Config

- Chain ID: `56`
- RPC: `https://bsc-dataseed1.binance.org`
- **Public BSC RPCs block `eth_getLogs`** — use tree-scan (`getChildren` BFS) for user discovery instead.
