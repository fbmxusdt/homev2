import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain, useConnect } from 'wagmi'
import {
  Wallet, LayoutDashboard, UserPlus, Coins, Layers, TrendingDown,
  GitBranch, ArrowDownCircle, Network, ChevronDown, RefreshCw,
  AlertTriangle, Users, BarChart3, Zap, Clock, TrendingUp
} from 'lucide-react'
import { BSC_CHAIN_ID } from '../config/wagmi'
import { useUserData } from '../hooks/useUserData'
import RegisterPanel    from '../components/dashboard/RegisterPanel'
import DepositPanel     from '../components/dashboard/DepositPanel'
import UpgradePanel     from '../components/dashboard/UpgradePanel'
import { CollectPassivePanel, CollectBinaryPanel, WithdrawPanel } from '../components/dashboard/CollectWithdrawPanels'
import GenealogyTree    from '../components/dashboard/GenealogyTree'
import { useCountdown } from '../hooks/useCountdown'

const ZERO = '0x0000000000000000000000000000000000000000'

const RANK_COLORS = [
  '#6B7280','#CD7F32','#C0C0C0','#F5A623','#E5E4E2','#00D4AA',
  '#3B82F6','#A855F7','#EC4899','#F97316','#EF4444','#8B5CF6','#06B6D4','#F59E0B','#F5A623'
]
const RANK_LABELS = [
  'Registered','Initiate','Scout','Pioneer','Challenger','Builder',
  'Trailblazer','Guardian','Commander','Vanguard','Warlord','Sovereign','Archon','Titan','Fortress'
]

const ALL_TABS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard, requiresReg: false },
  { id: 'register',  label: 'Register',  icon: UserPlus,        requiresReg: false, hideIfReg: true },
  { id: 'deposit',   label: 'Deposit',   icon: Coins,           requiresReg: true },
  { id: 'upgrade',   label: 'Upgrade',   icon: Layers,          requiresReg: true },
  { id: 'passive',   label: 'Passive',   icon: TrendingDown,    requiresReg: true },
  { id: 'binary',    label: 'Binary',    icon: GitBranch,       requiresReg: true },
  { id: 'withdraw',  label: 'Withdraw',  icon: ArrowDownCircle, requiresReg: true },
  { id: 'tree',      label: 'Genealogy', icon: Users,           requiresReg: true },
]

function StatCard({ label, value, sub, icon: Icon, color = 'gold', pulse }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5 card-glow transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          color === 'gold'  ? 'bg-brand-gold/10 text-brand-gold' :
          color === 'green' ? 'bg-brand-green/10 text-brand-green' :
          color === 'blue'  ? 'bg-blue-500/10 text-blue-400' :
                              'bg-purple-500/10 text-purple-400'
        }`}>
          <Icon size={16} />
        </div>
        {pulse && <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse mt-1" />}
      </div>
      <div className="text-xl font-mono font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-brand-muted">{label}</div>
      {sub && <div className="text-[11px] text-brand-gold mt-1">{sub}</div>}
    </div>
  )
}

function LiveCooldownRow({ label, endsAt, color }) {
  const { formatted, isActive } = useCountdown(endsAt)
  return (
    <div className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
      <span className="text-xs text-brand-muted">{label}</span>
      <span className={`text-xs font-mono font-bold ${isActive ? (color === 'red' ? 'text-brand-red' : 'text-amber-400') : 'text-brand-green'}`}>
        {isActive ? formatted : 'Ready ✓'}
      </span>
    </div>
  )
}

// ── Connect / wrong network screens ──────────────────────────────────────────
function ConnectPrompt() {
  const { connect, connectors } = useConnect()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-6 animate-pulse-gold">
          <Wallet size={32} className="text-brand-gold" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-3">Connect Your Wallet</h2>
        <p className="text-brand-muted text-sm mb-8 leading-relaxed">
          Connect a BSC-compatible wallet to access the FBMXDAO dashboard and interact with the protocol.
        </p>
        <div className="relative inline-block">
          <button onClick={() => setOpen(!open)}
            className="btn-gold px-8 py-3.5 rounded-xl flex items-center gap-2 mx-auto">
            <Wallet size={16} />Connect Wallet
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-card z-10">
              {connectors.map((c) => (
                <button key={c.uid} onClick={() => { connect({ connector: c }); setOpen(false) }}
                  className="w-full px-4 py-3 text-sm text-brand-muted hover:text-white hover:bg-brand-gold/10 transition-colors text-left border-b border-brand-border last:border-0">
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
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-brand-red" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-3">Wrong Network</h2>
        <p className="text-brand-muted text-sm mb-8">FBMXDAO is deployed on Binance Smart Chain. Switch to continue.</p>
        <button onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
          className="btn-gold px-8 py-3.5 rounded-xl flex items-center gap-2 mx-auto">
          <Network size={16} />Switch to BSC
        </button>
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { address, isConnected, chain } = useAccount()
  const [activeTab, setActiveTab] = useState('overview')

  const {
    user, isLoading, refetch, isRegistered,
    usdtBalance, fbmxBalance,
    usdtBalanceRaw, fbmxBalanceRaw,
    usdtAllowanceRaw, fbmxAllowanceRaw,
    isPassiveCooldown,  passiveCooldownEnds,
    isBinaryCooldown,   binaryCooldownEnds,
    isWithdrawCooldown, withdrawCooldownEnds,
    isGlobalCooldown,   globalCooldownEnds,
    txCooldownSecs,
    stats,
  } = useUserData()

  const wrongNetwork = isConnected && chain?.id !== BSC_CHAIN_ID

  useEffect(() => {
    if (user && !isRegistered && activeTab === 'overview') setActiveTab('register')
  }, [isRegistered])

  if (!isConnected)  return <ConnectPrompt />
  if (wrongNetwork)  return <WrongNetworkBanner />

  const tabs = ALL_TABS.filter((t) => {
    if (t.hideIfReg && isRegistered) return false
    if (t.requiresReg && !isRegistered) return false
    return true
  })

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-black text-3xl text-white">Dashboard</h1>
            <p className="text-brand-muted text-sm mt-1 font-mono">
              {address?.slice(0, 8)}…{address?.slice(-6)}
              {isRegistered && (
                <span className="ml-3 px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green text-[11px] border border-brand-green/20 font-sans">
                  ✓ Registered
                </span>
              )}
            </p>
          </div>
          <button onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-border hover:border-brand-gold/30 bg-brand-surface hover:bg-brand-card transition-all text-sm text-brand-muted hover:text-white">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>

        {/* Stat cards (only when registered) */}
        {isRegistered && user && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Wallet Balance"   value={`$${Number(user.walletBalance).toFixed(2)}`}
              sub={`Capping: $${Number(user.capping).toFixed(2)}`} icon={Coins} color="gold" />
            <StatCard label="Passive Reward"   value={`$${Number(user.passiveReward).toFixed(4)}`}
              sub={`Equity: $${Number(user.totalEquity).toFixed(2)}`} icon={TrendingDown} color="gold"
              pulse={!isPassiveCooldown} />
            <StatCard label="Binary (weaker)"  value={`$${Math.min(Number(user.leftVolume), Number(user.rightVolume)).toFixed(4)}`}
              sub={`L $${Number(user.leftVolume).toFixed(2)} / R $${Number(user.rightVolume).toFixed(2)}`}
              icon={GitBranch} color="green" pulse={!isBinaryCooldown} />
            <StatCard label="FBMX In-Contract" value={`${Number(user.fbmxInContract).toFixed(4)}`}
              sub="Utility fee balance" icon={Zap} color="blue" />
          </div>
        )}

        {/* Layout */}
        <div className="grid lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Nav */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-2 space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => {
                const hasCooldown =
                  (id === 'passive'  && isPassiveCooldown)  ||
                  (id === 'binary'   && isBinaryCooldown)   ||
                  (id === 'withdraw' && isWithdrawCooldown)
                return (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                      activeTab === id
                        ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                        : 'text-brand-muted hover:text-white hover:bg-brand-surface'
                    }`}>
                    <Icon size={15} />
                    <span className="flex-1">{label}</span>
                    {hasCooldown && <Clock size={11} className="text-amber-400 animate-pulse" />}
                  </button>
                )
              })}
            </div>

            {/* Token balances */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-4 space-y-2">
              <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Wallet Balances</div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-muted">USDT</span>
                <span className="font-mono text-white">{Number(usdtBalance).toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-muted">FBMX</span>
                <span className="font-mono text-brand-gold">{Number(fbmxBalance).toFixed(4)}</span>
              </div>
              {user && (
                <>
                  <div className="border-t border-brand-border pt-2 flex justify-between text-xs">
                    <span className="text-brand-muted">FBMX (contract)</span>
                    <span className="font-mono text-brand-gold">{Number(user.fbmxInContract).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-brand-muted">Total Income</span>
                    <span className="font-mono text-white">${Number(user.totalIncome).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Protocol stats */}
            {stats && (
              <div className="bg-brand-card border border-brand-border rounded-2xl p-4 space-y-2">
                <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Protocol Stats</div>
                {[
                  ['Total Users',      stats.totalUsers.toLocaleString()],
                  ['Total Deposited',  `$${Number(stats.totalDeposits).toLocaleString()}`],
                  ['Total Rewards',    `$${Number(stats.totalRewards).toLocaleString()}`],
                  ['USDT in Contract', `$${Number(stats.totalUSDT).toLocaleString()}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-brand-muted">{k}</span>
                    <span className="font-mono font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cooldowns */}
            {isRegistered && (
              <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
                <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock size={11} /> Cooldowns
                </div>
                <LiveCooldownRow label="Passive (24h)"   endsAt={passiveCooldownEnds}  color="amber" />
                <LiveCooldownRow label="Binary (24h)"    endsAt={binaryCooldownEnds}   color="amber" />
                <LiveCooldownRow label="Withdraw (24h)"  endsAt={withdrawCooldownEnds} color="amber" />
                <LiveCooldownRow label={`Global lock (${txCooldownSecs}s)`} endsAt={globalCooldownEnds} color="red"   />
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="lg:col-span-3">
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 min-h-[420px]">

              {/* OVERVIEW ─────────────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h2 className="font-display font-bold text-xl text-white">Account Overview</h2>
                  {!isRegistered ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-4">
                        <UserPlus size={24} className="text-brand-gold" />
                      </div>
                      <h3 className="font-display font-bold text-lg text-white mb-2">Not Yet Registered</h3>
                      <p className="text-brand-muted text-sm mb-5">Join FBMXDAO to start earning passive and binary rewards.</p>
                      <button onClick={() => setActiveTab('register')} className="btn-gold px-6 py-2.5 rounded-lg text-sm">
                        Register Now
                      </button>
                    </div>
                  ) : user && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Rank card */}
                      <div className="col-span-2 bg-brand-surface border border-brand-border rounded-xl p-5 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-3xl text-white flex-shrink-0 shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${RANK_COLORS[user.level]}, ${RANK_COLORS[user.level]}88)` }}>
                          {user.level}
                        </div>
                        <div className="flex-1">
                          <div className="text-brand-muted text-xs mb-1">Membership Rank</div>
                          <div className="font-display font-bold text-white text-xl">{RANK_LABELS[user.level] ?? `Rank ${user.level}`}</div>
                          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs">
                            <span className="text-brand-gold">Passive: 1–8%/day (dynamic)</span>
                            <span className="text-brand-muted">·</span>
                            <span className="text-brand-muted">Direct refs: <span className="text-white">{Number(user.totalDirect).toFixed(2)} USDT</span></span>
                          </div>
                        </div>
                        <button onClick={() => setActiveTab('upgrade')} className="btn-gold px-4 py-2 rounded-lg text-xs flex-shrink-0">
                          Upgrade
                        </button>
                      </div>

                      {/* Binary volumes */}
                      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                        <div className="text-xs text-brand-muted mb-3 flex items-center gap-1.5"><GitBranch size={12} />Binary Legs</div>
                        {[
                          { label: 'Left Leg',  vol: user.leftVolume,  color: 'bg-brand-gold'  },
                          { label: 'Right Leg', vol: user.rightVolume, color: 'bg-brand-green' },
                        ].map(({ label, vol, color }) => {
                          const total = Number(user.leftVolume) + Number(user.rightVolume)
                          const pct   = total > 0 ? (Number(vol) / total) * 100 : 50
                          return (
                            <div key={label} className="mb-3 last:mb-0">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-brand-muted">{label}</span>
                                <span className="font-mono text-white">${Number(vol).toFixed(2)}</span>
                              </div>
                              <div className="h-1.5 bg-brand-border rounded-full overflow-hidden">
                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Network info */}
                      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                        <div className="text-xs text-brand-muted mb-3 flex items-center gap-1.5"><Users size={12} />Network</div>
                        {[
                          ['Sponsor',     user.parent     && !isZeroAddr(user.parent)     ? shortAddr(user.parent)     : '—'],
                          ['Agent',       user.agent      && !isZeroAddr(user.agent)      ? shortAddr(user.agent)      : '—'],
                          ['Left Child',  user.leftAddress && !isZeroAddr(user.leftAddress)  ? shortAddr(user.leftAddress)  : 'None'],
                          ['Right Child', user.rightAddress && !isZeroAddr(user.rightAddress) ? shortAddr(user.rightAddress) : 'None'],
                          ['Upgrade Cost', `${user.upgradeAmountFmt} USDT`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs py-1 border-b border-brand-border last:border-0">
                            <span className="text-brand-muted">{k}</span>
                            <span className="font-mono text-white">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* REGISTER */}
              {activeTab === 'register' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Register</h2>
                    <p className="text-brand-muted text-sm mt-1">Enter a sponsor address and choose your binary placement.</p>
                  </div>
                  <RegisterPanel onSuccess={() => { setActiveTab('deposit'); refetch() }} />
                </div>
              )}

              {/* DEPOSIT */}
              {activeTab === 'deposit' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Deposit</h2>
                    <p className="text-brand-muted text-sm mt-1">
                      Deposit USDT to your wallet balance, or FBMX to cover transaction fees.
                    </p>
                  </div>
                  <DepositPanel
                    user={user}
                    hasActivated={user?.hasActivated}
                    usdtBalance={usdtBalance}        usdtBalanceRaw={usdtBalanceRaw}
                    fbmxBalance={fbmxBalance}        fbmxBalanceRaw={fbmxBalanceRaw}
                    usdtAllowanceRaw={usdtAllowanceRaw}
                    fbmxAllowanceRaw={fbmxAllowanceRaw}
                    onSuccess={() => { refetch() }}
                  />
                </div>
              )}

              {/* UPGRADE */}
              {activeTab === 'upgrade' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Activate Rank</h2>
                    <p className="text-brand-muted text-sm mt-1">Advance your rank to unlock higher capping and rewards.</p>
                  </div>
                  <UpgradePanel user={user} onSuccess={() => { refetch(); setActiveTab('overview') }} />
                </div>
              )}

              {/* PASSIVE */}
              {activeTab === 'passive' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Collect Passive Rewards</h2>
                    <p className="text-brand-muted text-sm mt-1">Daily passive income based on your equity and referral ratio.</p>
                  </div>
                  <CollectPassivePanel
                    user={user}
                    passiveCooldownEnds={passiveCooldownEnds}
                    globalCooldownEnds={globalCooldownEnds}
                    txCooldownSecs={txCooldownSecs}
                    onSuccess={refetch}
                  />
                </div>
              )}

              {/* BINARY */}
              {activeTab === 'binary' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Collect Binary Rewards</h2>
                    <p className="text-brand-muted text-sm mt-1">Collect your weaker-leg binary volume once every 24 hours.</p>
                  </div>
                  <CollectBinaryPanel
                    user={user}
                    binaryCooldownEnds={binaryCooldownEnds}
                    globalCooldownEnds={globalCooldownEnds}
                    txCooldownSecs={txCooldownSecs}
                    onSuccess={refetch}
                  />
                </div>
              )}

              {/* WITHDRAW */}
              {activeTab === 'withdraw' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Withdraw</h2>
                    <p className="text-brand-muted text-sm mt-1">
                      Withdraw using a fixed tier amount based on your rank level.
                    </p>
                  </div>
                  <WithdrawPanel
                    user={user}
                    withdrawCooldownEnds={withdrawCooldownEnds}
                    globalCooldownEnds={globalCooldownEnds}
                    txCooldownSecs={txCooldownSecs}
                    onSuccess={refetch}
                  />
                </div>
              )}

              {/* TREE */}
              {activeTab === 'tree' && (
                <div>
                  <div className="mb-6">
                    <h2 className="font-display font-bold text-xl text-white">Genealogy Tree</h2>
                    <p className="text-brand-muted text-sm mt-1">Explore your binary matrix and affiliate referral network.</p>
                  </div>
                  <GenealogyTree address={address} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function isZeroAddr(addr) {
  return !addr || addr === '0x0000000000000000000000000000000000000000'
}
function shortAddr(addr) {
  return addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : '—'
}
