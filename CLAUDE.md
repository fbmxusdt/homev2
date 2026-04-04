# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # Production build (outputs to dist/)
npm run preview  # Serve the production build locally
npm run deploy   # npm run build → gh-pages -d dist --cname customdomain.com (publishes to GitHub Pages and custom domain)
```

No lint or test scripts exist. There is no TypeScript compilation step — JSX files are processed directly by Vite.

**Vite base path:** controlled by `VITE_BASE_URL` env var (defaults to `/`). Set to `/homev2/` for the GitHub Pages deployment at `fbmxusdt.github.io/homev2/`.

---

## Architecture

React 19 + Wagmi v2 + Viem dApp targeting **BSC mainnet (chain ID 56)**. All contract config is in `src/config/contracts.js` — never hardcode addresses or ABIs elsewhere.

**Wagmi config** (`src/config/wagmi.js`): RPC is hardcoded to `bsc-dataseed1.binance.org`. Connectors: injected (MetaMask etc.), WalletConnect (project ID hardcoded), Coinbase Wallet. `BSC_CHAIN_ID` is exported from this file — import it for chain checks rather than using the literal `56`.

**Vite browser shims** (in `vite.config.js`): `global → globalThis` and `process → process/browser` are required for wagmi/viem to work in the browser. Don't remove them.

**Data flow:**
1. `src/hooks/useUserData.js` batches 16 contract reads via `useReadContracts` (refetches every 10s), computes cooldown booleans, and returns a `user` object, token balances, allowances, cooldown timestamps, and protocol stats.
2. `Dashboard.jsx` destructures everything from `useUserData()` and passes relevant slices to child panels.
3. Dashboard tab state lives in the URL (`?tab=overview`) via `useSearchParams` — both `Navbar.jsx` and `Dashboard.jsx` read/write the same param. `ALL_TABS` is exported from `Dashboard.jsx` and imported by `Navbar.jsx` to render the mobile submenu. Tabs with `requiresReg: true` are hidden until registered; tabs with `hideIfReg: true` are hidden after registration.
4. Each panel (`RegisterPanel`, `DepositPanel`, `UpgradePanel`, `CollectWithdrawPanels`, `WithdrawPanel`) calls `useWriteContract` + `useWaitForTransactionReceipt` directly:
   ```js
   writeContract({ address, abi, functionName, args }, { onSuccess, onError })
   ```
5. The Navbar reads `owner()` from the contract to conditionally show the Admin link.

**Additional hooks exported from `useUserData.js`:**
- `usePlacementPreview(referrerAddress, group)` — calls `getPlacement()` to preview binary placement before registering
- `useChildrenPage(address, startIndex, count)` — paginated `getChildren()` call used by `GenealogyTree.jsx`

---

## Key Contracts

| Constant | Address |
|----------|---------|
| `FBMXDAO_ADDRESS` (V2, active) | `0x19176d7BA657D0697C67873d6ad38e27213D7B87` |
| `FBMXDAO_ADDRESS_OLD` (migration source) | `0xCac3c8Cdc5649fa2575da8F6F06431af6D529494` |
| `USDT_ADDRESS` | `0x55d398326f99059fF775485246999027B3197955` |
| `FBMX_ADDRESS` | `0x5951F937ff590239D38c10e871F9982359E56C36` |
| `PANCAKE_V3_POOL` | `0x200410102224189d502e33a1691f13f1b872755a` |
| `PANCAKE_V3_ROUTER` | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` |

**V2-only functions** (not in old contract):
- `hasActivated(address)` → bool — true after first `depositUSDT` call
- `transactionCooldown()` → uint256 — configurable anti-spam seconds (fallback: `COOLDOWN_TX_DEFAULT = 60`)
- `activateRank()` — upgrade rank from wallet balance (no USDT top-up)
- `depositUSDT(targetLevel)` — `0` = sequential; `>0` = jump to level in one tx (only when `hasActivated == false`)

**Level-jump cost:** `ENTRY_FEE * (2^targetLevel - 1)` where `ENTRY_FEE = 5 USDT`

**Contract return values are positional tuples** — always use index access, not named properties:
- `affiliates(addr)`: `[0]`=parent, `[1]`=agent, `[2]`=totalDirect, `[3]`=level
- `binaries(addr)`: `[0]`=parent, `[1]`=left, `[2]`=right, `[3]`=leftVol, `[4]`=rightVol, `[5]`=coolDown
- `wallets(addr)`: `[0]`=balance, `[1]`=capping, `[2]`=totalIncome, `[3]`=coolDown
- `passives(addr)`: `[0]`=totalPassive, `[1]`=totalEquity, `[2]`=coolDown

**Domain constants in `contracts.js`:**
- `WITHDRAW_TIERS` — array of `{ label, amount (wei BigInt), minLevel }` for the 5 withdrawal tiers ($15/$50/$100/$500/$1000)
- `MIN_FBMX_REQUIRED = 0.05 FBMX` (5×10¹⁶ wei) — burned from `tokenBalance` on every collect/withdraw call
- `MAX_RANK = 15`, `COOLDOWN_24H = 86400`

**`useUserData` return shape note:** Most money values are formatted strings (`formatUnits(..., 18)`). Exceptions: `upgradeAmount` is a raw BigInt (for direct allowance comparison); `usdtBalanceRaw`, `fbmxBalanceRaw`, `usdtAllowanceRaw`, `fbmxAllowanceRaw` are raw BigInts alongside their formatted counterparts.

---

## Rank System

Source of truth: `LEVELS` array in `src/pages/Rewards.jsx`. The `RANK_LABELS` and `RANK_COLORS` arrays in `Dashboard.jsx`, `UpgradePanel.jsx`, and `GenealogyTree.jsx` must stay in sync with it. Levels 0–14: Registered → Initiate → Scout → Pioneer → Challenger → Builder → Trailblazer → Guardian → Commander → Vanguard → Warlord → Sovereign → Archon → Titan → Fortress → Emperor.

---

## Cooldowns

Four independent cooldowns tracked in `useUserData`:

| Name | Contract storage | Duration |
|------|-----------------|----------|
| Passive | `passives[addr].coolDown` | 24h |
| Binary | `binaries[addr].coolDown` | 24h |
| Withdraw | `wallets[addr].coolDown` | 24h |
| Global (anti-spam) | `lastCallTime[addr]` + `transactionCooldown()` | configurable |

All panels receive `xyzCooldownEnds` (Unix timestamp as number) and pass it to `useCountdown()` for live display.

---

## Styling

Tailwind with a custom dark theme. Key brand tokens: `brand-gold` (#F5A623), `brand-green` (#00D4AA), `brand-red` (#FF4D6D), `brand-card` (#161B27), `brand-surface` (#10141C), `brand-border` (#1E2535), `brand-muted` (#8892A4). Custom responsive breakpoint `xs: 400px` added alongside the Tailwind defaults.

Utility classes in `src/index.css`: `.btn-gold`, `.card-glow`, `.gold-text`, `.animate-marquee`, `.animate-grid`, `.scrollbar-none`.

Fonts: **Syne** (`font-display`), **DM Sans** (body), **JetBrains Mono** (`font-mono`).

---

## Migration (Admin.jsx)

Migrates users from old contract to V2. Two discovery modes in `src/lib/migration.js`:
- **Log Scan** (`fetchAllUsersIncremental`) — `eth_getLogs` in chunks; **blocked on public BSC RPCs**, use only with private RPC.
- **Tree Scan** (`discoverUsersByTree`) — BFS via `getChildren()` eth_call; works on all RPCs including public ones.

Both modes persist progress to `localStorage` key `fbmx_scan_cache_v1` for pause/resume. Per-user migration writes 4 admin txs: `updateAffiliateData`, `updateBinaryData`, `updateWalletData`, `updatePassiveData` (via `ADMIN_ABI` in contracts.js).
