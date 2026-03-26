import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { GitBranch, Users, ChevronDown, ChevronRight, Loader2, ExternalLink } from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI } from '../../config/contracts'
import { formatUnits } from 'viem'

const ZERO = '0x0000000000000000000000000000000000000000'

const RANK_COLORS = [
  '#6B7280','#CD7F32','#C0C0C0','#F5A623','#E5E4E2','#00D4AA',
  '#3B82F6','#A855F7','#EC4899','#F97316','#EF4444','#8B5CF6','#06B6D4','#F59E0B','#F5A623'
]
const RANK_LABELS = [
  'Registered','Initiate','Scout','Pioneer','Challenger','Builder',
  'Trailblazer','Guardian','Commander','Vanguard','Warlord','Sovereign','Archon','Titan','Fortress'
]

function shortAddr(addr) {
  if (!addr || addr === ZERO) return 'Empty'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
function isZero(addr) { return !addr || addr === ZERO }

// ── Single binary node ────────────────────────────────────────────────────────
function BinaryNode({ address: addr, depth = 0, maxDepth = 3, selfAddr }) {
  const [expanded, setExpanded] = useState(depth < 2)

  const { data: binaryRaw }   = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'binaries', args: [addr],
    query: { enabled: !!addr && !isZero(addr), staleTime: 30000 },
  })
  const { data: affiliateRaw } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'affiliates', args: [addr],
    query: { enabled: !!addr && !isZero(addr), staleTime: 30000 },
  })
  const { data: walletRaw }   = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'wallets', args: [addr],
    query: { enabled: !!addr && !isZero(addr), staleTime: 30000 },
  })

  const level       = affiliateRaw ? Number(affiliateRaw[3]) : 0
  const leftAddr    = binaryRaw?.[1]
  const rightAddr   = binaryRaw?.[2]
  const leftVol     = binaryRaw ? formatUnits(binaryRaw[3] ?? 0n, 18) : '0'
  const rightVol    = binaryRaw ? formatUnits(binaryRaw[4] ?? 0n, 18) : '0'
  const totalIncome = walletRaw ? formatUnits(walletRaw[2] ?? 0n, 18) : '0'
  const isSelf      = addr?.toLowerCase() === selfAddr?.toLowerCase()
  const hasKids     = (!isZero(leftAddr) || !isZero(rightAddr)) && depth < maxDepth

  if (isZero(addr)) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-28 h-16 rounded-xl border-2 border-dashed border-brand-border bg-brand-dark/50 flex items-center justify-center">
          <span className="text-brand-muted text-[10px]">Open Slot</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        onClick={() => hasKids && setExpanded(!expanded)}
        className={`relative w-32 rounded-xl border p-3 cursor-pointer transition-all hover:scale-105 ${
          isSelf ? 'border-brand-gold bg-brand-gold/10 shadow-gold' : 'border-brand-border bg-brand-card hover:border-brand-gold/30'
        }`}
      >
        {isSelf && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-gold text-brand-dark text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            YOU
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: RANK_COLORS[level] ?? '#64748B' }}>
            {level}
          </div>
          <span className="font-mono text-[10px] text-brand-muted truncate">{shortAddr(addr)}</span>
        </div>
        <div className="text-[11px] font-semibold text-white">{RANK_LABELS[level] ?? 'Member'}</div>
        <div className="text-[10px] font-mono text-brand-gold">${Number(totalIncome).toFixed(0)} earned</div>
        {hasKids && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
            {expanded ? <ChevronDown size={10} className="text-brand-muted" /> : <ChevronRight size={10} className="text-brand-muted" />}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && depth < maxDepth && (!isZero(leftAddr) || !isZero(rightAddr)) && (
        <div className="relative mt-6">
          {/* Horizontal connector */}
          <div className="absolute top-0 left-[15%] right-[15%] -translate-y-3 h-px bg-brand-border" />
          <div className="flex gap-4">
            {[leftAddr, rightAddr].map((childAddr, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="h-3 w-px bg-brand-border" />
                <div className="text-[9px] font-mono text-brand-muted mb-1 px-2 py-0.5 rounded bg-brand-surface border border-brand-border">
                  {idx === 0 ? `L $${Number(leftVol).toFixed(0)}` : `R $${Number(rightVol).toFixed(0)}`}
                </div>
                <BinaryNode address={childAddr ?? ZERO} depth={depth + 1} maxDepth={maxDepth} selfAddr={selfAddr} />
              </div>
            ))}
          </div>
        </div>
      )}
      {depth >= maxDepth && hasKids && (
        <div className="mt-2 text-[9px] text-brand-muted bg-brand-surface px-2 py-1 rounded border border-brand-border">
          +more
        </div>
      )}
    </div>
  )
}

// ── Affiliate list node ───────────────────────────────────────────────────────
function AffiliateNode({ address: addr, depth = 0, maxDepth = 5 }) {
  const [expanded, setExpanded] = useState(depth === 0)

  const { data: affiliateRaw } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'affiliates', args: [addr],
    query: { enabled: !!addr && !isZero(addr), staleTime: 30000 },
  })
  const { data: children, isLoading } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'getChildren',
    args: [addr, 0n, 50n],
    query: { enabled: !!addr && !isZero(addr) && expanded, staleTime: 30000 },
  })
  const { data: walletRaw } = useReadContract({
    address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'wallets', args: [addr],
    query: { enabled: !!addr && !isZero(addr), staleTime: 30000 },
  })

  const level       = affiliateRaw ? Number(affiliateRaw[3]) : 0
  const totalDirect = affiliateRaw ? formatUnits(affiliateRaw[2] ?? 0n, 18) : '0'
  const totalIncome = walletRaw    ? formatUnits(walletRaw[2] ?? 0n, 18) : '0'
  const hasKids     = (children?.length ?? 0) > 0

  return (
    <div className="ml-5 border-l border-brand-border pl-4">
      <div
        className="flex items-center gap-2 py-2 cursor-pointer group hover:bg-brand-surface -ml-2 pl-2 pr-2 rounded-lg transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: RANK_COLORS[level] ?? '#64748B' }}>
          {level}
        </div>
        <span className="font-mono text-xs text-white">{shortAddr(addr)}</span>
        <span className="text-[10px] text-brand-muted">{RANK_LABELS[level]}</span>
        <span className="ml-auto font-mono text-[10px] text-brand-gold">${Number(totalIncome).toFixed(0)}</span>
        {hasKids && (expanded
          ? <ChevronDown size={12} className="text-brand-muted" />
          : <ChevronRight size={12} className="text-brand-muted" />)}
        <a href={`https://bscscan.com/address/${addr}`} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-brand-gold">
          <ExternalLink size={10} />
        </a>
      </div>

      {expanded && (
        <div>
          {isLoading && (
            <div className="flex items-center gap-2 py-2 pl-2 text-brand-muted text-xs">
              <Loader2 size={10} className="animate-spin" /> Loading children…
            </div>
          )}
          {(children ?? []).map((ref) => (
            <AffiliateNode key={ref} address={ref} depth={depth + 1} maxDepth={maxDepth} />
          ))}
          {!isLoading && children?.length === 0 && (
            <div className="py-2 pl-2 text-brand-muted text-xs italic">No direct referrals</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function GenealogyTree({ address: rootAddress }) {
  const [activeTab, setActiveTab] = useState('binary')
  const [binaryDepth, setBinaryDepth] = useState(3)

  if (!rootAddress) {
    return (
      <div className="flex items-center justify-center h-48 text-brand-muted text-sm">
        Connect wallet to view your genealogy
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-2 p-1 bg-brand-surface rounded-xl border border-brand-border w-fit">
        {[
          { id: 'binary',    label: 'Binary Tree',    icon: GitBranch },
          { id: 'affiliate', label: 'Affiliate Tree',  icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                : 'text-brand-muted hover:text-white'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'binary' && (
        <div>
          {/* Depth control */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs text-brand-muted">Display depth:</span>
            {[2, 3, 4, 5].map((d) => (
              <button key={d} onClick={() => setBinaryDepth(d)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                  binaryDepth === d ? 'bg-brand-gold text-brand-dark' : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-white'
                }`}>{d}</button>
            ))}
            <span className="text-xs text-brand-muted ml-2">Click nodes to expand</span>
          </div>
          <div className="overflow-x-auto pb-6">
            <div className="flex justify-center min-w-max px-8 pt-6">
              <BinaryNode address={rootAddress} depth={0} maxDepth={binaryDepth} selfAddr={rootAddress} />
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-brand-border text-xs text-brand-muted">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-brand-gold" /><span>You</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-dashed border-brand-border" /><span>Open Slot</span></div>
            {RANK_LABELS.slice(0, 8).map((name, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: RANK_COLORS[i] }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'affiliate' && (
        <div className="bg-brand-surface rounded-xl border border-brand-border p-4 overflow-auto max-h-[520px]">
          <div className="flex text-xs text-brand-muted border-b border-brand-border pb-3 mb-2 font-semibold">
            <span>Address · Rank</span>
            <span className="ml-auto">Total Earned</span>
          </div>
          <AffiliateNode address={rootAddress} depth={0} maxDepth={6} />
        </div>
      )}
    </div>
  )
}
