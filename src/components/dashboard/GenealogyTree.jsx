import { useState, useEffect, useRef, useCallback } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, isAddress } from 'viem'
import {
  GitBranch, Users, ChevronDown, ChevronRight, ChevronUp,
  Loader2, ExternalLink, Search, ArrowLeft, Home, AlertCircle,
  Navigation, X, CheckCircle2,
} from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI } from '../../config/contracts'

// ─── Constants ────────────────────────────────────────────────────────────────
const ZERO = '0x0000000000000000000000000000000000000000'
const MAX_ANCESTOR_DEPTH = 16 // contract max rank is 14

const RANK_COLORS = [
  '#6B7280', '#CD7F32', '#C0C0C0', '#F5A623', '#E5E4E2', '#00D4AA',
  '#3B82F6', '#A855F7', '#EC4899', '#F97316', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F59E0B', '#F5A623', '#FFD700',
]
const RANK_LABELS = [
  'Registered', 'Initiate', 'Scout', 'Pioneer', 'Challenger', 'Builder',
  'Trailblazer', 'Guardian', 'Commander', 'Vanguard', 'Warlord',
  'Sovereign', 'Archon', 'Titan', 'Fortress', 'Emperor',
]

// ─── Utilities ────────────────────────────────────────────────────────────────
function shortAddr(addr) {
  if (!addr || addr.toLowerCase() === ZERO) return 'Empty'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
function isZero(addr) {
  return !addr || addr.toLowerCase() === ZERO
}
function fmtUsd(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

// ─── Binary tree node ─────────────────────────────────────────────────────────
function BinaryNode({ address: addr, depth, maxDepth, selfAddr, onNavigate }) {
  const [expanded, setExpanded] = useState(depth < 2)

  const enabled = !!addr && !isZero(addr)
  const { data: binaryRaw, isLoading: bl } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'binaries',
    args: [addr], query: { enabled, staleTime: 30000 },
  })
  const { data: affiliateRaw, isLoading: al } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'affiliates',
    args: [addr], query: { enabled, staleTime: 30000 },
  })
  const { data: walletRaw, isLoading: wl } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'wallets',
    args: [addr], query: { enabled, staleTime: 30000 },
  })

  const isLoading = enabled && (bl || al || wl)
  const level = affiliateRaw ? Number(affiliateRaw[3]) : 0
  const leftAddr = binaryRaw?.[1]
  const rightAddr = binaryRaw?.[2]
  const leftVol = binaryRaw ? Number(formatUnits(binaryRaw[3] ?? 0n, 18)) : 0
  const rightVol = binaryRaw ? Number(formatUnits(binaryRaw[4] ?? 0n, 18)) : 0
  const totalIncome = walletRaw ? Number(formatUnits(walletRaw[2] ?? 0n, 18)) : 0
  const isSelf = addr?.toLowerCase() === selfAddr?.toLowerCase()
  const hasLeft = !isZero(leftAddr)
  const hasRight = !isZero(rightAddr)
  const hasChildren = hasLeft || hasRight
  const canExpand = hasChildren && depth < maxDepth

  // ── Open slot ──
  if (isZero(addr)) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-36 h-[130px] rounded-xl border-2 border-dashed border-brand-border/30 bg-brand-dark/20 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-brand-border/30 flex items-center justify-center">
            <span className="text-brand-border/40 text-sm font-bold">+</span>
          </div>
          <span className="text-brand-border/40 text-[10px] font-medium tracking-wide">Open Slot</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">

      {/* ── Node card ── */}
      <div
        onClick={() => depth < maxDepth && setExpanded(v => !v)}
        className={`relative w-36 rounded-xl border transition-all
          ${depth < maxDepth ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default'}
          ${isSelf
            ? 'border-brand-gold bg-gradient-to-b from-brand-gold/15 to-transparent shadow-[0_0_20px_rgba(245,166,35,0.18)]'
            : 'border-brand-border bg-brand-card hover:border-brand-gold/30'
          }`}
      >
        {/* YOU badge */}
        {isSelf && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gold text-brand-dark text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap z-10 shadow">
            ★ YOU
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 rounded-xl bg-brand-card/80 flex items-center justify-center z-10 backdrop-blur-[1px]">
            <Loader2 size={16} className="animate-spin text-brand-muted" />
          </div>
        )}

        <div className="p-3 space-y-2">
          {/* Rank badge + address */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/10 shadow-sm"
              style={{ background: RANK_COLORS[level] ?? '#6B7280' }}
              title={RANK_LABELS[level]}
            >
              {level}
            </div>
            <span className="font-mono text-[10px] text-brand-muted truncate">{shortAddr(addr)}</span>
          </div>

          {/* Rank label */}
          <div className="text-[11px] font-semibold text-white truncate leading-tight">
            {RANK_LABELS[level] ?? 'Member'}
          </div>

          {/* Total income */}
          <div className="text-[11px] font-mono font-bold text-brand-gold">
            {fmtUsd(totalIncome)}
            <span className="text-[9px] font-normal text-brand-muted ml-1">earned</span>
          </div>

          {/* L / R volume pills */}
          <div className="flex gap-1">
            <div className={`flex-1 rounded-md px-1 py-1 text-center border ${hasLeft ? 'bg-blue-500/10 border-blue-500/20' : 'bg-brand-surface border-brand-border/40'}`}>
              <div className="text-[8px] font-medium text-brand-muted">L</div>
              <div className={`text-[9px] font-mono font-bold ${hasLeft ? 'text-blue-400' : 'text-brand-border/60'}`}>
                {fmtUsd(leftVol)}
              </div>
            </div>
            <div className={`flex-1 rounded-md px-1 py-1 text-center border ${hasRight ? 'bg-purple-500/10 border-purple-500/20' : 'bg-brand-surface border-brand-border/40'}`}>
              <div className="text-[8px] font-medium text-brand-muted">R</div>
              <div className={`text-[9px] font-mono font-bold ${hasRight ? 'text-purple-400' : 'text-brand-border/60'}`}>
                {fmtUsd(rightVol)}
              </div>
            </div>
          </div>

          {/* Explore button */}
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(addr) }}
            className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-brand-surface hover:bg-brand-gold/10 hover:text-brand-gold text-brand-muted text-[10px] font-medium transition-all border border-brand-border/50 hover:border-brand-gold/30"
          >
            <Navigation size={9} /> Explore
          </button>
        </div>

        {/* Expand / collapse chip */}
        {canExpand && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-brand-card border border-brand-border flex items-center justify-center shadow z-10">
            {expanded
              ? <ChevronUp size={12} className="text-brand-muted" />
              : <ChevronDown size={12} className="text-brand-muted" />}
          </div>
        )}
        {/* +more chip when at max depth */}
        {!canExpand && hasChildren && depth >= maxDepth && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-brand-card border border-brand-border text-[9px] text-brand-muted whitespace-nowrap z-10 shadow">
            +more
          </div>
        )}
      </div>

      {/* ── Children subtree ── */}
      {expanded && depth < maxDepth && hasChildren && (
        <div className="relative mt-7">
          {/* Horizontal connector */}
          <div className="absolute top-0 left-[22%] right-[22%] h-px bg-brand-border/50 -translate-y-[14px]" />
          <div className="flex gap-6 sm:gap-10">
            {[leftAddr ?? ZERO, rightAddr ?? ZERO].map((childAddr, idx) => (
              <div key={idx} className="flex flex-col items-center">
                {/* Vertical stem */}
                <div className="h-3.5 w-px bg-brand-border/50" />
                {/* Side label */}
                <div className={`text-[9px] font-bold mb-2 px-2 py-0.5 rounded-full border ${idx === 0
                  ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                  : 'text-purple-400 border-purple-500/20 bg-purple-500/5'
                  }`}>
                  {idx === 0 ? '← L' : 'R →'}
                </div>
                <BinaryNode
                  address={childAddr}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  selfAddr={selfAddr}
                  onNavigate={onNavigate}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Affiliate tree node ──────────────────────────────────────────────────────
function AffiliateNode({ address: addr, depth, maxDepth, selfAddr, onNavigate }) {
  const [expanded, setExpanded] = useState(depth === 0)

  const enabled = !!addr && !isZero(addr)
  const { data: affiliateRaw } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'affiliates',
    args: [addr], query: { enabled, staleTime: 30000 },
  })
  const { data: children, isLoading: cl } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'getChildren',
    args: [addr, 0n, 50n],
    query: { enabled: enabled && expanded, staleTime: 30000 },
  })
  const { data: walletRaw } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'wallets',
    args: [addr], query: { enabled, staleTime: 30000 },
  })

  const level = affiliateRaw ? Number(affiliateRaw[3]) : 0
  const totalIncome = walletRaw ? Number(formatUnits(walletRaw[2] ?? 0n, 18)) : 0
  const isSelf = addr?.toLowerCase() === selfAddr?.toLowerCase()
  const childList = children ?? []
  const hasKids = childList.length > 0
  const canGoDeeper = depth < maxDepth

  return (
    <div className={depth === 0 ? '' : 'ml-5 border-l border-brand-border/40 pl-3 mt-0.5'}>
      {/* ── Node row ── */}
      <div
        className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer group
          ${isSelf
            ? 'bg-brand-gold/10 border border-brand-gold/20'
            : 'hover:bg-brand-surface/80 border border-transparent'
          }`}
        onClick={() => canGoDeeper && setExpanded(v => !v)}
      >
        {/* Rank badge */}
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/10"
          style={{ background: RANK_COLORS[level] ?? '#6B7280' }}
          title={RANK_LABELS[level]}
        >
          {level}
        </div>

        {/* Address */}
        <span className={`font-mono text-xs flex-shrink-0 ${isSelf ? 'text-brand-gold font-semibold' : 'text-white'}`}>
          {shortAddr(addr)}
        </span>

        {/* Rank label — hidden on mobile */}
        <span className="text-[10px] text-brand-muted hidden sm:block flex-shrink-0">
          {RANK_LABELS[level]}
        </span>

        {/* Income */}
        <span className="ml-auto font-mono text-[10px] text-brand-gold flex-shrink-0">
          {fmtUsd(totalIncome)}
        </span>

        {/* Hover actions */}
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(addr) }}
          title="Set as tree root"
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-gold/10 text-brand-gold text-[9px] font-medium transition-all hover:bg-brand-gold/20 flex-shrink-0"
        >
          <Navigation size={9} />
        </button>
        <a
          href={`https://bscscan.com/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-white transition-all flex-shrink-0"
        >
          <ExternalLink size={10} />
        </a>

        {/* Expand indicator */}
        {canGoDeeper && (
          <div className="w-4 flex-shrink-0 flex items-center justify-center">
            {cl
              ? <Loader2 size={10} className="animate-spin text-brand-muted" />
              : expanded
                ? <ChevronDown size={12} className="text-brand-muted" />
                : <ChevronRight size={12} className="text-brand-muted" />
            }
          </div>
        )}
      </div>

      {/* ── Children ── */}
      {expanded && canGoDeeper && (
        <div>
          {cl && !hasKids && (
            <div className="ml-7 py-1.5 text-brand-muted text-[10px] flex items-center gap-1.5">
              <Loader2 size={9} className="animate-spin" /> Loading…
            </div>
          )}
          {childList.map((childAddr) => (
            <AffiliateNode
              key={childAddr}
              address={childAddr}
              depth={depth + 1}
              maxDepth={maxDepth}
              selfAddr={selfAddr}
              onNavigate={onNavigate}
            />
          ))}
          {!cl && childList.length === 0 && (
            <div className="ml-7 py-1.5 text-brand-muted text-[10px] italic">No direct referrals</div>
          )}
          {!cl && depth + 1 >= maxDepth && hasKids && (
            <div className="ml-7 py-1 text-brand-muted text-[10px]">↑ Increase depth to see more</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GenealogyTree({ address: walletAddress }) {
  const publicClient = usePublicClient()

  const [activeTab, setActiveTab] = useState('binary')
  const [history, setHistory] = useState(() => walletAddress ? [walletAddress] : [])
  const [depth, setDepth] = useState(3)
  const [searchInput, setSearchInput] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searchOk, setSearchOk] = useState(false)
  const [validating, setValidating] = useState(false)

  // Reset tree when wallet address changes
  const prevWallet = useRef(walletAddress)
  useEffect(() => {
    if (walletAddress !== prevWallet.current) {
      prevWallet.current = walletAddress
      setHistory(walletAddress ? [walletAddress] : [])
    }
  }, [walletAddress])

  const currentRoot = history[history.length - 1] ?? walletAddress
  const isAtHome = currentRoot?.toLowerCase() === walletAddress?.toLowerCase()

  // Navigate to a node (push to history stack)
  const navigate = useCallback((addr) => {
    if (!addr || isZero(addr)) return
    if (addr.toLowerCase() === currentRoot?.toLowerCase()) return
    setHistory(prev => [...prev, addr])
  }, [currentRoot])

  const goBack = () => setHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  const goHome = () => setHistory(walletAddress ? [walletAddress] : [])

  // ── Search: validate address is in connected wallet's downline ──
  const handleSearch = async () => {
    const raw = searchInput.trim()
    if (!raw) return

    if (!isAddress(raw)) {
      setSearchError('Invalid address format')
      setSearchOk(false)
      return
    }

    // Searching for own address → just go home
    if (raw.toLowerCase() === walletAddress?.toLowerCase()) {
      goHome()
      setSearchInput('')
      setSearchError('')
      setSearchOk(false)
      return
    }

    setValidating(true)
    setSearchError('')
    setSearchOk(false)

    // Traverse parent chain upward from raw until we find walletAddress
    const funcName = activeTab === 'binary' ? 'binaries' : 'affiliates'
    let current = raw
    let found = false

    try {
      for (let i = 0; i < MAX_ANCESTOR_DEPTH; i++) {
        const data = await publicClient.readContract({
          address: FBMXDAO_ADDRESS,
          abi: FBMXDAO_ABI,
          functionName: funcName,
          args: [current],
        })
        const parent = data[0]
        if (isZero(parent)) break
        if (parent.toLowerCase() === walletAddress?.toLowerCase()) { found = true; break }
        current = parent
      }
    } catch {
      setSearchError('RPC error — could not validate address')
      setValidating(false)
      return
    }

    setValidating(false)

    if (found) {
      setSearchOk(true)
      navigate(raw)
      setSearchInput('')
      setTimeout(() => setSearchOk(false), 2000)
    } else {
      setSearchError('Address is not in your network')
    }
  }

  // ── Guard: not connected ──
  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center h-48 text-brand-muted text-sm">
        Connect wallet to view your genealogy
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Controls row ── */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-brand-surface rounded-xl border border-brand-border flex-shrink-0">
          {[
            { id: 'binary', label: 'Binary', icon: GitBranch },
            { id: 'affiliate', label: 'Affiliate', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id
                ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                : 'text-brand-muted hover:text-white'
                }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Depth selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-brand-muted">Depth:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${depth === d
                  ? 'bg-brand-gold text-brand-dark shadow'
                  : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-white'
                  }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Search box */}
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setSearchError(''); setSearchOk(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Find address in your network…"
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-brand-surface border border-brand-border text-white text-xs placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-gold/40 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchError(''); setSearchOk(false) }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-all"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={validating || !searchInput.trim()}
            className="px-3 py-2 rounded-xl bg-brand-surface hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold text-xs font-medium border border-brand-border hover:border-brand-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
          >
            {validating
              ? <><Loader2 size={12} className="animate-spin" /> Checking</>
              : searchOk
                ? <><CheckCircle2 size={12} className="text-brand-green" /> Found</>
                : <><Search size={12} /> Search</>
            }
          </button>
        </div>
      </div>

      {/* Search error banner */}
      {searchError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs">
          <AlertCircle size={12} className="flex-shrink-0" />
          {searchError}
        </div>
      )}

      {/* ── Navigation bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={goHome}
          disabled={isAtHome}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-brand-muted hover:text-white hover:border-brand-gold/30 text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Home size={11} /> Home
        </button>
        <button
          onClick={goBack}
          disabled={history.length <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-brand-muted hover:text-white hover:border-brand-gold/30 text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ArrowLeft size={11} /> Back
        </button>

        {/* Breadcrumb trail */}
        <div className="flex items-center gap-1">
          {history.map((addr, i) => (
            <span key={i} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && <ChevronRight size={9} className="text-brand-border" />}
              <button
                onClick={() => setHistory(history.slice(0, i + 1))}
                className={`font-mono text-[10px] px-2 py-0.5 rounded-md transition-all ${i === history.length - 1
                  ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                  : 'text-brand-muted hover:text-white hover:bg-brand-surface'
                  }`}
              >
                {addr?.toLowerCase() === walletAddress?.toLowerCase() ? 'You' : shortAddr(addr)}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── Binary tree ── */}
      {activeTab === 'binary' && (
        <div>
          <div className="overflow-x-auto pb-8">
            <div className="flex justify-center min-w-max px-8 pt-10">
              <BinaryNode
                address={currentRoot}
                depth={0}
                maxDepth={depth}
                selfAddr={walletAddress}
                onNavigate={navigate}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-4 border-t border-brand-border">
            <span className="text-[9px] font-semibold text-brand-muted uppercase tracking-wider self-center">Ranks:</span>
            <div className="flex items-center gap-1.5 text-[10px] text-brand-muted">
              <div className="w-3 h-3 rounded-full border-2 border-dashed border-brand-border/40" />
              Open Slot
            </div>
            {RANK_LABELS.slice(0, 9).map((name, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-brand-muted">
                <div className="w-3 h-3 rounded-full ring-1 ring-white/10" style={{ background: RANK_COLORS[i] }} />
                {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Affiliate tree ── */}
      {activeTab === 'affiliate' && (
        <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center px-3 py-2.5 border-b border-brand-border bg-brand-dark/20 text-[10px] font-semibold text-brand-muted uppercase tracking-wider">
            <span className="w-6 mr-2.5">Lv</span>
            <span>Address</span>
            <span className="hidden sm:block ml-10">Rank</span>
            <span className="ml-auto mr-14">Earned</span>
          </div>
          <div className="p-3 max-h-[560px] overflow-y-auto scrollbar-none">
            <AffiliateNode
              address={currentRoot}
              depth={0}
              maxDepth={depth}
              selfAddr={walletAddress}
              onNavigate={navigate}
            />
          </div>
        </div>
      )}

    </div>
  )
}
