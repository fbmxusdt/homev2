import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { parseUnits, maxUint256, formatUnits } from 'viem'
import { Coins, Loader2, CheckCircle, AlertCircle, Info, ArrowRight, Zap } from 'lucide-react'
import {
  FBMXDAO_ADDRESS, FBMXDAO_ABI,
  USDT_ADDRESS, FBMX_ADDRESS, ERC20_ABI,
  MIN_FBMX_REQUIRED, ENTRY_FEE, MAX_RANK,
} from '../../config/contracts'

// Cost to jump from level 0 to targetLevel in one tx:
// sum of ENTRY_FEE * 2^0 + ... + ENTRY_FEE * 2^(targetLevel-1) = ENTRY_FEE * (2^targetLevel - 1)
function jumpCost(targetLevel) {
  if (targetLevel <= 0) return 0n
  return ENTRY_FEE * ((1n << BigInt(targetLevel)) - 1n)
}

export default function DepositPanel({
  user,
  hasActivated,
  usdtBalance, usdtBalanceRaw,
  fbmxBalance, fbmxBalanceRaw,
  usdtAllowanceRaw,
  fbmxAllowanceRaw,
  onSuccess,
}) {
  const [tab, setTab] = useState('usdt')

  return (
    <div className="space-y-5 max-w-lg">
      {/* Tab */}
      <div className="flex p-1 bg-brand-surface border border-brand-border rounded-xl w-fit">
        {[
          { id: 'usdt', label: 'Deposit USDT', color: '#26A17B' },
          { id: 'fbmx', label: 'Deposit FBMX', color: '#F5A623' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-brand-card border border-brand-border text-white shadow-card'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usdt'
        ? <USDTDeposit user={user} hasActivated={hasActivated} usdtBalanceRaw={usdtBalanceRaw} usdtBalance={usdtBalance} usdtAllowanceRaw={usdtAllowanceRaw} onSuccess={onSuccess} />
        : <FBMXDeposit fbmxBalance={fbmxBalance} fbmxBalanceRaw={fbmxBalanceRaw} fbmxAllowanceRaw={fbmxAllowanceRaw} onSuccess={onSuccess} />
      }
    </div>
  )
}

// ─── USDT Deposit ─────────────────────────────────────────────────────────────
// depositUSDT(uint8 targetLevel)
//   targetLevel = 0  → sequential (always available)
//   targetLevel > 0  → jump to level in one tx (only when hasActivated == false)
function USDTDeposit({ user, hasActivated, usdtBalanceRaw, usdtBalance, usdtAllowanceRaw, onSuccess }) {
  // Jump mode state — only relevant when hasActivated === false
  const canJump = hasActivated === false
  const [jumpMode, setJumpMode]     = useState(false)
  const [jumpTarget, setJumpTarget] = useState(1)

  // Determine effective deposit amount
  const seqAmount    = user?.upgradeAmount ?? 0n
  const seqFmt       = user?.upgradeAmountFmt ?? '—'
  const jumpAmount   = jumpMode && canJump ? jumpCost(jumpTarget) : 0n
  const jumpFmt      = jumpMode && canJump ? Number(formatUnits(jumpAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'

  const upgradeAmount = jumpMode && canJump ? jumpAmount : seqAmount
  const upgradeFmt    = jumpMode && canJump ? jumpFmt    : seqFmt

  const hasBalance    = usdtBalanceRaw >= upgradeAmount
  const hasAllowance  = usdtAllowanceRaw >= upgradeAmount
  const needsApproval = !hasAllowance && upgradeAmount > 0n

  const [step, setStep] = useState('idle')
  const { writeContract, data: txHash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleApprove = () => {
    setStep('approving')
    writeContract(
      { address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [FBMXDAO_ADDRESS, maxUint256] },
      { onSuccess: () => setStep('approved'), onError: () => setStep('idle') }
    )
  }

  const handleDeposit = () => {
    const target = jumpMode && canJump ? jumpTarget : 0
    setStep('depositing')
    writeContract(
      { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'depositUSDT', args: [target] },
      { onSuccess: () => { setStep('done'); onSuccess?.() }, onError: () => setStep('idle') }
    )
  }

  const busy = isPending || isConfirming

  return (
    <div className="space-y-5">
      {/* Jump-mode toggle — only shown on first activation */}
      {canJump && (
        <div className="flex items-center gap-3 p-4 bg-brand-gold/5 border border-brand-gold/20 rounded-xl">
          <Zap size={16} className="text-brand-gold flex-shrink-0" />
          <div className="flex-1 text-xs text-brand-muted leading-relaxed">
            <strong className="text-white">First activation:</strong> you can jump directly to any level in one transaction.
          </div>
          <button
            onClick={() => { setJumpMode((v) => !v); setStep('idle'); reset?.() }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              jumpMode
                ? 'bg-brand-gold text-brand-dark border-brand-gold'
                : 'bg-transparent border-brand-gold/40 text-brand-gold hover:border-brand-gold'
            }`}
          >
            {jumpMode ? 'Jump On' : 'Jump Off'}
          </button>
        </div>
      )}

      {/* Level selector — only in jump mode */}
      {canJump && jumpMode && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-muted">Target Level</span>
            <span className="text-sm font-mono font-bold text-brand-gold">Level {jumpTarget}</span>
          </div>
          <input
            type="range"
            min={1} max={MAX_RANK} step={1}
            value={jumpTarget}
            onChange={(e) => { setJumpTarget(Number(e.target.value)); setStep('idle'); reset?.() }}
            className="w-full accent-brand-gold"
          />
          <div className="flex justify-between text-xs text-brand-muted">
            <span>Lvl 1 — 5 USDT</span>
            <span>Lvl {MAX_RANK} — {Number(formatUnits(jumpCost(MAX_RANK), 18)).toLocaleString()} USDT</span>
          </div>
        </div>
      )}

      {/* How it works — sequential mode */}
      {!jumpMode && (
        <div className="flex items-start gap-3 p-4 bg-brand-surface border border-brand-border rounded-xl">
          <Info size={16} className="text-brand-gold flex-shrink-0 mt-0.5" />
          <div className="text-xs text-brand-muted leading-relaxed">
            USDT deposit amount is determined by your current rank.{' '}
            The contract calculates <strong className="text-white">entryFee × 2^level</strong>.
            Your next deposit is <strong className="text-brand-gold">{seqFmt} USDT</strong>.
          </div>
        </div>
      )}

      {/* Deposit amount display */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-brand-muted">{jumpMode && canJump ? `Jump to Level ${jumpTarget}` : 'Required deposit'}</span>
          <span className="font-mono font-bold text-white">{upgradeFmt} USDT</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-brand-muted">Your USDT balance</span>
          <span className={`font-mono font-semibold ${hasBalance ? 'text-brand-green' : 'text-brand-red'}`}>
            {Number(usdtBalance).toFixed(4)} USDT
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-brand-muted">Approval status</span>
          {hasAllowance
            ? <span className="text-brand-green text-xs font-semibold flex items-center gap-1"><CheckCircle size={11} /> Approved</span>
            : <span className="text-amber-400 text-xs font-semibold">Needs approval</span>}
        </div>
      </div>

      {/* Insufficient balance */}
      {!hasBalance && upgradeAmount > 0n && (
        <div className="flex items-center gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={12} />
          Insufficient USDT. You need {upgradeFmt} USDT in your wallet.
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          {error?.shortMessage || error?.message || 'Transaction failed'}
        </div>
      )}

      {/* Steps */}
      {needsApproval ? (
        <div className="space-y-2">
          <button
            onClick={handleApprove}
            disabled={busy || !hasBalance}
            className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold"
          >
            {busy && step === 'approving' ? <><Loader2 size={16} className="animate-spin" /> Approving…</> : <><CheckCircle size={16} /> Step 1 — Approve USDT</>}
          </button>
          <div className="flex items-center gap-2 opacity-40">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-muted">then</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>
          <button disabled className="w-full py-4 rounded-xl bg-brand-surface border border-brand-border text-brand-muted text-sm cursor-not-allowed">
            Step 2 — Deposit USDT
          </button>
        </div>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={busy || !hasBalance || !hasAllowance}
          className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-base"
        >
          {busy ? <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Depositing…'}</>
               : isSuccess ? <><CheckCircle size={16} /> Deposited!</>
               : jumpMode && canJump
                 ? <><Zap size={16} /> Jump to Level {jumpTarget} — {upgradeFmt} USDT</>
                 : <><Coins size={16} /> Deposit {upgradeFmt} USDT</>}
        </button>
      )}
    </div>
  )
}

// ─── FBMX Deposit ─────────────────────────────────────────────────────────────
// depositFBMX(uint256 _amount) — stores FBMX in tokenBalance; needed for collect/withdraw fees
function FBMXDeposit({ fbmxBalance, fbmxBalanceRaw, fbmxAllowanceRaw, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [step, setStep]     = useState('idle')

  const amountRaw     = amount ? parseUnits(amount, 18) : 0n
  const hasBalance    = fbmxBalanceRaw >= amountRaw
  const hasAllowance  = fbmxAllowanceRaw >= amountRaw
  const needsApproval = !hasAllowance && amountRaw > 0n

  const { writeContract, data: txHash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const busy = isPending || isConfirming

  const handleApprove = () => {
    setStep('approving')
    writeContract(
      { address: FBMX_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [FBMXDAO_ADDRESS, maxUint256] },
      { onSuccess: () => setStep('approved'), onError: () => setStep('idle') }
    )
  }

  const handleDeposit = () => {
    setStep('depositing')
    writeContract(
      { address: FBMXDAO_ADDRESS, abi: FBMXDAO_ABI, functionName: 'depositFBMX', args: [amountRaw] },
      { onSuccess: () => { setStep('done'); onSuccess?.() }, onError: () => setStep('idle') }
    )
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-3 p-4 bg-brand-surface border border-brand-border rounded-xl">
        <Info size={16} className="text-brand-gold flex-shrink-0 mt-0.5" />
        <div className="text-xs text-brand-muted leading-relaxed">
          FBMX held in the contract acts as a <strong className="text-white">utility fee</strong>.
          Each collect or withdraw burns <strong className="text-brand-gold">0.05 FBMX</strong> from your in-contract balance.
          Minimum deposit: 0.05 FBMX.
        </div>
      </div>

      {/* Amount input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-brand-muted">Amount (FBMX)</label>
          <button className="text-xs text-brand-gold hover:underline" onClick={() => setAmount(Number(fbmxBalance).toFixed(6))}>
            Max: {Number(fbmxBalance).toFixed(4)} FBMX
          </button>
        </div>
        <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl overflow-hidden focus-within:border-brand-gold/50 focus-within:ring-2 focus-within:ring-brand-gold/10">
          <input
            type="number" min="0" value={amount}
            onChange={(e) => { setAmount(e.target.value); setStep('idle'); reset?.() }}
            placeholder="0.01"
            className="flex-1 px-4 py-3 bg-transparent text-white font-mono text-sm outline-none"
          />
          <span className="px-4 text-brand-gold text-sm font-bold border-l border-brand-border">FBMX</span>
        </div>
        {amount && !hasBalance && (
          <p className="mt-1.5 text-brand-red text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Insufficient FBMX balance
          </p>
        )}
      </div>

      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          {error?.shortMessage || error?.message || 'Transaction failed'}
        </div>
      )}

      {needsApproval ? (
        <div className="space-y-2">
          <button onClick={handleApprove} disabled={busy || !hasBalance || !amount}
            className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold">
            {busy && step === 'approving' ? <><Loader2 size={16} className="animate-spin" />Approving…</> : <><CheckCircle size={16} />Step 1 — Approve FBMX</>}
          </button>
          <button disabled className="w-full py-4 rounded-xl bg-brand-surface border border-brand-border text-brand-muted text-sm cursor-not-allowed">
            Step 2 — Deposit FBMX
          </button>
        </div>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={busy || !amount || !hasBalance || amountRaw <= 0n}
          className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-base"
        >
          {busy ? <><Loader2 size={16} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Depositing…'}</>
               : isSuccess ? <><CheckCircle size={16} />Deposited!</>
               : <><Coins size={16} />Deposit {amount || '0'} FBMX</>}
        </button>
      )}
    </div>
  )
}
