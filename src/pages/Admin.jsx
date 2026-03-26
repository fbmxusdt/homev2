import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, usePublicClient, useWriteContract, useSwitchChain, useConnect } from 'wagmi'
import { isAddress } from 'viem'
import {
  ShieldCheck, Play, Pause, RefreshCw, CheckCircle2, XCircle, Loader2,
  AlertTriangle, Search, Users, Database, GitBranch, RotateCcw,
  ChevronDown, ChevronRight, Wallet, Network, ArrowRight, Zap, Clock,
  BarChart3,
} from 'lucide-react'
import { BSC_CHAIN_ID } from '../config/wagmi'
import { ADMIN_ABI, FBMXDAO_ADDRESS, DEPLOY_BLOCK_HINT, FBMXDAO_ADDRESS_OLD } from '../config/contracts'
import {
  fetchAllUsers,
  fetchAllUsersIncremental,
  discoverUsersByTree,
  findRoot,
  fetchUserData,
  compareUserData,
  formatSnapshot,
  loadScanCache,
  clearScanCache,
} from '../lib/migration'

// ── Constants ─────────────────────────────────────────────────────────────────
const ZERO = '0x0000000000000000000000000000000000000000'
const LS_KEY = 'fbmx_migration_v1'

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function loadDoneSet() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDone(addr) {
  const s = loadDoneSet()
  s.add(addr.toLowerCase())
  localStorage.setItem(LS_KEY, JSON.stringify([...s]))
}

function clearDone() {
  localStorage.removeItem(LS_KEY)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ConnectPrompt() {
  const { connect, connectors } = useConnect()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-6">
          <Wallet size={32} className="text-brand-gold" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">Connect Wallet</h2>
        <p className="text-brand-muted text-sm mb-6">Connect your admin wallet to access the migration system.</p>
        <div className="relative inline-block">
          <button onClick={() => setOpen(!open)} className="btn-gold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
            Connect Wallet
            <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-brand-card border border-brand-border rounded-xl overflow-hidden z-10 shadow-card">
              {connectors.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => { connect({ connector: c }); setOpen(false) }}
                  className="w-full px-4 py-3 text-sm text-brand-muted hover:text-brand-gold hover:bg-brand-gold/5 border-b border-brand-border last:border-0 text-left transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WrongNetworkBanner() {
  const { switchChain } = useSwitchChain()
  return (
    <div className="mx-4 mt-6 p-4 rounded-xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="text-brand-red flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-brand-red">Wrong Network</div>
          <div className="text-xs text-brand-muted">Please switch to BNB Smart Chain to use the admin panel.</div>
        </div>
      </div>
      <button
        onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
        className="flex-shrink-0 px-4 py-2 rounded-lg bg-brand-red/20 border border-brand-red/40 text-brand-red text-sm font-semibold hover:bg-brand-red/30 transition-all"
      >
        Switch to BSC
      </button>
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'done')
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-green/20 text-brand-green">Done</span>
  if (status === 'error')
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-red/20 text-brand-red">Error</span>
  if (status === 'running')
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 animate-pulse">Running</span>
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-border/50 text-brand-muted">Pending</span>
}

function ProgressBar({ pct, label }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs text-brand-muted">{label}</div>}
      <div className="h-2 w-full bg-brand-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-gold to-yellow-400 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="text-right text-xs font-mono text-brand-gold">{pct.toFixed(1)}%</div>
    </div>
  )
}

function StatCard({ label, value, color = 'gold', icon: Icon }) {
  const colorMap = {
    gold:  'bg-brand-gold/10 text-brand-gold',
    green: 'bg-brand-green/10 text-brand-green',
    red:   'bg-brand-red/10 text-brand-red',
    blue:  'bg-blue-500/10 text-blue-400',
  }
  const valColor = {
    gold:  'text-brand-gold',
    green: 'text-brand-green',
    red:   'text-brand-red',
    blue:  'text-blue-400',
  }
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon size={16} />
      </div>
      <div className={`text-2xl font-mono font-bold mb-0.5 ${valColor[color]}`}>{value}</div>
      <div className="text-xs text-brand-muted">{label}</div>
    </div>
  )
}

// ── Migration Tab ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 100

function MigrationTab({ publicClient, address: connectedAddress }) {
  const { writeContractAsync } = useWriteContract()

  // ── Config ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    oldContract: FBMXDAO_ADDRESS_OLD,
    newContract: '0x19176d7BA657D0697C67873d6ad38e27213D7B87',
    fromBlock: String(DEPLOY_BLOCK_HINT),
    chunkSize: '100',
    scanDelay: '2000',   // ms between chunks / nodes
    rootAddress: '',     // required for tree-scan mode
  })

  // ── Owner check ───────────────────────────────────────────────────────────
  const [ownerAddress, setOwnerAddress] = useState(null)
  const [ownerLoading, setOwnerLoading] = useState(false)
  const [ownerError,   setOwnerError]   = useState(null)

  useEffect(() => {
    if (!isAddress(config.newContract)) { setOwnerAddress(null); setOwnerError(null); return }
    let cancelled = false
    setOwnerLoading(true); setOwnerError(null)
    publicClient.readContract({ address: config.newContract, abi: ADMIN_ABI, functionName: 'owner' })
      .then((o) => { if (!cancelled) { setOwnerAddress(o); setOwnerLoading(false) } })
      .catch((e) => { if (!cancelled) { setOwnerError(e.shortMessage || e.message); setOwnerLoading(false) } })
    return () => { cancelled = true }
  }, [config.newContract, publicClient])

  const isOwner = ownerAddress && connectedAddress &&
    ownerAddress.toLowerCase() === connectedAddress.toLowerCase()

  // ── Scan cache status (mirrors what's in localStorage) ────────────────────
  const [cacheInfo, setCacheInfo] = useState(() => loadScanCache(FBMXDAO_ADDRESS))

  // Refresh cache info helper
  const refreshCache = () => setCacheInfo(loadScanCache(config.oldContract))

  // ── User list ─────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([])
  const [rootUser, setRootUser]     = useState(null)
  const [fetchPhase, setFetchPhase] = useState('idle')
  const [fetchPct, setFetchPct]     = useState(0)
  const [fetchCount, setFetchCount] = useState(0)
  const [fetchLastBlock, setFetchLastBlock] = useState('')
  const [fetchError, setFetchError] = useState(null)
  const [pasteMode, setPasteMode]   = useState(false)
  const [pasteText, setPasteText]   = useState('')

  // ── Load cache into table on mount ────────────────────────────────────────
  useEffect(() => {
    const cache = loadScanCache(config.oldContract)
    if (!cache || cache.users.length === 0) return
    const list = cache.users
    const affMap = new Map(Object.entries(cache.affiliateParents || {}))
    const root = findRoot(list, affMap)
    const ordered = root && !list.includes(root) ? [root, ...list] : list
    setRootUser(root)
    setUsers(ordered)
    setPage(0)
    const doneSet = loadDoneSet()
    const statuses = {}
    for (const addr of ordered) {
      statuses[addr] = { migrate: doneSet.has(addr.toLowerCase()) ? 'done' : 'pending', migrateError: null, verify: 'idle', mismatches: [] }
    }
    setUserStatus(statuses)
    setFetchPhase(cache.complete ? 'done' : 'paused')
    setCacheInfo(cache)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Per-user status ───────────────────────────────────────────────────────
  // { [addr]: { migrate: 'pending'|'running'|'done'|'error', migrateError: string|null,
  //             verify: 'idle'|'running'|'matched'|'mismatch'|'error', mismatches: [] } }
  const [userStatus, setUserStatus] = useState({})

  const updMig  = (addr, migrate) =>
    setUserStatus((p) => ({ ...p, [addr]: { ...p[addr], migrate } }))
  const updMigE = (addr, migrateError) =>
    setUserStatus((p) => ({ ...p, [addr]: { ...p[addr], migrateError } }))
  const updVer  = (addr, verify, mismatches = []) =>
    setUserStatus((p) => ({ ...p, [addr]: { ...p[addr], verify, mismatches } }))

  // ── Running flags ─────────────────────────────────────────────────────────
  const [migrateRunning, setMigrateRunning] = useState(false)
  const [verifyRunning,  setVerifyRunning]  = useState(false)
  const abortMig  = useRef(false)
  const abortVer  = useRef(false)
  const abortScan = useRef(false)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(users.length / PAGE_SIZE)
  const pageUsers  = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Load from cache (instant — no RPC) ───────────────────────────────────
  const handleLoadFromCache = useCallback(() => {
    const cache = loadScanCache(config.oldContract)
    if (!cache || cache.users.length === 0) return
    const list   = cache.users
    const affMap = new Map(Object.entries(cache.affiliateParents || {}))
    const root   = findRoot(list, affMap)
    const ordered = root && !list.includes(root) ? [root, ...list] : list
    setRootUser(root)
    setUsers(ordered)
    setPage(0)
    const doneSet = loadDoneSet()
    const statuses = {}
    for (const addr of ordered) {
      statuses[addr] = { migrate: doneSet.has(addr.toLowerCase()) ? 'done' : 'pending', migrateError: null, verify: 'idle', mismatches: [] }
    }
    setUserStatus(statuses)
    setFetchPhase(cache.complete ? 'done' : 'paused')
    setCacheInfo(cache)
  }, [config.oldContract])

  // ── Scan logs incrementally, saving each chunk to localStorage ────────────
  const handleStartScan = useCallback(async () => {
    if (!isAddress(config.oldContract)) return
    abortScan.current = false
    setFetchPhase('fetching'); setFetchPct(0); setFetchCount(0); setFetchLastBlock(''); setFetchError(null)
    try {
      const fromBlock = BigInt(config.fromBlock || '0')
      const chunk     = Math.max(10, parseInt(config.chunkSize, 10) || 100)
      const delay     = Math.max(500, parseInt(config.scanDelay, 10) || 2000)

      const { registrationOrder, affiliateParentMap, complete } = await fetchAllUsersIncremental(
        publicClient, config.oldContract, fromBlock,
        {
          chunkSize: chunk,
          delayMs: delay,
          abortRef: abortScan,
          onProgress: (pct, count, lastBlock) => {
            setFetchPct(pct); setFetchCount(count); setFetchLastBlock(lastBlock)
          },
        }
      )

      // Merge new addresses into existing table without losing verify/migrate state
      const doneSet = loadDoneSet()
      setUsers((prev) => {
        const existing = new Set(prev.map((a) => a.toLowerCase()))
        const newAddrs = registrationOrder.filter((a) => !existing.has(a.toLowerCase()))
        return [...prev, ...newAddrs]
      })
      setUserStatus((prev) => {
        const next = { ...prev }
        for (const addr of registrationOrder) {
          if (!next[addr]) {
            next[addr] = { migrate: doneSet.has(addr.toLowerCase()) ? 'done' : 'pending', migrateError: null, verify: 'idle', mismatches: [] }
          }
        }
        return next
      })
      // Resolve root
      const root = findRoot(registrationOrder, affiliateParentMap)
      if (root) setRootUser(root)

      refreshCache()
      setFetchPhase(complete ? 'done' : 'paused')
    } catch (err) {
      console.error('fetchAllUsers error', err)
      setFetchError(err.shortMessage || err.message || String(err))
      refreshCache()
      setFetchPhase('error')
    }
  }, [config.oldContract, config.fromBlock, config.chunkSize, config.scanDelay, publicClient])

  // ── Tree-scan (eth_call via getChildren — works on all RPCs) ─────────────
  const handleTreeScan = useCallback(async () => {
    if (!isAddress(config.oldContract) || !isAddress(config.rootAddress)) return
    abortScan.current = false
    setFetchPhase('fetching'); setFetchPct(0); setFetchCount(0); setFetchLastBlock('tree'); setFetchError(null)
    try {
      const delay = Math.max(200, parseInt(config.scanDelay, 10) || 1000)
      const { registrationOrder, complete } = await discoverUsersByTree(
        publicClient, config.oldContract, config.rootAddress,
        {
          pageSize: 50,
          delayMs: delay,
          abortRef: abortScan,
          onProgress: (count, addr) => {
            setFetchCount(count)
            setFetchLastBlock(addr)
          },
        }
      )

      const doneSet = loadDoneSet()
      setUsers(registrationOrder)
      setRootUser(config.rootAddress.toLowerCase())
      setPage(0)
      const statuses = {}
      for (const addr of registrationOrder) {
        statuses[addr] = { migrate: doneSet.has(addr) ? 'done' : 'pending', migrateError: null, verify: 'idle', mismatches: [] }
      }
      setUserStatus(statuses)
      refreshCache()
      setFetchPhase(complete ? 'done' : 'paused')
    } catch (err) {
      console.error('discoverUsersByTree error', err)
      setFetchError(err.shortMessage || err.message || String(err))
      refreshCache()
      setFetchPhase('error')
    }
  }, [config.oldContract, config.rootAddress, config.scanDelay, publicClient])

  // ── Load from paste ───────────────────────────────────────────────────────
  const handlePasteLoad = () => {
    const addrs  = pasteText.split(/[\n,\s]+/).map((a) => a.trim()).filter((a) => isAddress(a))
    const unique = [...new Set(addrs.map((a) => a.toLowerCase()))]
    if (unique.length === 0) return
    setUsers(unique)
    setRootUser(null)
    setPage(0)
    const doneSet = loadDoneSet()
    const statuses = {}
    for (const addr of unique) {
      statuses[addr] = { migrate: doneSet.has(addr) ? 'done' : 'pending', migrateError: null, verify: 'idle', mismatches: [] }
    }
    setUserStatus(statuses)
    setFetchPhase('done')
    setPasteMode(false)
    setPasteText('')
  }

  // ── Migrate single user ───────────────────────────────────────────────────
  const migrateOne = useCallback(async (addr) => {
    updMig(addr, 'running')
    try {
      const oldData   = await fetchUserData(publicClient, config.oldContract, addr)
      const isRoot    = addr.toLowerCase() === rootUser?.toLowerCase()
      const affParent = isRoot ? ZERO : oldData.affiliate.parent
      const binParent = isRoot ? ZERO : oldData.binary.parent

      const tx1 = await writeContractAsync({ address: config.newContract, abi: ADMIN_ABI, functionName: 'updateAffiliateData',
        args: [addr, affParent, oldData.affiliate.agent, oldData.affiliate.totalDirect,
               oldData.affiliate.level, oldData.isUser, oldData.affiliate.level > 0 || oldData.isUser] })
      await publicClient.waitForTransactionReceipt({ hash: tx1 })

      const tx2 = await writeContractAsync({ address: config.newContract, abi: ADMIN_ABI, functionName: 'updateBinaryData',
        args: [addr, binParent, oldData.binary.leftAddress, oldData.binary.rightAddress,
               oldData.binary.leftVolume, oldData.binary.rightVolume, oldData.binary.coolDown] })
      await publicClient.waitForTransactionReceipt({ hash: tx2 })

      const tx3 = await writeContractAsync({ address: config.newContract, abi: ADMIN_ABI, functionName: 'updateWalletData',
        args: [addr, oldData.wallet.balance, oldData.wallet.capping, oldData.wallet.totalIncome,
               oldData.wallet.coolDown, oldData.tokenBalance] })
      await publicClient.waitForTransactionReceipt({ hash: tx3 })

      const tx4 = await writeContractAsync({ address: config.newContract, abi: ADMIN_ABI, functionName: 'updatePassiveData',
        args: [addr, oldData.passive.totalPassive, oldData.passive.totalEquity, oldData.passive.coolDown] })
      await publicClient.waitForTransactionReceipt({ hash: tx4 })

      updMig(addr, 'done')
      saveDone(addr)
    } catch (err) {
      console.error(`Migrate ${addr}:`, err)
      updMig(addr, 'error')
      updMigE(addr, err.shortMessage || err.message || String(err))
    }
  }, [config.oldContract, config.newContract, publicClient, rootUser, writeContractAsync])

  // ── Verify single user ────────────────────────────────────────────────────
  const verifyOne = useCallback(async (addr) => {
    if (!isAddress(config.newContract)) return
    updVer(addr, 'running')
    try {
      const [oldData, newData] = await Promise.all([
        fetchUserData(publicClient, config.oldContract, addr),
        fetchUserData(publicClient, config.newContract, addr),
      ])
      const mm = compareUserData(oldData, newData)
      updVer(addr, mm.length === 0 ? 'matched' : 'mismatch', mm)
    } catch {
      updVer(addr, 'error')
    }
  }, [config.oldContract, config.newContract, publicClient])

  // ── Migrate current page ──────────────────────────────────────────────────
  const handleMigratePage = useCallback(async () => {
    if (!isAddress(config.newContract)) return
    abortMig.current = false
    setMigrateRunning(true)
    for (const addr of pageUsers) {
      if (abortMig.current) break
      if (userStatus[addr]?.migrate === 'done') continue
      await migrateOne(addr)
    }
    setMigrateRunning(false)
  }, [pageUsers, userStatus, config.newContract, migrateOne])

  // ── Verify all ────────────────────────────────────────────────────────────
  const handleVerifyAll = useCallback(async () => {
    if (!isAddress(config.newContract)) return
    abortVer.current = false
    setVerifyRunning(true)
    for (const addr of users) {
      if (abortVer.current) break
      await verifyOne(addr)
      await new Promise((r) => setTimeout(r, 50))
    }
    setVerifyRunning(false)
  }, [users, config.newContract, verifyOne])

  const handleReset = () => {
    clearDone()
    clearScanCache()
    setUsers([])
    setUserStatus({})
    setFetchPhase('idle')
    setFetchPct(0); setFetchCount(0); setFetchLastBlock(''); setFetchError(null)
    setRootUser(null); setPage(0)
    setCacheInfo(null)
    setMigrateRunning(false); setVerifyRunning(false)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allSt        = Object.values(userStatus)
  const migratedCount = allSt.filter((s) => s.migrate === 'done').length
  const errorCount    = allSt.filter((s) => s.migrate === 'error').length
  const matchedCount  = allSt.filter((s) => s.verify === 'matched').length
  const mismatchCount = allSt.filter((s) => s.verify === 'mismatch').length
  const progressPct   = users.length > 0 ? (migratedCount / users.length) * 100 : 0

  // ── Paste address count preview ───────────────────────────────────────────
  const pasteValidCount = pasteText.split(/[\n,\s]+/).filter((a) => isAddress(a.trim())).length

  return (
    <div className="space-y-5">

      {/* Config */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-brand-gold" />
          <h3 className="font-semibold text-white text-sm">Migration Config</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Old Contract Address</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.oldContract} onChange={(e) => setConfig((c) => ({ ...c, oldContract: e.target.value }))} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">New Contract Address</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.newContract} onChange={(e) => setConfig((c) => ({ ...c, newContract: e.target.value }))} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Deploy Block (log scan start)</label>
            <input type="number" className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.fromBlock} onChange={(e) => setConfig((c) => ({ ...c, fromBlock: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Blocks per Request (chunk size)</label>
            <select className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.chunkSize} onChange={(e) => setConfig((c) => ({ ...c, chunkSize: e.target.value }))}>
              {[['10','10 — ultra safe'],['50','50 — very safe'],['100','100 — safe (default)'],['250','250 — medium'],['500','500 — private RPC']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Delay Between Requests</label>
            <select className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.scanDelay} onChange={(e) => setConfig((c) => ({ ...c, scanDelay: e.target.value }))}>
              {[['500','0.5s — fast'],['1000','1s'],['2000','2s (default)'],['5000','5s — very safe'],['10000','10s — maximum safe']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-brand-muted mb-1.5 block">
              Root Address <span className="text-brand-gold">(Tree Scan — no eth_getLogs needed)</span>
            </label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.rootAddress}
              onChange={(e) => setConfig((c) => ({ ...c, rootAddress: e.target.value }))}
              placeholder="Contract owner / deployer address 0x…" />
            <p className="text-[11px] text-brand-muted mt-1">
              Tree Scan uses <code>getChildren()</code> (eth_call) — works on public RPC nodes that block eth_getLogs.
            </p>
          </div>
        </div>

        {/* Cache status */}
        {cacheInfo && (
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
            cacheInfo.complete
              ? 'bg-brand-green/10 border-brand-green/20 text-brand-green'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <div className="flex items-center gap-2">
              {cacheInfo.complete ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              <span>
                {cacheInfo.complete
                  ? `Cache complete — ${cacheInfo.users.length} users stored`
                  : `Cache partial — ${cacheInfo.users.length} users, last block ${cacheInfo.lastScannedBlock}`}
              </span>
            </div>
            <button onClick={handleLoadFromCache}
              className="px-2 py-0.5 rounded-md bg-current/10 hover:bg-current/20 font-semibold transition-colors">
              Load
            </button>
          </div>
        )}
        {isAddress(config.newContract) && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            ownerLoading ? 'bg-brand-surface text-brand-muted' :
            ownerError   ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' :
            isOwner      ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' :
                           'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {ownerLoading ? <Loader2 size={12} className="animate-spin" /> : ownerError ? <XCircle size={12} /> : isOwner ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {ownerLoading ? 'Checking ownership…' : ownerError ? `Owner check failed: ${ownerError}` :
             isOwner ? `You are the owner (${shortAddr(ownerAddress)})` : `Owner: ${shortAddr(ownerAddress)} — not you`}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Users"    value={users.length}    color="gold"  icon={Users} />
        <StatCard label="Migrated"       value={migratedCount}   color="green" icon={CheckCircle2} />
        <StatCard label="Migrate Errors" value={errorCount}      color="red"   icon={XCircle} />
        <StatCard label="Verify"         value={`${matchedCount}✓ ${mismatchCount}✗`} color="blue" icon={ShieldCheck} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Scan / resume / stop */}
        {fetchPhase !== 'fetching' ? (
          <>
            <button onClick={handleStartScan} disabled={!isAddress(config.oldContract)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-surface border border-brand-border text-brand-muted hover:text-white hover:border-brand-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Search size={15} />
              {fetchPhase === 'paused' && cacheInfo?.scanMode !== 'tree' ? 'Resume Log Scan' : 'Scan Logs'}
            </button>
            <button onClick={handleTreeScan}
              disabled={!isAddress(config.oldContract) || !isAddress(config.rootAddress)}
              className="btn-gold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <GitBranch size={15} />
              {fetchPhase === 'paused' && cacheInfo?.scanMode === 'tree' ? 'Resume Tree Scan' : 'Tree Scan'}
            </button>
          </>
        ) : (
          <button onClick={() => { abortScan.current = true }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all">
            <Pause size={15} />Pause Scan
          </button>
        )}
        <button onClick={() => setPasteMode((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-surface border border-brand-border text-brand-muted hover:text-white hover:border-brand-gold/30 transition-all">
          <Network size={15} />
          {pasteMode ? 'Cancel' : 'Paste Addresses'}
        </button>
        {users.length > 0 && (
          <>
            <button onClick={handleMigratePage} disabled={migrateRunning || !isAddress(config.newContract)}
              className="btn-gold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {migrateRunning ? <><Loader2 size={15} className="animate-spin" />Migrating…</> : <><Play size={15} />Migrate Page</>}
            </button>
            {migrateRunning && (
              <button onClick={() => { abortMig.current = true }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all">
                <Pause size={15} />Stop
              </button>
            )}
            <button onClick={handleVerifyAll} disabled={verifyRunning || !isAddress(config.newContract)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {verifyRunning ? <><Loader2 size={15} className="animate-spin" />Verifying…</> : <><ShieldCheck size={15} />Verify All</>}
            </button>
            {verifyRunning && (
              <button onClick={() => { abortVer.current = true }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-surface border border-brand-border text-brand-muted hover:text-white transition-all">
                <Pause size={15} />Stop Verify
              </button>
            )}
            <button onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-red/10 border border-brand-red/30 text-brand-red hover:bg-brand-red/20 transition-all ml-auto">
              <RotateCcw size={15} />Reset
            </button>
          </>
        )}
      </div>

      {/* Paste mode */}
      {pasteMode && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
          <div className="text-xs text-brand-muted">Paste addresses separated by newlines, commas, or spaces. Use this if log scanning hits RPC limits.</div>
          <textarea
            className="w-full h-36 bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors resize-none"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"0xabc123...\n0xdef456...\n0x789abc..."}
          />
          <button onClick={handlePasteLoad} disabled={pasteValidCount === 0}
            className="btn-gold px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowRight size={14} />Load {pasteValidCount} address{pasteValidCount !== 1 ? 'es' : ''}
          </button>
        </div>
      )}

      {/* Scan progress */}
      {fetchPhase === 'fetching' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-brand-muted">
            <div className="flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-brand-gold" />
              <span>Scanning — <span className="text-white font-semibold">{fetchCount} users</span> found, saving to cache after each chunk…</span>
            </div>
            {fetchLastBlock && <span className="font-mono">block {fetchLastBlock}</span>}
          </div>
          <ProgressBar pct={fetchPct} />
          <div className="text-[11px] text-brand-muted">
            Progress is saved automatically. You can pause and resume at any time without losing data.
          </div>
        </div>
      )}
      {fetchPhase === 'paused' && users.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <Pause size={13} />
          Scan paused — {users.length} users in cache. Click <strong>Resume Scan</strong> to continue or <strong>Migrate Page</strong> to start migrating now.
        </div>
      )}
      {fetchPhase === 'error' && fetchError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
          <XCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Scan failed at block {fetchLastBlock || '?'} — partial results saved to cache</div>
            <div className="font-mono break-all mb-1">{fetchError}</div>
            <div className="text-brand-red/70">Try: lower chunk size (10–50) · increase delay (5s–10s) · or use Paste Addresses</div>
          </div>
        </div>
      )}

      {/* Migration progress */}
      {users.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
          <ProgressBar pct={progressPct} label={`${migratedCount} / ${users.length} migrated`} />
        </div>
      )}

      {/* Paginated user table */}
      {users.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-brand-border grid grid-cols-[2.5rem_1fr_6rem_6rem_4.5rem] gap-2 items-center bg-brand-surface/50">
            <span className="text-[11px] text-brand-muted font-semibold">#</span>
            <span className="text-[11px] text-brand-muted font-semibold">Address</span>
            <span className="text-[11px] text-brand-muted font-semibold text-center">Migrate</span>
            <span className="text-[11px] text-brand-muted font-semibold text-center">Verify</span>
            <span className="text-[11px] text-brand-muted font-semibold text-center">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-brand-border/40">
            {pageUsers.map((addr, i) => {
              const globalIdx = page * PAGE_SIZE + i
              const isRoot    = addr.toLowerCase() === rootUser?.toLowerCase()
              const st        = userStatus[addr] || { migrate: 'pending', verify: 'idle', mismatches: [] }

              const migColor = st.migrate === 'done'    ? 'text-brand-green'
                             : st.migrate === 'error'   ? 'text-brand-red'
                             : st.migrate === 'running' ? 'text-brand-gold'
                             : 'text-brand-muted'
              const migLabel = st.migrate === 'done'    ? '✓ Done'
                             : st.migrate === 'error'   ? '✗ Error'
                             : st.migrate === 'running' ? '⋯'
                             : '○ Pending'

              const verColor = st.verify === 'matched'  ? 'text-brand-green'
                             : st.verify === 'mismatch' ? 'text-brand-red'
                             : st.verify === 'error'    ? 'text-brand-red'
                             : st.verify === 'running'  ? 'text-brand-gold'
                             : 'text-brand-muted'
              const verLabel = st.verify === 'matched'  ? '✓ Match'
                             : st.verify === 'mismatch' ? `✗ ${st.mismatches?.length}Δ`
                             : st.verify === 'error'    ? '✗ Error'
                             : st.verify === 'running'  ? '⋯'
                             : '— Idle'

              return (
                <div key={addr}>
                  <div className="px-4 py-2.5 grid grid-cols-[2.5rem_1fr_6rem_6rem_4.5rem] gap-2 items-center hover:bg-brand-surface/40 transition-colors">
                    <span className="text-xs text-brand-muted text-right tabular-nums">{globalIdx + 1}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs text-white truncate">{addr}</span>
                      {isRoot && <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-brand-gold/20 text-brand-gold border border-brand-gold/30 flex-shrink-0">ROOT</span>}
                    </div>
                    <div className={`text-xs font-semibold text-center ${migColor} ${st.migrate === 'running' ? 'animate-pulse' : ''}`}>{migLabel}</div>
                    <div className={`text-xs font-semibold text-center ${verColor} ${st.verify === 'running' ? 'animate-pulse' : ''}`}>{verLabel}</div>
                    <div className="flex gap-1 justify-center">
                      <button title="Migrate this user" onClick={() => migrateOne(addr)}
                        disabled={migrateRunning || st.migrate === 'done' || !isAddress(config.newContract)}
                        className="p-1.5 rounded-lg bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Play size={10} />
                      </button>
                      <button title="Verify this user" onClick={() => verifyOne(addr)}
                        disabled={verifyRunning || !isAddress(config.newContract)}
                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ShieldCheck size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Mismatch field details */}
                  {st.verify === 'mismatch' && st.mismatches?.length > 0 && (
                    <div className="px-4 pb-2.5 ml-10">
                      <table className="w-full text-[10px]">
                        <tbody>
                          {st.mismatches.map((m) => (
                            <tr key={m.path} className="border-t border-brand-border/30">
                              <td className="py-0.5 pr-2 font-mono text-brand-gold w-36">{m.path}</td>
                              <td className="py-0.5 pr-2 font-mono text-brand-red truncate max-w-[140px]" title={m.old}>{m.old}</td>
                              <td className="py-0.5 font-mono text-brand-green truncate max-w-[140px]" title={m.new}>{m.new}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Migrate error detail */}
                  {st.migrate === 'error' && st.migrateError && (
                    <div className="px-4 pb-2 ml-10 text-[10px] font-mono text-brand-red break-all">{st.migrateError}</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-brand-border flex items-center justify-between bg-brand-surface/30">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-brand-surface border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ArrowRight size={11} className="rotate-180" /> Prev
              </button>
              <span className="text-xs text-brand-muted tabular-nums">
                Page {page + 1} / {totalPages} · {pageUsers.length} of {users.length} users
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-brand-surface border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Verify Tab ────────────────────────────────────────────────────────────────
function VerifyTab({ publicClient }) {
  const [oldContract,  setOldContract]  = useState(FBMXDAO_ADDRESS)
  const [newContract,  setNewContract]  = useState('')
  const [fromBlock,    setFromBlock]    = useState(String(DEPLOY_BLOCK_HINT))
  const [phase,        setPhase]        = useState('idle') // idle|fetching|verifying|done|error
  const [fetchPct,     setFetchPct]     = useState(0)
  const [verifyPct,    setVerifyPct]    = useState(0)
  const [results,      setResults]      = useState([])   // [{address, mismatches}]
  const [expanded,     setExpanded]     = useState({})

  const handleVerify = async () => {
    if (!isAddress(oldContract) || !isAddress(newContract)) return
    setPhase('fetching')
    setFetchPct(0)
    setVerifyPct(0)
    setResults([])

    try {
      const { registrationOrder, affiliateParentMap } = await fetchAllUsers(
        publicClient, oldContract, BigInt(fromBlock || '0'),
        (pct) => setFetchPct(pct)
      )
      const root = findRoot(registrationOrder, affiliateParentMap)
      const list = root ? [root, ...registrationOrder] : [...registrationOrder]

      setPhase('verifying')
      const out = []
      for (let i = 0; i < list.length; i++) {
        const addr = list[i]
        const [oldData, newData] = await Promise.all([
          fetchUserData(publicClient, oldContract, addr),
          fetchUserData(publicClient, newContract, addr),
        ])
        const mismatches = compareUserData(oldData, newData)
        out.push({ address: addr, mismatches })
        setVerifyPct(((i + 1) / list.length) * 100)
        setResults([...out])
      }
      setPhase('done')
    } catch (err) {
      console.error('Verify error', err)
      setPhase('error')
    }
  }

  const matched    = results.filter((r) => r.mismatches.length === 0).length
  const mismatched = results.filter((r) => r.mismatches.length > 0).length

  return (
    <div className="space-y-5">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} className="text-brand-gold" />
          <h3 className="font-semibold text-white text-sm">Verification Config</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Old Contract</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={oldContract} onChange={(e) => setOldContract(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">New Contract</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={newContract} onChange={(e) => setNewContract(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">From Block</label>
            <input type="number" className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={fromBlock} onChange={(e) => setFromBlock(e.target.value)} />
          </div>
        </div>
        <button
          onClick={handleVerify}
          disabled={phase === 'fetching' || phase === 'verifying' || !isAddress(oldContract) || !isAddress(newContract)}
          className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {(phase === 'fetching' || phase === 'verifying')
            ? <><Loader2 size={15} className="animate-spin" />Verifying…</>
            : <><ShieldCheck size={15} />Verify All Accounts</>
          }
        </button>
      </div>

      {phase === 'fetching' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
          <div className="text-xs text-brand-muted flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-brand-gold" />
            Fetching user list from logs…
          </div>
          <ProgressBar pct={fetchPct} />
        </div>
      )}

      {phase === 'verifying' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
          <div className="text-xs text-brand-muted flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-brand-gold" />
            Comparing user data ({results.length} checked)…
          </div>
          <ProgressBar pct={verifyPct} />
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Verified" value={results.length} color="gold"  icon={Users} />
            <StatCard label="Matched"         value={matched}         color="green" icon={CheckCircle2} />
            <StatCard label="Mismatched"      value={mismatched}      color="red"   icon={XCircle} />
          </div>

          {/* Per-user results */}
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-border">
              <span className="text-sm font-semibold text-white">Verification Results</span>
            </div>
            <div className="overflow-y-auto max-h-[32rem] divide-y divide-brand-border/50">
              {results.map((r) => {
                const ok = r.mismatches.length === 0
                const isOpen = expanded[r.address]
                return (
                  <div key={r.address}>
                    <button
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-brand-surface/50 transition-colors text-left"
                      onClick={() => setExpanded((prev) => ({ ...prev, [r.address]: !prev[r.address] }))}
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown size={13} className="text-brand-muted" /> : <ChevronRight size={13} className="text-brand-muted" />}
                        <span className="font-mono text-xs text-white">{shortAddr(r.address)}</span>
                      </div>
                      {ok
                        ? <span className="text-xs font-semibold text-brand-green flex items-center gap-1"><CheckCircle2 size={12} />MATCH</span>
                        : <span className="text-xs font-semibold text-brand-red flex items-center gap-1"><XCircle size={12} />MISMATCH ({r.mismatches.length})</span>
                      }
                    </button>
                    {isOpen && !ok && (
                      <div className="px-5 pb-4">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="text-brand-muted">
                              <th className="text-left py-1.5 pr-4 font-medium">Field</th>
                              <th className="text-left py-1.5 pr-4 font-medium">Old</th>
                              <th className="text-left py-1.5 font-medium">New</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.mismatches.map((m) => (
                              <tr key={m.path} className="border-t border-brand-border/50">
                                <td className="py-1.5 pr-4 font-mono text-brand-gold">{m.path}</td>
                                <td className="py-1.5 pr-4 font-mono text-brand-red truncate max-w-[120px]">{m.old}</td>
                                <td className="py-1.5 font-mono text-brand-green truncate max-w-[120px]">{m.new}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {phase === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-sm">
          <XCircle size={15} />
          Verification failed. Check console for details.
        </div>
      )}
    </div>
  )
}

// ── Debug Tab ─────────────────────────────────────────────────────────────────
function DebugTab({ publicClient }) {
  const [oldContract, setOldContract] = useState(FBMXDAO_ADDRESS)
  const [newContract, setNewContract] = useState('')
  const [inputAddr,   setInputAddr]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [oldSnap,     setOldSnap]     = useState(null)
  const [newSnap,     setNewSnap]     = useState(null)

  const handleLoad = async () => {
    if (!isAddress(inputAddr) || !isAddress(oldContract)) return
    setLoading(true)
    setError(null)
    setOldSnap(null)
    setNewSnap(null)
    try {
      const promises = [fetchUserData(publicClient, oldContract, inputAddr)]
      if (isAddress(newContract)) promises.push(fetchUserData(publicClient, newContract, inputAddr))
      const results = await Promise.all(promises)
      setOldSnap(formatSnapshot(results[0]))
      if (results[1]) setNewSnap(formatSnapshot(results[1]))
    } catch (err) {
      setError(err.shortMessage || err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const fields = oldSnap ? Object.keys(oldSnap) : []

  return (
    <div className="space-y-5">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Search size={16} className="text-brand-gold" />
          <h3 className="font-semibold text-white text-sm">Debug User Data</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Old Contract</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={oldContract} onChange={(e) => setOldContract(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">New Contract (optional)</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={newContract} onChange={(e) => setNewContract(e.target.value)} placeholder="0x..." />
          </div>
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
            value={inputAddr}
            onChange={(e) => setInputAddr(e.target.value)}
            placeholder="User address 0x..."
          />
          <button
            onClick={handleLoad}
            disabled={loading || !isAddress(inputAddr) || !isAddress(oldContract)}
            className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Load
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs">
            <XCircle size={12} />{error}
          </div>
        )}
      </div>

      {oldSnap && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border grid grid-cols-3 gap-4">
            <span className="text-xs font-semibold text-brand-muted col-span-1">Field</span>
            <span className="text-xs font-semibold text-brand-gold">Old Contract</span>
            {newSnap && <span className="text-xs font-semibold text-brand-green">New Contract</span>}
          </div>
          <div className="divide-y divide-brand-border/50 overflow-y-auto max-h-[36rem]">
            {fields.map((field) => {
              const mismatch = newSnap && oldSnap[field] !== newSnap[field]
              return (
                <div key={field} className={`grid gap-4 px-5 py-2.5 ${newSnap ? 'grid-cols-3' : 'grid-cols-2'} ${mismatch ? 'bg-brand-red/5' : ''}`}>
                  <span className="text-xs font-mono text-brand-muted">{field}</span>
                  <span className={`text-xs font-mono truncate ${mismatch ? 'text-brand-red' : 'text-white'}`}>{oldSnap[field]}</span>
                  {newSnap && (
                    <span className={`text-xs font-mono truncate ${mismatch ? 'text-brand-green font-semibold' : 'text-white'}`}>
                      {newSnap[field]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Queue Tab (kept for legacy ref — no longer linked in tabs) ────────────────
function QueueTab({ failedOps, setFailedOps, publicClient, config, rootUser }) {
  const { writeContractAsync } = useWriteContract()
  const [retrying, setRetrying] = useState({})

  const handleRetry = async (op) => {
    if (!isAddress(config.newContract) || !isAddress(config.oldContract)) return
    setRetrying((prev) => ({ ...prev, [op.address]: true }))
    try {
      const oldData = await fetchUserData(publicClient, config.oldContract, op.address)
      const isRoot  = op.address.toLowerCase() === rootUser?.toLowerCase()
      const affParent = isRoot ? ZERO : oldData.affiliate.parent
      const binParent = isRoot ? ZERO : oldData.binary.parent

      const tx1 = await writeContractAsync({
        address: config.newContract, abi: ADMIN_ABI, functionName: 'updateAffiliateData',
        args: [op.address, affParent, oldData.affiliate.agent, oldData.affiliate.totalDirect, oldData.affiliate.level, oldData.isUser, oldData.affiliate.level > 0 || oldData.isUser],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx1 })

      const tx2 = await writeContractAsync({
        address: config.newContract, abi: ADMIN_ABI, functionName: 'updateBinaryData',
        args: [op.address, binParent, oldData.binary.leftAddress, oldData.binary.rightAddress, oldData.binary.leftVolume, oldData.binary.rightVolume, oldData.binary.coolDown],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx2 })

      const tx3 = await writeContractAsync({
        address: config.newContract, abi: ADMIN_ABI, functionName: 'updateWalletData',
        args: [op.address, oldData.wallet.balance, oldData.wallet.capping, oldData.wallet.totalIncome, oldData.wallet.coolDown, oldData.tokenBalance],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx3 })

      const tx4 = await writeContractAsync({
        address: config.newContract, abi: ADMIN_ABI, functionName: 'updatePassiveData',
        args: [op.address, oldData.passive.totalPassive, oldData.passive.totalEquity, oldData.passive.coolDown],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx4 })

      saveDone(op.address)
      setFailedOps((prev) => prev.filter((f) => f.address !== op.address))
    } catch (err) {
      setFailedOps((prev) => prev.map((f) =>
        f.address === op.address
          ? { ...f, error: err.shortMessage || err.message || String(err) }
          : f
      ))
    } finally {
      setRetrying((prev) => { const n = { ...prev }; delete n[op.address]; return n })
    }
  }

  if (failedOps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center mb-4">
          <CheckCircle2 size={28} className="text-brand-green" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">No Failed Operations</h3>
        <p className="text-sm text-brand-muted">All migrations completed successfully.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle size={15} className="text-brand-red" />
          <span className="text-sm font-semibold text-white">{failedOps.length} Failed Operation{failedOps.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setFailedOps([])}
          className="text-xs text-brand-muted hover:text-brand-red transition-colors flex items-center gap-1"
        >
          <XCircle size={12} />
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {failedOps.map((op) => (
          <div key={op.address} className="bg-brand-card border border-brand-red/20 rounded-2xl p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-sm text-white mb-1">{shortAddr(op.address)}</div>
              <div className="text-xs text-brand-red/80 break-all leading-relaxed">{op.error}</div>
            </div>
            <button
              onClick={() => handleRetry(op)}
              disabled={!!retrying[op.address]}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs font-semibold hover:bg-brand-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying[op.address]
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />
              }
              Retry
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'migration', label: 'Migration', icon: Database },
  { id: 'verify',    label: 'Verify',    icon: ShieldCheck },
  { id: 'debug',     label: 'Debug',     icon: Search },
]

export default function Admin() {
  const { address, isConnected, chain } = useAccount()
  const publicClient = usePublicClient()
  const [activeTab, setActiveTab] = useState('migration')

  const wrongNetwork = isConnected && chain?.id !== BSC_CHAIN_ID

  if (!isConnected) return (
    <div className="pt-16">
      <ConnectPrompt />
    </div>
  )

  return (
    <div className="pt-16 min-h-screen">
      {wrongNetwork && <WrongNetworkBanner />}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-brand-gold" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">Admin Migration</h1>
            <p className="text-xs text-brand-muted">FBMXDAO contract migration and verification tools</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-brand-surface border border-brand-border rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'migration' && <MigrationTab publicClient={publicClient} address={address} />}
        {activeTab === 'verify'    && <VerifyTab    publicClient={publicClient} />}
        {activeTab === 'debug'     && <DebugTab     publicClient={publicClient} />}
      </div>
    </div>
  )
}

// ─── MigrationTabWithShared removed — MigrationTab is now self-contained ─────
function _unusedMigrationTabWithShared({ publicClient, address, failedOps, setFailedOps, rootUser, setRootUser, migConfig, setMigConfig }) {
  const { writeContractAsync } = useWriteContract()

  const [ownerAddress, setOwnerAddress]   = useState(null)
  const [ownerLoading, setOwnerLoading]   = useState(false)
  const [ownerError, setOwnerError]       = useState(null)
  const [migrationList, setMigrationList] = useState([])
  const [userStatus, setUserStatus]       = useState({})
  const [phase, setPhase]                 = useState('idle')
  const [fetchPct, setFetchPct]           = useState(0)
  const [fetchCount, setFetchCount]       = useState(0)
  const [currentUser, setCurrentUser]     = useState(null)
  const abortRef = useRef(false)

  const config = migConfig
  const setConfig = setMigConfig

  // Restore done statuses when list changes
  useEffect(() => {
    if (migrationList.length === 0) return
    const doneSet = loadDoneSet()
    if (doneSet.size === 0) return
    setUserStatus((prev) => {
      const next = { ...prev }
      for (const addr of migrationList) {
        if (doneSet.has(addr.toLowerCase()) && next[addr] !== 'done') next[addr] = 'done'
      }
      return next
    })
  }, [migrationList])

  // Owner check
  useEffect(() => {
    if (!isAddress(config.newContract)) { setOwnerAddress(null); setOwnerError(null); return }
    let cancelled = false
    setOwnerLoading(true)
    setOwnerError(null)
    publicClient.readContract({ address: config.newContract, abi: ADMIN_ABI, functionName: 'owner' })
      .then((o) => { if (!cancelled) { setOwnerAddress(o); setOwnerLoading(false) } })
      .catch((e) => { if (!cancelled) { setOwnerError(e.shortMessage || e.message); setOwnerLoading(false) } })
    return () => { cancelled = true }
  }, [config.newContract, publicClient])

  const handleFetchUsers = useCallback(async () => {
    if (!isAddress(config.oldContract)) return
    setPhase('fetching'); setFetchPct(0); setFetchCount(0)
    try {
      const fromBlock = BigInt(config.fromBlock || '0')
      const { registrationOrder, affiliateParentMap } = await fetchAllUsers(
        publicClient, config.oldContract, fromBlock,
        (pct, count) => { setFetchPct(pct); setFetchCount(count) }
      )
      const root = findRoot(registrationOrder, affiliateParentMap)
      setRootUser(root)
      const list = root ? [root, ...registrationOrder] : [...registrationOrder]
      setMigrationList(list)
      const doneSet = loadDoneSet()
      const statuses = {}
      for (const addr of list) statuses[addr] = doneSet.has(addr.toLowerCase()) ? 'done' : 'pending'
      setUserStatus(statuses)
      setPhase('ready')
    } catch (err) {
      console.error('fetchAllUsers error', err)
      setPhase('error')
    }
  }, [config.oldContract, config.fromBlock, publicClient, setRootUser])

  const runMigrationLoop = useCallback(async () => {
    if (!isAddress(config.newContract)) return
    abortRef.current = false
    setPhase('running')
    const batchSize = parseInt(config.batchSize, 10) || 5
    let batchCount = 0

    for (let i = 0; i < migrationList.length; i++) {
      if (abortRef.current) { setPhase('paused'); setCurrentUser(null); return }

      const addr = migrationList[i]
      if (loadDoneSet().has(addr.toLowerCase())) {
        setUserStatus((prev) => ({ ...prev, [addr]: 'done' }))
        continue
      }

      setCurrentUser(addr)
      setUserStatus((prev) => ({ ...prev, [addr]: 'running' }))

      try {
        const oldData = await fetchUserData(publicClient, config.oldContract, addr)
        const isRoot  = addr.toLowerCase() === rootUser?.toLowerCase()
        const affParent = isRoot ? ZERO : oldData.affiliate.parent
        const binParent = isRoot ? ZERO : oldData.binary.parent

        const tx1 = await writeContractAsync({
          address: config.newContract, abi: ADMIN_ABI, functionName: 'updateAffiliateData',
          args: [addr, affParent, oldData.affiliate.agent, oldData.affiliate.totalDirect, oldData.affiliate.level, oldData.isUser, oldData.affiliate.level > 0 || oldData.isUser],
        })
        await publicClient.waitForTransactionReceipt({ hash: tx1 })
        if (abortRef.current) { setPhase('paused'); setCurrentUser(null); return }

        const tx2 = await writeContractAsync({
          address: config.newContract, abi: ADMIN_ABI, functionName: 'updateBinaryData',
          args: [addr, binParent, oldData.binary.leftAddress, oldData.binary.rightAddress, oldData.binary.leftVolume, oldData.binary.rightVolume, oldData.binary.coolDown],
        })
        await publicClient.waitForTransactionReceipt({ hash: tx2 })
        if (abortRef.current) { setPhase('paused'); setCurrentUser(null); return }

        const tx3 = await writeContractAsync({
          address: config.newContract, abi: ADMIN_ABI, functionName: 'updateWalletData',
          args: [addr, oldData.wallet.balance, oldData.wallet.capping, oldData.wallet.totalIncome, oldData.wallet.coolDown, oldData.tokenBalance],
        })
        await publicClient.waitForTransactionReceipt({ hash: tx3 })
        if (abortRef.current) { setPhase('paused'); setCurrentUser(null); return }

        const tx4 = await writeContractAsync({
          address: config.newContract, abi: ADMIN_ABI, functionName: 'updatePassiveData',
          args: [addr, oldData.passive.totalPassive, oldData.passive.totalEquity, oldData.passive.coolDown],
        })
        await publicClient.waitForTransactionReceipt({ hash: tx4 })

        setUserStatus((prev) => ({ ...prev, [addr]: 'done' }))
        saveDone(addr)
        batchCount++

        if (batchCount >= batchSize) { batchCount = 0; setPhase('paused'); setCurrentUser(null); return }
      } catch (err) {
        console.error(`Migration error ${addr}:`, err)
        setUserStatus((prev) => ({ ...prev, [addr]: 'error' }))
        setFailedOps((prev) => [...prev.filter((f) => f.address !== addr), { address: addr, error: err.shortMessage || err.message || String(err) }])
      }
    }

    setCurrentUser(null)
    setPhase('done')
  }, [migrationList, config, publicClient, rootUser, writeContractAsync, setFailedOps])

  const handlePause = () => { abortRef.current = true }
  const handleReset = () => {
    clearDone(); setMigrationList([]); setUserStatus({}); setFailedOps([])
    setPhase('idle'); setFetchPct(0); setFetchCount(0); setCurrentUser(null); setRootUser(null)
  }

  const doneCount   = Object.values(userStatus).filter((s) => s === 'done').length
  const errorCount  = Object.values(userStatus).filter((s) => s === 'error').length
  const totalCount  = migrationList.length
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0
  const isOwner = ownerAddress && address && ownerAddress.toLowerCase() === address.toLowerCase()

  return (
    <div className="space-y-5">
      {/* Config Panel */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Database size={16} className="text-brand-gold" />
          <h3 className="font-semibold text-white text-sm">Migration Config</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Old Contract Address</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.oldContract} onChange={(e) => setConfig((c) => ({ ...c, oldContract: e.target.value }))} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">New Contract Address</label>
            <input className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.newContract} onChange={(e) => setConfig((c) => ({ ...c, newContract: e.target.value }))} placeholder="0x..." />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Deploy Block Hint</label>
            <input type="number" className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.fromBlock} onChange={(e) => setConfig((c) => ({ ...c, fromBlock: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-brand-muted mb-1.5 block">Batch Size (auto-pause checkpoint)</label>
            <select className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-gold/50 transition-colors"
              value={config.batchSize} onChange={(e) => setConfig((c) => ({ ...c, batchSize: e.target.value }))}>
              {['1', '3', '5', '10'].map((v) => <option key={v} value={v}>{v} users</option>)}
            </select>
          </div>
        </div>

        {/* Ownership check */}
        {isAddress(config.newContract) && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            ownerLoading ? 'bg-brand-surface text-brand-muted' :
            ownerError   ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' :
            isOwner      ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' :
                           'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {ownerLoading ? <Loader2 size={12} className="animate-spin" /> :
             ownerError   ? <XCircle size={12} /> :
             isOwner      ? <CheckCircle2 size={12} /> :
                            <AlertTriangle size={12} />}
            {ownerLoading ? 'Checking ownership…' :
             ownerError   ? `Owner check failed: ${ownerError}` :
             isOwner      ? `You are the owner (${shortAddr(ownerAddress)})` :
                            `Owner is ${shortAddr(ownerAddress)} — you are NOT the owner`}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Users"  value={totalCount}                    color="gold"  icon={Users} />
        <StatCard label="Migrated"     value={doneCount}                     color="green" icon={CheckCircle2} />
        <StatCard label="Failed"       value={errorCount}                    color="red"   icon={XCircle} />
        <StatCard label="Progress"     value={`${progressPct.toFixed(1)}%`} color="blue"  icon={BarChart3} />
      </div>

      {/* Fetch progress bar */}
      {phase === 'fetching' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-brand-muted">
            <Loader2 size={14} className="animate-spin text-brand-gold" />
            Scanning blockchain logs…
          </div>
          <ProgressBar pct={fetchPct} label={`${fetchCount} users found so far`} />
        </div>
      )}

      {/* Overall progress */}
      {['running', 'paused', 'done'].includes(phase) && totalCount > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <ProgressBar pct={progressPct} label={`${doneCount} / ${totalCount} users migrated`} />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3">
        {(phase === 'idle' || phase === 'error') && (
          <button onClick={handleFetchUsers} disabled={!isAddress(config.oldContract)}
            className="btn-gold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Search size={15} />Fetch Users
          </button>
        )}
        {phase === 'ready' && (
          <button onClick={handleFetchUsers}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-surface border border-brand-border text-brand-muted hover:text-white hover:border-brand-gold/30 transition-all">
            <RefreshCw size={15} />Re-fetch
          </button>
        )}
        {(phase === 'ready' || phase === 'paused') && (
          <button onClick={runMigrationLoop} disabled={!isAddress(config.newContract) || totalCount === 0}
            className="btn-gold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Play size={15} />{phase === 'paused' ? 'Resume' : 'Start Migration'}
          </button>
        )}
        {phase === 'running' && (
          <button onClick={handlePause}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all">
            <Pause size={15} />Pause
          </button>
        )}
        {(phase === 'done' || phase === 'paused') && (
          <button onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-brand-red/10 border border-brand-red/30 text-brand-red hover:bg-brand-red/20 transition-all">
            <RotateCcw size={15} />Reset
          </button>
        )}
      </div>

      {phase === 'done' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-green/10 border border-brand-green/20 text-brand-green text-sm">
          <CheckCircle2 size={16} />Migration complete. All users processed.
        </div>
      )}

      {/* User List */}
      {migrationList.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-brand-gold" />
              <span className="text-sm font-semibold text-white">User Queue</span>
            </div>
            <span className="text-xs text-brand-muted">{migrationList.length} total</span>
          </div>
          <div className="overflow-y-auto max-h-96 divide-y divide-brand-border/50">
            {migrationList.map((addr, i) => {
              const isRoot    = addr.toLowerCase() === rootUser?.toLowerCase()
              const isCurrent = addr === currentUser
              const status    = userStatus[addr] || 'pending'
              return (
                <div key={addr} className={`flex items-center justify-between px-5 py-2.5 transition-all ${
                  isCurrent ? 'bg-brand-gold/5 ring-1 ring-inset ring-brand-gold/20' : 'hover:bg-brand-surface/50'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-brand-muted w-7 text-right flex-shrink-0">#{i}</span>
                    <span className="font-mono text-xs text-white truncate">{shortAddr(addr)}</span>
                    {isRoot && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-gold/20 text-brand-gold border border-brand-gold/30 flex-shrink-0">ROOT</span>
                    )}
                    {isCurrent && <Loader2 size={11} className="animate-spin text-brand-gold flex-shrink-0" />}
                  </div>
                  <StatusBadge status={status} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
