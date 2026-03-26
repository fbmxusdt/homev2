import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { Users, GitBranch, CheckCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI } from '../../config/contracts'
import { usePlacementPreview } from '../../hooks/useUserData'

const ZERO = '0x0000000000000000000000000000000000000000'

function shortAddr(addr) {
  if (!addr || addr === ZERO) return 'None'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const PLACEMENT_OPTIONS = [
  { value: 2, label: 'Auto (Weakest Leg)', desc: 'System finds the best open spot for network balance' },
  { value: 0, label: 'Force Left',         desc: 'Place at the deepest open left slot' },
  { value: 1, label: 'Force Right',        desc: 'Place at the deepest open right slot' },
]

export default function RegisterPanel({ onSuccess }) {
  const { address } = useAccount()
  const [referrer, setReferrer] = useState('')
  const [group, setGroup]       = useState(2)  // default: auto

  const validReferrer = referrer && isAddress(referrer)
  const isSelf = validReferrer && referrer.toLowerCase() === address?.toLowerCase()

  const { placement } = usePlacementPreview(validReferrer && !isSelf ? referrer : undefined, group)
  const placedAt   = placement?.[0]
  const placedSide = placement?.[1] ? 'Right' : 'Left'

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleRegister = () => {
    if (!validReferrer || isSelf) return
    writeContract({
      address: FBMXDAO_ADDRESS,
      abi: FBMXDAO_ABI,
      functionName: 'register',
      args: [referrer, group],
    })
  }

  if (isSuccess) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-brand-green" />
        </div>
        <h3 className="font-display font-bold text-xl text-white mb-2">Registered!</h3>
        <p className="text-brand-muted text-sm mb-6">You are now part of the FBMXDAO network.</p>
        <button onClick={onSuccess} className="btn-gold px-6 py-2.5 rounded-lg text-sm">
          Continue to Deposit <ArrowRight size={14} className="inline ml-1" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Referrer address */}
      <div>
        <label className="block text-sm font-medium text-brand-muted mb-2">
          Referrer / Sponsor Address <span className="text-brand-red">*</span>
        </label>
        <input
          type="text"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value.trim())}
          placeholder="0x..."
          className="w-full px-4 py-3 bg-brand-surface border border-brand-border rounded-xl text-white font-mono text-sm
                     focus:border-brand-gold/50 focus:ring-2 focus:ring-brand-gold/10 outline-none transition-all"
        />
        {referrer && !isAddress(referrer) && (
          <p className="mt-1.5 text-brand-red text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Invalid address format
          </p>
        )}
        {isSelf && (
          <p className="mt-1.5 text-brand-red text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Self-referral is not allowed
          </p>
        )}
      </div>

      {/* Placement group selector */}
      <div>
        <label className="block text-sm font-medium text-brand-muted mb-2">Binary Placement</label>
        <div className="space-y-2">
          {PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGroup(opt.value)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                group === opt.value
                  ? 'border-brand-gold/40 bg-brand-gold/8 ring-1 ring-brand-gold/20'
                  : 'border-brand-border bg-brand-surface hover:border-brand-gold/20 hover:bg-brand-card'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                group === opt.value ? 'border-brand-gold' : 'border-brand-border'
              }`}>
                {group === opt.value && <div className="w-2 h-2 rounded-full bg-brand-gold" />}
              </div>
              <div>
                <div className={`text-sm font-semibold ${group === opt.value ? 'text-brand-gold' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-brand-muted mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Placement preview */}
      {validReferrer && !isSelf && placement && (
        <div className="bg-brand-surface border border-brand-gold/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-brand-gold">
            <GitBranch size={14} />
            Placement Preview
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-brand-card rounded-lg p-3">
              <div className="text-xs text-brand-muted mb-1">Placed Under</div>
              <div className="font-mono text-xs text-white">{shortAddr(placedAt)}</div>
            </div>
            <div className="bg-brand-card rounded-lg p-3">
              <div className="text-xs text-brand-muted mb-1">Position</div>
              <div className={`text-sm font-bold ${placedSide === 'Left' ? 'text-brand-gold' : 'text-brand-green'}`}>
                {placedSide} Child
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error?.shortMessage || error?.message || 'Transaction failed'}</span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleRegister}
        disabled={!validReferrer || isSelf || isPending || isConfirming}
        className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 text-base"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {isConfirming ? 'Confirming on-chain…' : 'Confirm in wallet…'}
          </>
        ) : (
          <>
            <Users size={16} />
            Register Account
          </>
        )}
      </button>

      <p className="text-xs text-brand-muted text-center">
        Registration is free. You'll need USDT to deposit and activate rewards after registering.
      </p>
    </div>
  )
}
