import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Layers, Loader2, CheckCircle, AlertCircle, TrendingUp, Info, Zap } from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI, MAX_RANK } from '../../config/contracts'
import { formatUnits } from 'viem'

const RANK_LABELS = [
  'Registered', 'Initiate', 'Scout', 'Pioneer', 'Challenger', 'Builder',
  'Trailblazer', 'Guardian', 'Commander', 'Vanguard', 'Warlord', 'Sovereign', 'Archon', 'Titan', 'Fortress', 'Emperor'
]

const RANK_COLORS = [
  '#6B7280', '#CD7F32', '#C0C0C0', '#F5A623', '#E5E4E2', '#00D4AA',
  '#3B82F6', '#A855F7', '#EC4899', '#F97316', '#EF4444', '#8B5CF6', '#06B6D4', '#F59E0B', '#F5A623', '#FFD700'
]

// Reverse-engineer pendingTargetLevel from wallet balance.
// Contract formula: entryFee × (2^t − 1). entryFee = 5 USDT.
function inferJumpTargetLevel(walletBalanceFmt, max) {
  const ENTRY_FEE = 5
  const balance = Number(walletBalanceFmt)
  if (balance <= 0) return null
  for (let t = 1; t <= max; t++) {
    const cost = ENTRY_FEE * ((2 ** t) - 1)
    if (Math.abs(balance - cost) < 0.01) return t
  }
  return null
}

export default function UpgradePanel({ user, onSuccess }) {
  const currentLevel = user?.level ?? 0
  const walletBalance = Number(user?.walletBalance ?? 0)

  // Pending jump state: deposited cumulative cost but activateRank() not called yet.
  // pendingTargetLevel is private on-chain — inferred from wallet balance.
  const isPendingJump = !user?.hasActivated && currentLevel === 0 && walletBalance > 0
  const jumpTargetLevel = isPendingJump ? inferJumpTargetLevel(user?.walletBalance, MAX_RANK) : null

  const nextLevel = currentLevel + 1
  const canUpgrade = currentLevel < MAX_RANK

  const upgradeFmt = user?.upgradeAmountFmt ?? '—'
  const hasBalance = walletBalance >= Number(upgradeFmt)

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleUpgrade = () => {
    writeContract({ address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'activateRank', args: [] })
  }

  const busy = isPending || isConfirming

  return (
    <div className="space-y-6">

      {/* Pending jumpstart banner */}
      {isPendingJump && (
        <div className="flex items-start gap-3 p-4 bg-brand-gold/10 border border-brand-gold/30 rounded-2xl">
          <Zap size={18} className="text-brand-gold flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-display font-bold text-brand-gold text-sm">
              Jump Activation Pending
            </div>
            <div className="text-xs text-brand-muted mt-0.5">
              You deposited for a jump to{' '}
              <span className="text-white font-semibold">
                {jumpTargetLevel ? `Rank ${jumpTargetLevel} — ${RANK_LABELS[jumpTargetLevel]}` : 'an unknown rank'}
              </span>.
              Press <span className="text-brand-gold font-semibold">Activate Jump</span> to complete all {jumpTargetLevel} rank-ups in one transaction.
            </div>
          </div>
        </div>
      )}

      {/* Current / target rank display */}
      <div className="flex items-center gap-4 p-4 sm:p-5 bg-brand-surface border border-brand-border rounded-2xl">
        {/* Current rank badge */}
        <div
          className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-white flex-shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${RANK_COLORS[currentLevel]}, ${RANK_COLORS[currentLevel]}88)` }}
        >
          {currentLevel}
        </div>

        {/* Arrow + target badge for pending jump */}
        {isPendingJump && jumpTargetLevel && (
          <>
            <div className="text-brand-gold font-bold text-lg">→</div>
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-white flex-shrink-0 shadow-lg ring-2 ring-brand-gold animate-pulse"
              style={{ background: `linear-gradient(135deg, ${RANK_COLORS[jumpTargetLevel]}, ${RANK_COLORS[jumpTargetLevel]}88)` }}
            >
              {jumpTargetLevel}
            </div>
          </>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-[11px] sm:text-xs text-brand-muted mb-0.5">
            {isPendingJump ? 'Jump Target' : 'Current Rank'}
          </div>
          <div className="font-display font-bold text-white text-base sm:text-xl truncate">
            {isPendingJump && jumpTargetLevel
              ? RANK_LABELS[jumpTargetLevel] ?? `Rank ${jumpTargetLevel}`
              : RANK_LABELS[currentLevel] ?? `Rank ${currentLevel}`}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-brand-muted">
            <span className="text-brand-gold font-semibold">1–8%/day</span>
            <span className="hidden xs:inline">·</span>
            <span className="hidden xs:inline">Bal: <span className="text-white font-mono">${walletBalance.toFixed(2)}</span></span>
            {isPendingJump && jumpTargetLevel && (
              <>
                <span className="hidden xs:inline">·</span>
                <span className="text-brand-gold font-semibold hidden xs:inline">
                  Cost: ${(5 * ((2 ** jumpTargetLevel) - 1)).toFixed(0)} USDT
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info block */}
      <div className="flex items-start gap-3 p-4 bg-brand-surface border border-brand-border rounded-xl">
        <Info size={15} className="text-brand-gold flex-shrink-0 mt-0.5" />
        <div className="text-xs text-brand-muted leading-relaxed space-y-1">
          {isPendingJump ? (
            <>
              <p><strong className="text-white">Jump Activation</strong> runs {jumpTargetLevel} sequential rank-ups in one transaction.</p>
              <p><strong className="text-white">Binary rewards</strong> are distributed per-level, matching exactly what {jumpTargetLevel} normal upgrades would produce.</p>
              <p><strong className="text-white">No extra deposit needed</strong> — your wallet balance already covers the full cost.</p>
            </>
          ) : (
            <>
              <p><strong className="text-white">Passive Rate</strong> = your <em>referralIncome ÷ totalEquity</em> ratio (capped 1%–8% per day).</p>
              <p><strong className="text-white">Upgrade Cost</strong> = <code className="text-brand-gold">5 USDT × 2^rank</code> — deducted from your wallet balance.</p>
              <p><strong className="text-white">Capping</strong> increases by <code className="text-brand-gold">upgradeAmount × 3</code> per rank.</p>
            </>
          )}
        </div>
      </div>

      {/* Rank progression grid */}
      <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-5 gap-1.5 sm:gap-2">
        {RANK_LABELS.slice(0, MAX_RANK + 1).map((name, i) => {
          const isCurrentLevel  = i === currentLevel
          const isBelowCurrent  = i < currentLevel
          const isJumpTarget    = isPendingJump && jumpTargetLevel && i === jumpTargetLevel
          const isJumpFill      = isPendingJump && jumpTargetLevel && i > 0 && i < jumpTargetLevel
          const isNextNormal    = !isPendingJump && i === nextLevel

          let borderClass = 'border-brand-border bg-brand-surface opacity-25'
          if (isCurrentLevel)  borderClass = 'border-brand-gold/50 bg-brand-gold/10 ring-1 ring-brand-gold/20'
          else if (isBelowCurrent) borderClass = 'border-brand-border bg-brand-surface opacity-50'
          else if (isJumpTarget)   borderClass = 'border-brand-gold/70 bg-brand-gold/20 ring-2 ring-brand-gold/40'
          else if (isJumpFill)     borderClass = 'border-brand-gold/30 bg-brand-gold/5'
          else if (isNextNormal)   borderClass = 'border-brand-green/30 bg-brand-green/5'

          return (
            <div key={i} className={`rounded-xl p-2 sm:p-3 text-center border transition-all ${borderClass}`}>
              <div
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full mx-auto mb-1.5 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white"
                style={{ background: RANK_COLORS[i] ?? '#64748B' }}
              >
                {i}
              </div>
              <div className="text-[9px] sm:text-[10px] text-white font-semibold leading-tight truncate">{name}</div>
              {isCurrentLevel && !isPendingJump && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-gold mx-auto animate-pulse" />}
              {isJumpTarget   && <Zap size={9} className="text-brand-gold mx-auto mt-1" />}
              {isBelowCurrent && <CheckCircle size={9} className="text-brand-green mx-auto mt-1" />}
              {isJumpFill     && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-gold/50 mx-auto" />}
            </div>
          )
        })}
      </div>

      {/* Action */}
      {canUpgrade ? (
        <div className="space-y-3">
          {isPendingJump && jumpTargetLevel ? (
            /* Jump activation summary */
            <div className="p-4 bg-brand-surface border border-brand-gold/20 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-muted">Activating ranks</span>
                <span className="font-semibold text-white">1 → {jumpTargetLevel} ({jumpTargetLevel} levels)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Total cost (pre-deposited)</span>
                <span className="font-mono font-bold text-brand-gold">${(5 * ((2 ** jumpTargetLevel) - 1)).toFixed(0)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Target rank</span>
                <span className="font-semibold text-white">{RANK_LABELS[jumpTargetLevel]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Wallet balance</span>
                <span className="font-mono font-semibold text-brand-green">${walletBalance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            /* Normal sequential summary */
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
          )}

          {!isPendingJump && !hasBalance && (
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
            disabled={busy || (!isPendingJump && !hasBalance)}
            className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-base"
          >
            {busy ? (
              <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Confirm in wallet…'}</>
            ) : isSuccess ? (
              <><CheckCircle size={16} />Rank Activated!</>
            ) : isPendingJump && jumpTargetLevel ? (
              <><Zap size={16} />Activate Jump → {RANK_LABELS[jumpTargetLevel]}</>
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
