import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Layers, Loader2, CheckCircle, AlertCircle, TrendingUp, Info } from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI, MAX_RANK } from '../../config/contracts'
import { formatUnits } from 'viem'

// Passive rate is dynamic (1%–8% based on referral / equity ratio)
// Level labels based on rank index
const RANK_LABELS = [
  'Registered','Initiate','Scout','Pioneer','Challenger','Builder',
  'Trailblazer','Guardian','Commander','Vanguard','Warlord','Sovereign','Archon','Titan','Fortress'
]

const RANK_COLORS = [
  '#6B7280','#CD7F32','#C0C0C0','#F5A623','#E5E4E2','#00D4AA',
  '#3B82F6','#A855F7','#EC4899','#F97316','#EF4444','#8B5CF6','#06B6D4','#F59E0B','#F5A623'
]

export default function UpgradePanel({ user, onSuccess }) {
  const currentLevel  = user?.level ?? 0
  const nextLevel     = currentLevel + 1
  const canUpgrade    = currentLevel < MAX_RANK

  // upgradeAmount from contract = entryFee × 2^currentLevel
  const upgradeFmt    = user?.upgradeAmountFmt ?? '—'
  const walletBalance = Number(user?.walletBalance ?? 0)
  const hasBalance    = walletBalance >= Number(upgradeFmt)

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleUpgrade = () => {
    writeContract({ address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'activateRank', args: [] })
  }

  const busy = isPending || isConfirming

  return (
    <div className="space-y-6 max-w-lg">
      {/* Current rank */}
      <div className="flex items-center gap-5 p-5 bg-brand-surface border border-brand-border rounded-2xl">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-3xl text-white flex-shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${RANK_COLORS[currentLevel]}, ${RANK_COLORS[currentLevel]}88)` }}
        >
          {currentLevel}
        </div>
        <div className="flex-1">
          <div className="text-xs text-brand-muted mb-1">Current Rank</div>
          <div className="font-display font-bold text-white text-xl">{RANK_LABELS[currentLevel] ?? `Rank ${currentLevel}`}</div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-muted">
            <span className="text-brand-gold font-semibold">Passive: 1–8% dynamic</span>
            <span>·</span>
            <span>Balance: <span className="text-white font-mono">${walletBalance.toFixed(2)}</span></span>
          </div>
        </div>
      </div>

      {/* How passive rate is determined */}
      <div className="flex items-start gap-3 p-4 bg-brand-surface border border-brand-border rounded-xl">
        <Info size={15} className="text-brand-gold flex-shrink-0 mt-0.5" />
        <div className="text-xs text-brand-muted leading-relaxed space-y-1">
          <p><strong className="text-white">Passive Rate</strong> = your <em>referralIncome ÷ totalEquity</em> ratio (capped 1%–8% per day).</p>
          <p><strong className="text-white">Upgrade Cost</strong> = <code className="text-brand-gold">5 USDT × 2^rank</code> — deducted from your wallet balance.</p>
          <p><strong className="text-white">Capping</strong> increases by <code className="text-brand-gold">upgradeAmount × 3</code> per rank.</p>
        </div>
      </div>

      {/* Rank progression */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {RANK_LABELS.slice(0, MAX_RANK + 1).map((name, i) => (
          <div
            key={i}
            className={`rounded-xl p-3 text-center border transition-all ${
              i === currentLevel ? 'border-brand-gold/50 bg-brand-gold/10 ring-1 ring-brand-gold/20'
              : i < currentLevel ? 'border-brand-border bg-brand-surface opacity-50'
              : i === nextLevel  ? 'border-brand-green/30 bg-brand-green/5'
              : 'border-brand-border bg-brand-surface opacity-25'
            }`}
          >
            <div className="w-7 h-7 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: RANK_COLORS[i] ?? '#64748B' }}>
              {i}
            </div>
            <div className="text-[10px] text-white font-semibold leading-tight">{name}</div>
            {i === currentLevel && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-gold mx-auto animate-pulse" />}
            {i < currentLevel  && <CheckCircle size={10} className="text-brand-green mx-auto mt-1" />}
          </div>
        ))}
      </div>

      {/* Upgrade action */}
      {canUpgrade ? (
        <div className="space-y-3">
          <div className="p-4 bg-brand-surface border border-brand-border rounded-xl space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-muted">Upgrade to</span>
              <span className="font-semibold text-white">{RANK_LABELS[nextLevel] ?? `Rank ${nextLevel}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Cost (from wallet)</span>
              <span className="font-mono font-bold text-brand-gold">{upgradeFmt} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Available balance</span>
              <span className={`font-mono font-semibold ${hasBalance ? 'text-brand-green' : 'text-brand-red'}`}>
                ${walletBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {!hasBalance && (
            <div className="flex items-center gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
              <AlertCircle size={12} />
              Insufficient wallet balance. Deposit USDT first, then upgrade.
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              {error?.shortMessage || error?.message || 'Transaction failed'}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={busy || !hasBalance}
            className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-base"
          >
            {busy ? (
              <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Confirm in wallet…'}</>
            ) : isSuccess ? (
              <><CheckCircle size={16} />Rank Upgraded!</>
            ) : (
              <><Layers size={16} />Activate Rank → {RANK_LABELS[nextLevel]}</>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-5 bg-brand-gold/5 border border-brand-gold/20 rounded-2xl">
          <CheckCircle size={24} className="text-brand-gold flex-shrink-0" />
          <div>
            <div className="font-display font-bold text-brand-gold">Maximum Rank Reached</div>
            <div className="text-brand-muted text-xs mt-1">You are at Rank {MAX_RANK} ({RANK_LABELS[MAX_RANK]}). Enjoying maximum rewards.</div>
          </div>
        </div>
      )}
    </div>
  )
}
