import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { useAccount } from 'wagmi'
import { isAddress, parseUnits } from 'viem'
import {
  Users, GitBranch, CheckCircle, Loader2, AlertCircle, ArrowRight,
  Copy, Check, ExternalLink, Link2, UserPlus, Share2, Zap,
} from 'lucide-react'
import { FBMXDAO_ADDRESS, FBMXDAO_ABI } from '../../config/contracts'
import { usePlacementPreview } from '../../hooks/useUserData'

const ENTRY_FEE = parseUnits('5', 18)   // 5 USDT minimum required by contract
const MIN_BNB = parseUnits('0.0001', 18) // minimum BNB to cover gas

const ZERO = '0x0000000000000000000000000000000000000000'
const REFERRER_KEY = 'fbmx_referrer'

function shortAddr(addr) {
  if (!addr || addr === ZERO) return 'None'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const PLACEMENT_OPTIONS = [
  { value: 2, label: 'Auto (Weakest Leg)', desc: 'System finds the best open spot for network balance' },
  { value: 0, label: 'Force Left', desc: 'Place at the deepest open left slot under referrer' },
  { value: 1, label: 'Force Right', desc: 'Place at the deepest open right slot under referrer' },
]

// ─── Referral link card (shown when already registered) ───────────────────────
function ReferralCard({ address, user }) {
  const [copied, setCopied] = useState(false)

  // Build link using origin so it works on any deployment
  const refLink = `${window.location.origin}/?ref=${address}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refLink)
    } catch {
      // fallback for environments without clipboard API
      const el = Object.assign(document.createElement('input'), { value: refLink })
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const directCount = user?.directReferralCount ?? 0
  const referralIncome = Number(user?.totalDirect ?? 0).toFixed(2)

  return (
    <div className="space-y-5">

      {/* ── Stats row ── */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 bg-brand-card border border-brand-border rounded-2xl p-4 card-glow">
          <div className="text-xs text-brand-muted mb-1">Direct Referrals</div>
          <div className="font-display font-bold text-2xl text-brand-gold truncate">{directCount}</div>
          <div className="text-xs text-brand-muted mt-1">active members</div>
        </div>
        <div className="flex-1 min-w-0 bg-brand-card border border-brand-border rounded-2xl p-4 card-glow">
          <div className="text-xs text-brand-muted mb-1">Referral Income</div>
          <div className="font-display font-bold text-2xl text-brand-green truncate">${referralIncome}</div>
          <div className="text-xs text-brand-muted mt-1">USDT earned</div>
        </div>
      </div>

      {/* ── Link card ── */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center flex-shrink-0">
            <Link2 size={15} />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-sm">Your Referral Link</h3>
            <p className="text-brand-muted text-xs mt-0.5">
              Anyone who registers through this link becomes your direct referral.
            </p>
          </div>
        </div>

        {/* Link + copy */}
        <div className="flex flex-col xs:flex-row gap-2">
          <input
            readOnly
            value={refLink}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl font-mono text-xs text-brand-muted outline-none cursor-text overflow-hidden text-ellipsis whitespace-nowrap"
          />
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex-shrink-0 ${copied
              ? 'bg-brand-green/10 border border-brand-green/30 text-brand-green'
              : 'btn-gold'
              }`}
          >
            {copied
              ? <><Check size={14} /> Copied!</>
              : <><Copy size={14} /> Copy</>}
          </button>
        </div>

        {/* Address row */}
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs pt-1 border-t border-brand-border">
          <span className="text-brand-muted">Linked to your address</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-white">{shortAddr(address)}</span>
            <a
              href={`https://bscscan.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-muted hover:text-brand-gold transition-all"
              title="View on BSCScan"
            >
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="p-4 bg-brand-surface border border-brand-border rounded-xl space-y-3">
        <div className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">
          How referrals work
        </div>
        <div className="space-y-2.5">
          {[
            { icon: Share2, label: 'Share your referral link', color: 'text-brand-gold' },
            { icon: UserPlus, label: 'Friend registers using your link', color: 'text-blue-400' },
            { icon: Zap, label: 'They deposit USDT to activate rewards', color: 'text-purple-400' },
            { icon: CheckCircle, label: 'You earn 10% of their deposit instantly', color: 'text-brand-green' },
          ].map(({ icon: Icon, label, color }, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-brand-muted">
              <div className="w-6 h-6 rounded-full bg-brand-card border border-brand-border flex items-center justify-center flex-shrink-0">
                <Icon size={11} className={color} />
              </div>
              {label}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RegisterPanel({ onSuccess, isRegistered = false, user, usdtBalanceRaw }) {
  const { address } = useAccount()
  const [searchParams] = useSearchParams()

  // ── BNB balance for gas check ────────────────────────────────────────────
  const { data: bnbData } = useBalance({ address })
  const bnbRaw = bnbData?.value ?? 0n
  const hasEnoughBnb = bnbRaw >= MIN_BNB

  // ── USDT balance check (5 USDT minimum required by contract) ────────────
  const usdtRaw = usdtBalanceRaw ?? 0n
  const hasEnoughUsdt = usdtRaw >= ENTRY_FEE

  // ── Sync ?ref= URL param → localStorage ─────────────────────────────────
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && isAddress(ref)) {
      localStorage.setItem(REFERRER_KEY, ref)
      setReferrer(ref)
    }
  }, [searchParams])

  // ── Form state — pre-fill referrer from localStorage if available ────────
  const [referrer, setReferrer] = useState(() => {
    try { return localStorage.getItem(REFERRER_KEY) || '' } catch { return '' }
  })
  const [group, setGroup] = useState(2) // default: auto

  const validReferrer = referrer.trim() && isAddress(referrer.trim())
  const isSelf = validReferrer && referrer.trim().toLowerCase() === address?.toLowerCase()

  // Placement preview only resolves when referrer is a valid, registered address.
  // usePlacementPreview returns undefined if the address is not a user on-chain,
  // so we use that as the "sponsor not found" signal.
  const { placement } = usePlacementPreview(validReferrer && !isSelf ? referrer.trim() : undefined, group)
  const sponsorFound = !!placement  // undefined = not found / not a user
  const placedAt = placement?.[0]
  const placedSide = placement?.[1] ? 'Right' : 'Left'

  const { writeContract, data: txHash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // All three conditions must pass for the button to be active
  const canRegister = validReferrer && !isSelf && sponsorFound && hasEnoughUsdt && hasEnoughBnb

  const handleRegister = () => {
    if (!canRegister) return
    writeContract({
      address: FBMXDAO_ADDRESS,
      abi: FBMXDAO_ABI,
      functionName: 'register',
      args: [referrer.trim(), group],
    })
  }

  // ── Already registered → show referral card ──────────────────────────────
  if (isRegistered) {
    return <ReferralCard address={address} user={user} />
  }

  // ── Post-registration success screen ────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="text-center py-10 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-brand-green" />
        </div>
        <h3 className="font-display font-bold text-xl text-white mb-2">Registered!</h3>
        <p className="text-brand-muted text-sm mb-6">
          You are now part of the FBMXDAO network. Deposit USDT to activate rewards.
        </p>
        <button onClick={onSuccess} className="btn-gold px-6 py-2.5 rounded-lg text-sm">
          Continue to Deposit <ArrowRight size={14} className="inline ml-1" />
        </button>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">

      {/* Requirements checklist */}
      <div className="p-4 bg-brand-surface border border-brand-border rounded-xl space-y-2">
        <div className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider mb-3">
          Requirements
        </div>
        <RequirementRow
          ok={hasEnoughUsdt}
          label="Minimum 5 USDT in wallet"
          detail={`Your balance: ${(Number(usdtRaw) / 1e18).toFixed(2)} USDT`}
        />
        <RequirementRow
          ok={hasEnoughBnb}
          label="BNB for gas fee"
          detail={`Your balance: ${(Number(bnbRaw) / 1e18).toFixed(4)} BNB`}
        />
        <RequirementRow
          ok={validReferrer && !isSelf && sponsorFound}
          pending={validReferrer && !isSelf && !sponsorFound}
          label="Valid sponsor address"
          detail={
            !validReferrer ? 'Enter a sponsor address below' :
              isSelf ? 'Cannot use your own address' :
                !sponsorFound ? 'Address is not a registered member' :
                  'Sponsor confirmed on-chain'
          }
        />
      </div>

      {/* Referrer address */}
      <div>
        <label className="block text-sm font-medium text-brand-muted mb-2">
          Referrer / Sponsor Address <span className="text-brand-red">*</span>
        </label>
        <input
          type="text"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value.trim())}
          placeholder="0x…"
          className="w-full px-4 py-3 bg-brand-surface border border-brand-border rounded-xl text-white font-mono text-sm
                     focus:border-brand-gold/50 focus:ring-2 focus:ring-brand-gold/10 outline-none transition-all"
        />
        {referrer && !isAddress(referrer.trim()) && (
          <p className="mt-1.5 text-brand-red text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Invalid address format
          </p>
        )}
        {isSelf && (
          <p className="mt-1.5 text-brand-red text-xs flex items-center gap-1">
            <AlertCircle size={11} /> Self-referral is not allowed
          </p>
        )}
        {validReferrer && !isSelf && !sponsorFound && (
          <p className="mt-1.5 text-brand-muted text-xs flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Checking sponsor on-chain…
          </p>
        )}
        {validReferrer && !isSelf && sponsorFound && (
          <p className="mt-1.5 text-brand-green text-xs flex items-center gap-1">
            <CheckCircle size={11} /> Sponsor confirmed
          </p>
        )}
      </div>

      {/* Placement group — disabled until sponsor confirmed */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${sponsorFound ? 'text-brand-muted' : 'text-brand-muted/40'}`}>
          Binary Placement
        </label>
        <div className="space-y-2">
          {PLACEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => sponsorFound && setGroup(opt.value)}
              disabled={!sponsorFound}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${group === opt.value
                ? 'border-brand-gold/40 bg-brand-gold/8 ring-1 ring-brand-gold/20'
                : 'border-brand-border bg-brand-surface hover:border-brand-gold/20 hover:bg-brand-card'
                }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${group === opt.value ? 'border-brand-gold' : 'border-brand-border'
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

      {/* Placement preview — only when sponsor confirmed */}
      {sponsorFound && placement && (
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

      {/* Error */}
      {isError && (
        <div className="flex items-start gap-2 p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg text-brand-red text-xs">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error?.shortMessage || error?.message || 'Transaction failed'}</span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleRegister}
        disabled={!canRegister || isPending || isConfirming}
        className="w-full btn-gold py-4 rounded-xl flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
        Registration requires 5 USDT in your wallet and BNB for gas. Rewards activate after your first deposit.
      </p>
    </div>
  )
}

// ─── Inline helper ────────────────────────────────────────────────────────────
function RequirementRow({ ok, pending = false, label, detail }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">
        {ok ? <CheckCircle size={14} className="text-brand-green" /> :
          pending ? <Loader2 size={14} className="text-brand-gold animate-spin" /> :
            <AlertCircle size={14} className="text-brand-red/70" />}
      </div>
      <div>
        <div className={`text-xs font-semibold ${ok ? 'text-white' : 'text-brand-muted'}`}>{label}</div>
        <div className="text-[11px] text-brand-muted mt-0.5">{detail}</div>
      </div>
    </div>
  )
}
