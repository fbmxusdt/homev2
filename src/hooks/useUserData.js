import { useReadContracts, useReadContract } from 'wagmi'
import { useAccount } from 'wagmi'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI, USDT_ADDRESS, FBMX_ADDRESS, ERC20_ABI, COOLDOWN_TX_DEFAULT } from '../config/contracts'
import { formatUnits } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000'

export function useUserData() {
  const { address } = useAccount()

  const base = { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI }

  const { data, isLoading, refetch } = useReadContracts({
    contracts: address ? [
      // 0  affiliates
      { ...base, functionName: 'affiliates',     args: [address] },
      // 1  binaries
      { ...base, functionName: 'binaries',       args: [address] },
      // 2  wallets
      { ...base, functionName: 'wallets',        args: [address] },
      // 3  passives
      { ...base, functionName: 'passives',       args: [address] },
      // 4  lastCallTime (global per-user anti-spam — duration from transactionCooldown)
      { ...base, functionName: 'lastCallTime',   args: [address] },
      // 5  tokenBalance (FBMX deposited in contract)
      { ...base, functionName: 'tokenBalance',   args: [address] },
      // 6  isUser
      { ...base, functionName: 'isUser',         args: [address] },
      // 7  getPassiveReward
      { ...base, functionName: 'getPassiveReward', args: [address] },
      // 8  getUpgradeAmount
      { ...base, functionName: 'getUpgradeAmount', args: [address] },
      // 9  getContractStats
      { ...base, functionName: 'getContractStats' },
      // 10 USDT wallet balance
      { address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',  args: [address] },
      // 11 FBMX wallet balance
      { address: FBMX_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',  args: [address] },
      // 12 USDT allowance to contract
      { address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',  args: [address, FBMXDAO_ADDRESS] },
      // 13 FBMX allowance to contract
      { address: FBMX_ADDRESS, abi: ERC20_ABI, functionName: 'allowance',  args: [address, FBMXDAO_ADDRESS] },
      // 14 hasActivated (V2 — first activation flag)
      { ...base, functionName: 'hasActivated', args: [address] },
      // 15 transactionCooldown (V2 — configurable anti-spam seconds; may fail on old contract)
      { ...base, functionName: 'transactionCooldown' },
    ] : [],
    query: { refetchInterval: 10000, enabled: !!address },
  })

  // ── Raw reads ──────────────────────────────────────────────────────────────
  const affiliateRaw   = data?.[0]?.result
  const binaryRaw      = data?.[1]?.result
  const walletRaw      = data?.[2]?.result
  const passiveRaw     = data?.[3]?.result
  const lastCallRaw    = data?.[4]?.result ?? 0n
  const fbmxInContract = data?.[5]?.result ?? 0n
  const isRegistered   = data?.[6]?.result ?? false
  const passiveReward  = data?.[7]?.result ?? 0n
  const upgradeAmount  = data?.[8]?.result ?? 0n
  const statsRaw       = data?.[9]?.result
  const usdtWallet     = data?.[10]?.result ?? 0n
  const fbmxWallet     = data?.[11]?.result ?? 0n
  const usdtAllowance  = data?.[12]?.result ?? 0n
  const fbmxAllowance  = data?.[13]?.result ?? 0n
  const hasActivated   = data?.[14]?.result ?? false
  // falls back to COOLDOWN_TX_DEFAULT (60s) when contract doesn't expose the getter yet
  const txCooldown     = data?.[15]?.result ?? BigInt(COOLDOWN_TX_DEFAULT)

  // ── Cooldown logic ─────────────────────────────────────────────────────────
  const nowSec  = BigInt(Math.floor(Date.now() / 1000))
  const SEC_24H = 86400n

  // per-user anti-spam (lastCallTime + transactionCooldown)
  const globalEndsRaw   = lastCallRaw > 0n ? lastCallRaw + txCooldown : 0n
  const isGlobalCooldown = nowSec < globalEndsRaw

  // passive cooldown from passives.coolDown
  const passiveCoolRaw   = passiveRaw ? (passiveRaw[2] ?? 0n) : 0n
  const passiveEndsRaw   = passiveCoolRaw > 0n ? passiveCoolRaw + SEC_24H : 0n
  const isPassiveCooldown = nowSec < passiveEndsRaw

  // binary cooldown from binaries.coolDown
  const binaryCoolRaw    = binaryRaw ? (binaryRaw[5] ?? 0n) : 0n
  const binaryEndsRaw    = binaryCoolRaw > 0n ? binaryCoolRaw + SEC_24H : 0n
  const isBinaryCooldown  = nowSec < binaryEndsRaw

  // withdraw cooldown from wallets.coolDown
  const walletCoolRaw    = walletRaw ? (walletRaw[3] ?? 0n) : 0n
  const withdrawEndsRaw  = walletCoolRaw > 0n ? walletCoolRaw + SEC_24H : 0n
  const isWithdrawCooldown = nowSec < withdrawEndsRaw

  // ── Parsed user object ─────────────────────────────────────────────────────
  const user = isRegistered ? {
    isRegistered,
    // affiliates
    level:        affiliateRaw ? Number(affiliateRaw[3])           : 0,
    parent:       affiliateRaw ? affiliateRaw[0]                   : ZERO,
    agent:        affiliateRaw ? affiliateRaw[1]                   : ZERO,
    totalDirect:  affiliateRaw ? formatUnits(affiliateRaw[2] ?? 0n, 18) : '0',
    // binaries
    leftAddress:  binaryRaw ? binaryRaw[1]  : ZERO,
    rightAddress: binaryRaw ? binaryRaw[2]  : ZERO,
    leftVolume:   binaryRaw ? formatUnits(binaryRaw[3] ?? 0n, 18) : '0',
    rightVolume:  binaryRaw ? formatUnits(binaryRaw[4] ?? 0n, 18) : '0',
    binaryParent: binaryRaw ? binaryRaw[0]  : ZERO,
    // wallets
    walletBalance:  walletRaw ? formatUnits(walletRaw[0] ?? 0n, 18) : '0',
    capping:        walletRaw ? formatUnits(walletRaw[1] ?? 0n, 18) : '0',
    totalIncome:    walletRaw ? formatUnits(walletRaw[2] ?? 0n, 18) : '0',
    // passives
    totalPassive:   passiveRaw ? formatUnits(passiveRaw[0] ?? 0n, 18) : '0',
    totalEquity:    passiveRaw ? formatUnits(passiveRaw[1] ?? 0n, 18) : '0',
    // computed
    passiveReward:  formatUnits(passiveReward, 18),
    upgradeAmount:  upgradeAmount,          // raw BigInt for approve comparison
    upgradeAmountFmt: formatUnits(upgradeAmount, 18),
    // FBMX in contract
    fbmxInContract: formatUnits(fbmxInContract, 18),
    fbmxInContractRaw: fbmxInContract,
    // V2: first-activation flag
    hasActivated,
  } : null

  // ── Contract stats ─────────────────────────────────────────────────────────
  const stats = statsRaw ? {
    totalUsers:            Number(statsRaw[0]),
    totalUSDT:             formatUnits(statsRaw[1], 18),
    totalFBMX:             formatUnits(statsRaw[2], 18),
    totalDeposits:         formatUnits(statsRaw[3], 18),
    totalRewards:          formatUnits(statsRaw[4], 18),
    totalWithdrawals:      formatUnits(statsRaw[5], 18),
    totalMarketingFunding: formatUnits(statsRaw[6], 18),
    totalProjectFunding:   formatUnits(statsRaw[7], 18),
    totalLiquidityFunding: formatUnits(statsRaw[8], 18),
  } : null

  return {
    user,
    isLoading,
    refetch,
    isRegistered,
    // token balances in wallet
    usdtBalance:    formatUnits(usdtWallet,    18),
    fbmxBalance:    formatUnits(fbmxWallet,    18),
    usdtBalanceRaw: usdtWallet,
    fbmxBalanceRaw: fbmxWallet,
    // allowances
    usdtAllowance:    formatUnits(usdtAllowance, 18),
    fbmxAllowance:    formatUnits(fbmxAllowance, 18),
    usdtAllowanceRaw: usdtAllowance,
    fbmxAllowanceRaw: fbmxAllowance,
    // cooldowns (as Unix timestamps for useCountdown)
    txCooldownSecs:       Number(txCooldown),   // actual configured seconds (for labels)
    isGlobalCooldown,
    globalCooldownEnds:   Number(globalEndsRaw),
    isPassiveCooldown,
    passiveCooldownEnds:  Number(passiveEndsRaw),
    isBinaryCooldown,
    binaryCooldownEnds:   Number(binaryEndsRaw),
    isWithdrawCooldown,
    withdrawCooldownEnds: Number(withdrawEndsRaw),
    // stats
    stats,
  }
}

export function usePlacementPreview(referrerAddress, group) {
  const enabled = !!referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000'
  const { data, refetch } = useReadContract({
    address: FBMXDAO_ADDRESS,
    abi: FBMXDAO_ABI,
    functionName: 'getPlacement',
    args: [referrerAddress, group],
    query: { enabled },
  })
  return { placement: data, refetch }
}

export function useChildrenPage(address, startIndex = 0, count = 50) {
  const { data, isLoading, refetch } = useReadContract({
    address: FBMXDAO_ADDRESS,
    abi: FBMXDAO_ABI,
    functionName: 'getChildren',
    args: [address, BigInt(startIndex), BigInt(count)],
    query: { enabled: !!address, staleTime: 15000 },
  })
  return { children: data ?? [], isLoading, refetch }
}
