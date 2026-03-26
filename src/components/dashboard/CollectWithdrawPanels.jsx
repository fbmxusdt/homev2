import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits } from 'viem'
import {
  Clock, Loader2, CheckCircle, TrendingDown, GitBranch,
  ArrowDownCircle, AlertCircle, Info, Zap
} from 'lucide-react'
import {
  FBMXDAO_ADDRESS, FBMXDAO_ABI, WITHDRAW_TIERS, MIN_FBMX_REQUIRED
} from '../../config/contracts'
import { useCountdown } from '../../hooks/useCountdown'

// ─── Cooldown display ─────────────────────────────────────────────────────────
function CooldownBar({ label, endsAt, color = 'amber' }) {
  const { formatted, isActive } = useCountdown(endsAt)
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
      isActive
        ? color === 'red'
          ? 'bg-brand-red/10 border-brand-red/20'
          : 'bg-amber-500/10 border-amber-500/20'
        : 'bg-brand-green/10 border-brand-green/20'
    }`}>
      <div className={`flex items-center gap-1.5 ${isActive ? (color === 'red' ? 'text-brand-red' : 'text-amber-400') : 'text-brand-green'}`}>
        {isActive ? <Clock size={11} className="animate-pulse" /> : <CheckCircle size={11} />}
        <span>{label}</span>
      </div>
      <span className={`font-mono font-bold ${isActive ? (color === 'red' ? 'text-brand-red' : 'text-amber-400') : 'text-brand-green'}`}>
        {isActive ? formatted : 'Ready'}
      </span>
    </div>
  )
}

// ─── Generic collect panel ────────────────────────────────────────────────────
function CollectCard({ icon: Icon, title, color, balance, balanceLabel, endsAt, globalEndsAt, txCooldownSecs = 60, functionName, fbmxInContract, onSuccess, note }) {
  const { isActive: cooldownActive } = useCountdown(endsAt)
  const { isActive: globalActive }   = useCountdown(globalEndsAt)
  const disabled = cooldownActive || globalActive
  const hasFbmx  = BigInt(Math.round(Number(fbmxInContract ?? 0) * 1e18)) >= MIN_FBMX_REQUIRED

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const busy = isPending || isConfirming

  const handleAction = () => {
    writeContract(
      { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName, args: [] },
      { onSuccess }
    )
  }

  const colorMap = {
    gold:  { ring: 'ring-brand-gold/20',  bg: 'bg-brand-gold/10',  text: 'text-brand-gold',  btn: 'btn-gold' },
    green: { ring: 'ring-brand-green/20', bg: 'bg-brand-green/10', text: 'text-brand-green', btn: 'bg-brand-green text-brand-dark font-display font-bold hover:brightness-110' },
  }
  const c = colorMap[color] ?? colorMap.gold

  return (
    <div className={`bg-brand-card border border-brand-border rounded-2xl p-6 space-y-5 transition-all ${!disabled ? `ring-1 ${c.ring}` : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        <div>
          <h3 className="font-display font-bold text-white">{title}</h3>
          {note && <p className="text-brand-muted text-xs mt-0.5">{note}</p>}
        </div>
      </div>

      {/* Balance */}
      <div className="p-4 bg-brand-surface border border-brand-border rounded-xl">
        <div className="text-xs text-brand-muted mb-1">{balanceLabel}</div>
        <div className={`font-mono font-bold text-2xl ${c.text}`}>
          {Number(balance ?? 0).toFixed(4)}
          <span className="text-sm ml-1 text-brand-muted font-normal">USDT</span>
        </div>
      </div>

      {/* FBMX fee warning */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border text-xs ${
        hasFbmx
          ? 'bg-brand-surface border-brand-border text-brand-muted'
          : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
      }`}>
        <Zap size={11} className="flex-shrink-0" />
        <span>
          Requires <strong>0.05 FBMX</strong> in contract.
          {hasFbmx
            ? <> You have <span className="text-white font-mono"> {Number(fbmxInContract).toFixed(4)}</span> FBMX.</>
            : <> Deposit FBMX first.</>}
        </span>
      </div>

      {/* Cooldowns */}
      <div className="space-y-2">
        <CooldownBar label="24h personal cooldown" endsAt={endsAt} color="amber" />
        <CooldownBar label={`${txCooldownSecs}s global lock`} endsAt={globalEndsAt} color="red" />
      </div>

      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          {error?.shortMessage || error?.message || 'Transaction failed'}
        </div>
      )}

      <button
        onClick={handleAction}
        disabled={disabled || busy || Number(balance ?? 0) <= 0 || !hasFbmx}
        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all
          disabled:opacity-40 disabled:cursor-not-allowed ${c.btn}`}
      >
        {busy
          ? <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Processing…'}</>
          : isSuccess
          ? <><CheckCircle size={16} />Collected!</>
          : disabled
          ? <><Clock size={16} />Cooldown Active</>
          : !hasFbmx
          ? <><Zap size={16} />Deposit FBMX First</>
          : <><Icon size={16} />{title}</>
        }
      </button>
    </div>
  )
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export function CollectPassivePanel({ user, passiveCooldownEnds, globalCooldownEnds, txCooldownSecs = 60, onSuccess }) {
  return (
    <CollectCard
      icon={TrendingDown}
      title="Collect Passive Rewards"
      color="gold"
      balance={user?.passiveReward}
      balanceLabel="Pending Passive Reward"
      endsAt={passiveCooldownEnds}
      globalEndsAt={globalCooldownEnds}
      txCooldownSecs={txCooldownSecs}
      functionName="collectPassiveRewards"
      fbmxInContract={user?.fbmxInContract}
      onSuccess={onSuccess}
      note="Rate: 1%–8% / day based on referral income ÷ equity ratio"
    />
  )
}

export function CollectBinaryPanel({ user, binaryCooldownEnds, globalCooldownEnds, txCooldownSecs = 60, onSuccess }) {
  const binaryReward = Math.min(
    Number(user?.leftVolume ?? 0),
    Number(user?.rightVolume ?? 0)
  )
  return (
    <CollectCard
      icon={GitBranch}
      title="Collect Binary Rewards"
      color="green"
      balance={binaryReward}
      balanceLabel="Claimable Binary (weaker leg)"
      endsAt={binaryCooldownEnds}
      globalEndsAt={globalCooldownEnds}
      txCooldownSecs={txCooldownSecs}
      functionName="collectBinaryRewards"
      fbmxInContract={user?.fbmxInContract}
      onSuccess={onSuccess}
      note="Earn 10% of weaker leg volume · 24h cooldown"
    />
  )
}

// ─── Withdraw Panel (tier-based) ──────────────────────────────────────────────
export function WithdrawPanel({ user, withdrawCooldownEnds, globalCooldownEnds, txCooldownSecs = 60, onSuccess }) {
  const userLevel    = user?.level ?? 0
  const walletBal    = Number(user?.walletBalance ?? 0)
  const hasFbmx      = Number(user?.fbmxInContract ?? 0) >= 0.01
  const [selectedTier, setSelectedTier] = useState(null)

  const { isActive: cooldownActive } = useCountdown(withdrawCooldownEnds)
  const { isActive: globalActive }   = useCountdown(globalCooldownEnds)
  const disabled = cooldownActive || globalActive

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const busy = isPending || isConfirming

  const handleWithdraw = () => {
    if (!selectedTier) return
    writeContract(
      { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'withdrawBalance', args: [selectedTier.amount] },
      { onSuccess }
    )
  }

  const eligibleTiers = WITHDRAW_TIERS.filter((t) => userLevel >= t.minLevel)
  const tierAmount = selectedTier ? Number(formatUnits(selectedTier.amount, 18)) : 0

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center gap-3 p-4 bg-brand-card border border-brand-border rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <ArrowDownCircle size={18} />
        </div>
        <div>
          <h3 className="font-display font-bold text-white">Withdraw Balance</h3>
          <p className="text-brand-muted text-xs mt-0.5">Select a tier · 24h cooldown · 0.05 FBMX fee</p>
        </div>
      </div>

      {/* Wallet balance */}
      <div className="p-4 bg-brand-surface border border-brand-border rounded-xl">
        <div className="text-xs text-brand-muted mb-1">Available in Wallet</div>
        <div className="font-mono font-bold text-2xl text-blue-400">
          {walletBal.toFixed(4)} <span className="text-sm text-brand-muted font-normal">USDT</span>
        </div>
      </div>

      {/* Tier selector */}
      <div>
        <div className="text-sm font-medium text-brand-muted mb-3">Withdrawal Tier</div>
        {WITHDRAW_TIERS.length === 0 ? null : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {WITHDRAW_TIERS.map((tier) => {
              const unlocked = userLevel >= tier.minLevel
              const canAfford = walletBal >= Number(formatUnits(tier.amount, 18))
              const isSelected = selectedTier?.label === tier.label
              return (
                <button
                  key={tier.label}
                  onClick={() => unlocked && setSelectedTier(tier)}
                  disabled={!unlocked}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
                      : unlocked
                      ? 'border-brand-border bg-brand-surface hover:border-blue-500/30 hover:bg-brand-card'
                      : 'border-brand-border bg-brand-dark opacity-30 cursor-not-allowed'
                  }`}
                >
                  <div className={`font-display font-bold text-base ${isSelected ? 'text-blue-400' : unlocked ? 'text-white' : 'text-brand-muted'}`}>
                    {tier.label}
                  </div>
                  <div className="text-[10px] text-brand-muted mt-1">Lvl {tier.minLevel}+</div>
                  {unlocked && !canAfford && (
                    <div className="text-[9px] text-brand-red mt-0.5">Insufficient</div>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {eligibleTiers.length === 0 && (
          <p className="text-brand-muted text-sm text-center py-4">
            No tiers unlocked yet. Activate Rank 1 to unlock $15 withdrawals.
          </p>
        )}
      </div>

      {/* FBMX warning */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border text-xs ${
        hasFbmx ? 'bg-brand-surface border-brand-border text-brand-muted' : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
      }`}>
        <Zap size={11} />
        {hasFbmx
          ? <>0.05 FBMX fee available — <span className="font-mono ml-1 text-white">{Number(user?.fbmxInContract ?? 0).toFixed(4)} FBMX</span></>
          : <>Deposit FBMX to cover the 0.05 FBMX transaction fee.</>}
      </div>

      {/* Cooldowns */}
      <div className="space-y-2">
        <CooldownBar label="24h withdraw cooldown" endsAt={withdrawCooldownEnds} color="amber" />
        <CooldownBar label={`${txCooldownSecs}s global lock`} endsAt={globalCooldownEnds} color="red" />
      </div>

      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          {error?.shortMessage || error?.message || 'Transaction failed'}
        </div>
      )}

      <button
        onClick={handleWithdraw}
        disabled={disabled || busy || !selectedTier || tierAmount > walletBal || !hasFbmx}
        className="w-full py-4 rounded-xl flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400
                   text-white font-display font-bold text-base transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500"
      >
        {busy
          ? <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Processing…'}</>
          : isSuccess
          ? <><CheckCircle size={16} />Withdrawn!</>
          : disabled
          ? <><Clock size={16} />Cooldown Active</>
          : selectedTier
          ? <><ArrowDownCircle size={16} />Withdraw {selectedTier.label}</>
          : <>Select a Tier</>
        }
      </button>
    </div>
  )
}
