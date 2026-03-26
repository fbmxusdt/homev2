import { parseAbiItem, formatUnits } from 'viem'
import { FBMXDAO_ABI } from '../config/contracts'

export const ACCOUNT_REGISTERED_EVENT = parseAbiItem(
  'event AccountRegistered(address indexed user, address indexed affiliateParent, address indexed binaryParent, bool binaryGroup)'
)

// ── Scan cache (localStorage) ─────────────────────────────────────────────────
const SCAN_CACHE_KEY = 'fbmx_scan_cache_v1'

/**
 * loadScanCache — reads the persisted scan state for a given contract address.
 * Returns null if no cache exists for that contract.
 */
export function loadScanCache(contractAddress) {
  try {
    const raw = localStorage.getItem(SCAN_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.contractAddress?.toLowerCase() !== contractAddress.toLowerCase()) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * saveScanCache — persists the current scan state to localStorage.
 * Shape: { contractAddress, fromBlock, lastScannedBlock, complete,
 *          users: string[], affiliateParents: {}, binaryParents: {} }
 */
export function saveScanCache(data) {
  localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(data))
}

/** clearScanCache — removes the scan cache. */
export function clearScanCache() {
  localStorage.removeItem(SCAN_CACHE_KEY)
}

/**
 * fetchAllUsersIncremental
 *
 * Scans getLogs one chunk at a time with a configurable delay between requests.
 * After every chunk it saves progress to localStorage so a page refresh or
 * manual stop can resume exactly where it left off.
 *
 * Options:
 *   chunkSize  — blocks per getLogs call (default 100; keep small for public RPCs)
 *   delayMs    — milliseconds to wait between chunks (default 2000)
 *   abortRef   — { current: boolean }; set to true to stop after current chunk
 *   onProgress — (pct: number, count: number, lastBlock: string) => void
 *
 * Returns the same shape as before:
 *   { registrationOrder, affiliateParentMap, binaryParentMap, complete }
 */
export async function fetchAllUsersIncremental(
  publicClient,
  contractAddress,
  fromBlock,
  { chunkSize = 100, delayMs = 2000, abortRef = { current: false }, onProgress } = {}
) {
  const LOG_CHUNK = BigInt(chunkSize)
  const latestBlock = await publicClient.getBlockNumber()

  // Load any existing cache for this contract
  const cache = loadScanCache(contractAddress)
  const cacheValid = cache && cache.fromBlock === String(fromBlock)

  const registrationOrder  = cacheValid ? [...cache.users]                                          : []
  const affiliateParentMap = cacheValid ? new Map(Object.entries(cache.affiliateParents || {}))     : new Map()
  const binaryParentMap    = cacheValid ? new Map(Object.entries(cache.binaryParents    || {}))     : new Map()
  const seenUsers          = new Set(registrationOrder.map((u) => u.toLowerCase()))

  // Resume from last saved block + 1, or start fresh
  const resumeFrom = (cacheValid && cache.lastScannedBlock)
    ? BigInt(cache.lastScannedBlock) + 1n
    : BigInt(fromBlock)

  // If previous scan already reached latest and cache is fresh, return immediately
  if (cacheValid && cache.complete && BigInt(cache.lastScannedBlock) >= latestBlock) {
    if (onProgress) onProgress(100, registrationOrder.length, cache.lastScannedBlock)
    return { registrationOrder, affiliateParentMap, binaryParentMap, complete: true }
  }

  const totalBlocks = latestBlock - BigInt(fromBlock) + 1n
  let chunkStart = resumeFrom

  while (chunkStart <= latestBlock) {
    if (abortRef.current) {
      // Save partial progress and return
      saveScanCache({
        contractAddress,
        fromBlock: String(fromBlock),
        lastScannedBlock: String(chunkStart - 1n),
        complete: false,
        users: registrationOrder,
        affiliateParents: Object.fromEntries(affiliateParentMap),
        binaryParents:    Object.fromEntries(
          [...binaryParentMap.entries()].map(([k, v]) => [k, { parent: v.parent, group: v.group }])
        ),
      })
      return { registrationOrder, affiliateParentMap, binaryParentMap, complete: false }
    }

    const chunkEnd = chunkStart + LOG_CHUNK - 1n < latestBlock
      ? chunkStart + LOG_CHUNK - 1n
      : latestBlock

    const logs = await publicClient.getLogs({
      address: contractAddress,
      event: ACCOUNT_REGISTERED_EVENT,
      fromBlock: chunkStart,
      toBlock: chunkEnd,
    })

    for (const log of logs) {
      const user           = log.args.user?.toLowerCase()
      const affiliateParent = log.args.affiliateParent?.toLowerCase()
      const binaryParent   = log.args.binaryParent?.toLowerCase()
      const binaryGroup    = log.args.binaryGroup

      if (!user || seenUsers.has(user)) continue
      seenUsers.add(user)
      registrationOrder.push(user)
      if (affiliateParent) affiliateParentMap.set(user, affiliateParent)
      if (binaryParent)    binaryParentMap.set(user, { parent: binaryParent, group: binaryGroup })
    }

    const isComplete = chunkEnd >= latestBlock

    // Persist after every chunk
    saveScanCache({
      contractAddress,
      fromBlock: String(fromBlock),
      lastScannedBlock: String(chunkEnd),
      complete: isComplete,
      users: registrationOrder,
      affiliateParents: Object.fromEntries(affiliateParentMap),
      binaryParents:    Object.fromEntries(
        [...binaryParentMap.entries()].map(([k, v]) => [k, { parent: v.parent, group: v.group }])
      ),
    })

    const blocksScanned = chunkEnd - BigInt(fromBlock) + 1n
    const pct = totalBlocks > 0n
      ? Math.min(100, Number((blocksScanned * 100n) / totalBlocks))
      : 100
    if (onProgress) onProgress(pct, registrationOrder.length, String(chunkEnd))

    chunkStart = chunkEnd + 1n

    if (!isComplete && !abortRef.current) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  return { registrationOrder, affiliateParentMap, binaryParentMap, complete: true }
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

/**
 * discoverUsersByTree
 *
 * BFS tree traversal using getChildren() — a plain eth_call that works on
 * ANY RPC including the public BSC dataseed nodes that block eth_getLogs.
 *
 * Starting from rootAddress it fans out through the entire affiliate tree,
 * saves progress to localStorage after every node, and supports pause/resume.
 *
 * Options:
 *   pageSize   — children per getChildren() call (default 50)
 *   delayMs    — ms between node reads (default 1000)
 *   abortRef   — { current: boolean }; set true to pause after current node
 *   onProgress — (count: number, currentAddr: string) => void
 *
 * Returns { registrationOrder: string[], complete: boolean }
 */
export async function discoverUsersByTree(
  publicClient,
  contractAddress,
  rootAddress,
  { pageSize = 50, delayMs = 1000, abortRef = { current: false }, onProgress } = {}
) {
  // Load any existing tree-scan cache
  const cache = loadScanCache(contractAddress)
  const isTreeCache = cache && cache.scanMode === 'tree' && cache.rootAddress?.toLowerCase() === rootAddress.toLowerCase()

  const visited = new Set(isTreeCache ? cache.users.map((u) => u.toLowerCase()) : [])
  const registrationOrder = isTreeCache ? [...cache.users] : []

  // Queue: addresses still to explore. Restore from cache or start fresh.
  const queue = isTreeCache
    ? (cache.pendingQueue || [rootAddress.toLowerCase()]).filter((a) => !visited.has(a.toLowerCase()))
    : [rootAddress.toLowerCase()]

  const persistCache = (complete) => {
    saveScanCache({
      scanMode: 'tree',
      contractAddress,
      rootAddress: rootAddress.toLowerCase(),
      fromBlock: 'tree',
      lastScannedBlock: 'tree',
      complete,
      users: registrationOrder,
      affiliateParents: {},
      binaryParents: {},
      pendingQueue: queue,
    })
  }

  while (queue.length > 0) {
    if (abortRef.current) {
      persistCache(false)
      return { registrationOrder, complete: false }
    }

    const addr = queue.shift()
    const addrLower = addr.toLowerCase()
    if (visited.has(addrLower)) continue
    visited.add(addrLower)
    registrationOrder.push(addrLower)

    // Paginate getChildren for this node
    let startIndex = 0
    while (true) {
      if (abortRef.current) break
      let children
      try {
        children = await publicClient.readContract({
          address: contractAddress,
          abi: FBMXDAO_ABI,
          functionName: 'getChildren',
          args: [addrLower, BigInt(startIndex), BigInt(pageSize)],
        })
      } catch {
        break
      }
      if (!children || children.length === 0) break

      for (const child of children) {
        const c = child.toLowerCase()
        if (c !== ZERO_ADDR && !visited.has(c)) queue.push(c)
      }

      if (children.length < pageSize) break
      startIndex += pageSize
    }

    if (onProgress) onProgress(registrationOrder.length, addrLower)

    // Persist after every node so a page refresh loses at most one node
    persistCache(queue.length === 0)

    if (queue.length > 0 && !abortRef.current) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  return { registrationOrder, complete: true }
}

/**
 * fetchAllUsers — legacy thin wrapper kept for the Verify tab.
 */
export async function fetchAllUsers(publicClient, contractAddress, fromBlock, onProgress, chunkSize = 500) {
  const { registrationOrder, affiliateParentMap, binaryParentMap } =
    await fetchAllUsersIncremental(publicClient, contractAddress, fromBlock, {
      chunkSize,
      delayMs: 150,
      onProgress,
    })
  return { registrationOrder, affiliateParentMap, binaryParentMap }
}

/**
 * findRoot
 * Returns the first value in affiliateParentMap that is NOT in registrationOrder Set.
 * This is the contract deployer (root) who never emitted AccountRegistered.
 */
export function findRoot(registrationOrder, affiliateParentMap) {
  const registeredSet = new Set(registrationOrder.map((a) => a.toLowerCase()))
  for (const parent of affiliateParentMap.values()) {
    if (!registeredSet.has(parent.toLowerCase())) {
      return parent.toLowerCase()
    }
  }
  return null
}

/**
 * fetchUserData
 * Multicalls affiliates, binaries, wallets, passives, tokenBalance, isUser
 * for a given user address on a given contract.
 * Returns structured user data.
 */
export async function fetchUserData(publicClient, contractAddress, userAddress) {
  const addr = userAddress

  const results = await publicClient.multicall({
    contracts: [
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'affiliates',    args: [addr] },
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'binaries',      args: [addr] },
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'wallets',       args: [addr] },
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'passives',      args: [addr] },
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'tokenBalance',  args: [addr] },
      { address: contractAddress, abi: FBMXDAO_ABI, functionName: 'isUser',        args: [addr] },
    ],
    allowFailure: true,
  })

  const [affiliateRes, binaryRes, walletRes, passiveRes, tokenBalRes, isUserRes] = results

  const aff   = affiliateRes.status   === 'success' ? affiliateRes.result   : null
  const bin   = binaryRes.status      === 'success' ? binaryRes.result      : null
  const wal   = walletRes.status      === 'success' ? walletRes.result      : null
  const pas   = passiveRes.status     === 'success' ? passiveRes.result     : null
  const tokBal = tokenBalRes.status   === 'success' ? tokenBalRes.result    : 0n
  const isUser = isUserRes.status     === 'success' ? isUserRes.result      : false

  const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

  return {
    address: addr,
    affiliate: {
      parent:      aff ? aff[0]         : ZERO_ADDR,
      agent:       aff ? aff[1]         : ZERO_ADDR,
      totalDirect: aff ? aff[2]         : 0n,
      level:       aff ? Number(aff[3]) : 0,
    },
    binary: {
      parent:       bin ? bin[0] : ZERO_ADDR,
      leftAddress:  bin ? bin[1] : ZERO_ADDR,
      rightAddress: bin ? bin[2] : ZERO_ADDR,
      leftVolume:   bin ? bin[3] : 0n,
      rightVolume:  bin ? bin[4] : 0n,
      coolDown:     bin ? bin[5] : 0n,
    },
    wallet: {
      balance:     wal ? wal[0] : 0n,
      capping:     wal ? wal[1] : 0n,
      totalIncome: wal ? wal[2] : 0n,
      coolDown:    wal ? wal[3] : 0n,
    },
    passive: {
      totalPassive: pas ? pas[0] : 0n,
      totalEquity:  pas ? pas[1] : 0n,
      coolDown:     pas ? pas[2] : 0n,
    },
    tokenBalance: tokBal,
    isUser,
  }
}

/**
 * compareUserData
 * Compare every field between oldData and newData.
 * Returns array of { path, old: string, new: string } mismatches.
 */
export function compareUserData(oldData, newData) {
  const mismatches = []

  function check(path, a, b) {
    const aStr = typeof a === 'bigint' ? a.toString() : String(a)
    const bStr = typeof b === 'bigint' ? b.toString() : String(b)
    if (aStr.toLowerCase() !== bStr.toLowerCase()) {
      mismatches.push({ path, old: aStr, new: bStr })
    }
  }

  check('affiliate.parent',      oldData.affiliate.parent,      newData.affiliate.parent)
  check('affiliate.agent',       oldData.affiliate.agent,       newData.affiliate.agent)
  check('affiliate.totalDirect', oldData.affiliate.totalDirect, newData.affiliate.totalDirect)
  check('affiliate.level',       oldData.affiliate.level,       newData.affiliate.level)

  check('binary.parent',       oldData.binary.parent,       newData.binary.parent)
  check('binary.leftAddress',  oldData.binary.leftAddress,  newData.binary.leftAddress)
  check('binary.rightAddress', oldData.binary.rightAddress, newData.binary.rightAddress)
  check('binary.leftVolume',   oldData.binary.leftVolume,   newData.binary.leftVolume)
  check('binary.rightVolume',  oldData.binary.rightVolume,  newData.binary.rightVolume)

  check('wallet.balance',     oldData.wallet.balance,     newData.wallet.balance)
  check('wallet.capping',     oldData.wallet.capping,     newData.wallet.capping)
  check('wallet.totalIncome', oldData.wallet.totalIncome, newData.wallet.totalIncome)

  check('passive.totalPassive', oldData.passive.totalPassive, newData.passive.totalPassive)
  check('passive.totalEquity',  oldData.passive.totalEquity,  newData.passive.totalEquity)

  check('tokenBalance', oldData.tokenBalance, newData.tokenBalance)
  check('isUser',       oldData.isUser,       newData.isUser)

  return mismatches
}

/**
 * formatSnapshot
 * Returns Record<string, string> with human-readable values.
 * formatUnits (18 decimals) for BigInt amounts, String() for others.
 */
export function formatSnapshot(rawData) {
  const fmt = (v) => {
    if (typeof v === 'bigint') return formatUnits(v, 18)
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'number') return String(v)
    return String(v)
  }

  return {
    'affiliate.parent':      fmt(rawData.affiliate.parent),
    'affiliate.agent':       fmt(rawData.affiliate.agent),
    'affiliate.totalDirect': fmt(rawData.affiliate.totalDirect),
    'affiliate.level':       fmt(rawData.affiliate.level),
    'binary.parent':         fmt(rawData.binary.parent),
    'binary.leftAddress':    fmt(rawData.binary.leftAddress),
    'binary.rightAddress':   fmt(rawData.binary.rightAddress),
    'binary.leftVolume':     fmt(rawData.binary.leftVolume),
    'binary.rightVolume':    fmt(rawData.binary.rightVolume),
    'binary.coolDown':       fmt(rawData.binary.coolDown),
    'wallet.balance':        fmt(rawData.wallet.balance),
    'wallet.capping':        fmt(rawData.wallet.capping),
    'wallet.totalIncome':    fmt(rawData.wallet.totalIncome),
    'wallet.coolDown':       fmt(rawData.wallet.coolDown),
    'passive.totalPassive':  fmt(rawData.passive.totalPassive),
    'passive.totalEquity':   fmt(rawData.passive.totalEquity),
    'passive.coolDown':      fmt(rawData.passive.coolDown),
    'tokenBalance':          fmt(rawData.tokenBalance),
    'isUser':                fmt(rawData.isUser),
  }
}
