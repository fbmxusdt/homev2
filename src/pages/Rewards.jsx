import { useState } from 'react'
import {
  Coins, GitBranch, Users, TrendingUp, Award, Layers, Clock,
  Zap, ArrowRight, ChevronDown, ChevronUp, Info, Lock,
  BarChart3, RefreshCw, Shield, Wallet, Flame, Star
} from 'lucide-react'
import { Link } from 'react-router-dom'

// ─── Data ──────────────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 0,  name: 'Registered',   depositUsdt: 0,      depositFmt: '—',          color: '#6B7280' },
  { level: 1,  name: 'Initiate',     depositUsdt: 5,      depositFmt: '$5',          color: '#CD7F32' },
  { level: 2,  name: 'Scout',        depositUsdt: 10,     depositFmt: '$10',         color: '#C0C0C0' },
  { level: 3,  name: 'Pioneer',      depositUsdt: 20,     depositFmt: '$20',         color: '#F5A623' },
  { level: 4,  name: 'Challenger',   depositUsdt: 40,     depositFmt: '$40',         color: '#E5E4E2' },
  { level: 5,  name: 'Builder',      depositUsdt: 80,     depositFmt: '$80',         color: '#00D4AA' },
  { level: 6,  name: 'Trailblazer',  depositUsdt: 160,    depositFmt: '$160',        color: '#3B82F6' },
  { level: 7,  name: 'Guardian',     depositUsdt: 320,    depositFmt: '$320',        color: '#A855F7' },
  { level: 8,  name: 'Commander',    depositUsdt: 640,    depositFmt: '$640',        color: '#EC4899' },
  { level: 9,  name: 'Vanguard',     depositUsdt: 1280,   depositFmt: '$1,280',      color: '#F97316' },
  { level: 10, name: 'Warlord',      depositUsdt: 2560,   depositFmt: '$2,560',      color: '#EF4444' },
  { level: 11, name: 'Sovereign',    depositUsdt: 5120,   depositFmt: '$5,120',      color: '#8B5CF6' },
  { level: 12, name: 'Archon',       depositUsdt: 10240,  depositFmt: '$10,240',     color: '#06B6D4' },
  { level: 13, name: 'Titan',        depositUsdt: 20480,  depositFmt: '$20,480',     color: '#F59E0B' },
  { level: 14, name: 'Fortress',     depositUsdt: 40960,  depositFmt: '$40,960',     color: '#F5A623' },
]

const JUMP_COSTS = [
  { target: 1,  cost: '$5',      savings: '—',         desc: 'Same as normal' },
  { target: 2,  cost: '$15',     savings: '0',         desc: 'Covers L0→1 + L1→2' },
  { target: 3,  cost: '$35',     savings: '—',         desc: 'Covers 3 activations' },
  { target: 4,  cost: '$75',     savings: '—',         desc: 'Covers 4 activations' },
  { target: 5,  cost: '$155',    savings: '—',         desc: 'Covers 5 activations' },
  { target: 7,  cost: '$635',    savings: '—',         desc: 'Covers 7 activations' },
  { target: 10, cost: '$5,115',  savings: '—',         desc: 'Covers 10 activations' },
  { target: 14, cost: '$81,915', savings: '—',         desc: 'Instant Fortress rank' },
]

const ALLOCATIONS = [
  { label: 'Direct Referral Reward', pct: '10%', color: 'brand-gold',  desc: 'Credited to direct sponsor\'s wallet (capping-gated)' },
  { label: 'Binary Volume',          pct: '10%', color: 'brand-green', desc: 'Distributed up tree (up to 3 qualifying parents)' },
  { label: 'Master Agent Reward',    pct: '5%',  color: 'amber-400',   desc: 'Paid to the master agent inherited from sponsor chain' },
  { label: 'Marketing Wallet',       pct: '5%',  color: 'blue-400',    desc: 'Sent to marketing multi-sig for growth spend' },
  { label: 'Project Wallet',         pct: '10%', color: 'purple-400',  desc: 'Sent to project treasury for development' },
  { label: 'Liquidity Pool',         pct: '10%', color: 'cyan-400',    desc: 'Added to FBMX/USDT PancakeSwap V3 pool' },
  { label: 'Rewards Pool',           pct: '50%', color: 'brand-gold',  desc: 'Stays in contract; funds all future passive / binary rewards' },
]

const WITHDRAW_TIERS = [
  { amount: '$15',    minLevel: 1,  pct: '—' },
  { amount: '$50',    minLevel: 4,  pct: '—' },
  { amount: '$100',   minLevel: 7,  pct: '—' },
  { amount: '$500',   minLevel: 10, pct: '—' },
  { amount: '$1,000', minLevel: 13, pct: '—' },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="text-brand-gold font-mono text-sm tracking-widest uppercase mb-3 font-medium">
      {children}
    </p>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-4">
      {children}
    </h2>
  )
}

function InfoBox({ children }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-brand-gold/5 border border-brand-gold/20 rounded-xl">
      <Info size={15} className="text-brand-gold flex-shrink-0 mt-0.5" />
      <p className="text-brand-muted text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function Accordion({ title, icon: Icon, color = 'gold', children }) {
  const [open, setOpen] = useState(false)
  const colorMap = {
    gold:   'bg-brand-gold/10 text-brand-gold  border-brand-gold/20',
    green:  'bg-brand-green/10 text-brand-green border-brand-green/20',
    amber:  'bg-amber-500/10 text-amber-400  border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }
  return (
    <div className={`border rounded-xl overflow-hidden ${colorMap[color]}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} />
          <span className="font-display font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="border-t border-white/10 bg-brand-dark/60 px-5 py-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Rewards() {
  return (
    <div className="pt-16 overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative py-24 flex flex-col items-center justify-center text-center px-4 animate-grid">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-brand-gold/4 blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-gold/30 bg-brand-gold/5 text-brand-gold text-sm font-medium mb-8">
            <BarChart3 size={14} />
            Compensation Plan — FBMXDAO v2
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl leading-tight mb-6">
            <span className="text-white">How the </span>
            <span className="gold-text">Protocol Pays</span>
          </h1>
          <p className="text-brand-muted text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Three on-chain revenue streams, a 14-level rank system, and a transparent
            distribution formula — every USDT flow is enforced by immutable smart contract logic.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="btn-gold px-6 py-3 rounded-xl flex items-center gap-2 justify-center">
              Open Dashboard <ArrowRight size={16} />
            </Link>
            <a
              href="#structure"
              className="px-6 py-3 rounded-xl border border-brand-border hover:border-brand-gold/40 bg-brand-surface text-white text-sm transition-all flex items-center gap-2 justify-center"
            >
              Explore Plan <ChevronDown size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ── Three Streams Overview ── */}
      <section id="structure" className="max-w-7xl mx-auto px-4 pb-24">
        <div className="text-center mb-12">
          <SectionLabel>Revenue Streams</SectionLabel>
          <SectionHeading>Three Ways to <span className="gold-text">Earn</span></SectionHeading>
          <p className="text-brand-muted max-w-xl mx-auto">
            Every participant can earn from passive income, binary volume, and affiliate commissions — simultaneously.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Coins,
              color: 'gold',
              title: 'Passive Rewards',
              rate: '1% – 8% / day',
              desc: 'Daily passive income on your total deposited equity. Rate scales dynamically from 1% up to 8% per day based on the ratio of your referral income to total equity.',
              bullets: [
                'Collectable once every 24 hours',
                'Rate = referralIncome ÷ totalEquity (capped 1–8%)',
                'Equity decays as totalIncome grows (encourages re-investment)',
                'Burns 0.05 FBMX per collection',
              ],
            },
            {
              icon: GitBranch,
              color: 'green',
              title: 'Binary Rewards',
              rate: '10% of weaker leg',
              desc: 'Each user sits inside a binary tree. Volume flows up both legs. You earn 10% of your weaker leg\'s accumulated volume, claimable once per day.',
              bullets: [
                'Binary tree — left child and right child per node',
                'Weaker leg = min(leftVolume, rightVolume)',
                'Claim once every 24 hours',
                'Burns 0.05 FBMX per collection',
              ],
            },
            {
              icon: Users,
              color: 'amber',
              title: 'Referral & Agent',
              rate: '10% direct + 5% agent',
              desc: 'When someone you referred deposits or upgrades, you receive 10% of their deposit directly into your wallet balance. The master agent in your chain earns an additional 5%.',
              bullets: [
                '10% direct referral reward (credited instantly)',
                '5% agent override (master agent in upline)',
                'Both gated by capping limit',
                'Referral tree tracks genealogy on-chain',
              ],
            },
          ].map((s, i) => {
            const Icon = s.icon
            const iconClass =
              s.color === 'gold'  ? 'bg-brand-gold/10 text-brand-gold'  :
              s.color === 'green' ? 'bg-brand-green/10 text-brand-green' :
                                    'bg-amber-500/10 text-amber-400'
            const rateClass =
              s.color === 'gold'  ? 'text-brand-gold'  :
              s.color === 'green' ? 'text-brand-green' :
                                    'text-amber-400'
            return (
              <div key={i} className="bg-brand-card border border-brand-border rounded-2xl p-8 card-glow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${iconClass}`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-1">{s.title}</h3>
                <p className={`text-sm font-semibold mb-4 ${rateClass}`}>{s.rate}</p>
                <p className="text-brand-muted text-sm leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0 mt-1.5" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Level / Rank Table ── */}
      <section className="border-y border-brand-border bg-brand-surface py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionLabel>Rank System</SectionLabel>
            <SectionHeading>14 Levels, <span className="gold-text">Geometric Deposits</span></SectionHeading>
            <p className="text-brand-muted max-w-xl mx-auto">
              Each activation doubles the deposit. Higher levels unlock larger withdrawal tiers and accumulate more equity for passive rewards.
            </p>
          </div>

          <InfoBox>
            Deposit formula: <strong className="text-white">entryFee × 2^currentLevel</strong> where entryFee = $5 USDT.
            Capping is <strong className="text-white">deposit × 3</strong> for levels 1–14. Only level 15+ (post-max activations) use deposit × 2.
          </InfoBox>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-muted">
                  <th className="text-left py-3 px-4 font-medium">Level</th>
                  <th className="text-left py-3 px-4 font-medium">Rank Name</th>
                  <th className="text-right py-3 px-4 font-medium">Activation Cost</th>
                  <th className="text-right py-3 px-4 font-medium">Capping Added</th>
                  <th className="text-right py-3 px-4 font-medium hidden md:table-cell">Cumulative Cost</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.filter(l => l.level > 0).map((lv) => {
                  const cappingMult = lv.level > 14 ? 2 : 3
                  const capping = lv.depositUsdt * cappingMult
                  // cumulative: 5 * (2^level - 1)
                  const cumulative = 5 * ((2 ** lv.level) - 1)
                  return (
                    <tr key={lv.level} className="border-b border-brand-border/40 hover:bg-brand-card/50 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-brand-dark font-display font-bold text-xs"
                          style={{ background: lv.color }}
                        >
                          {lv.level}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">{lv.name}</td>
                      <td className="py-3 px-4 text-right font-mono text-brand-gold">{lv.depositFmt}</td>
                      <td className="py-3 px-4 text-right font-mono text-brand-green">${(capping).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-brand-muted hidden md:table-cell">${cumulative.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Passive Reward Deep Dive ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionLabel>Passive Income</SectionLabel>
            <SectionHeading>Dynamic <span className="gold-text">Daily Rate</span></SectionHeading>
            <p className="text-brand-muted leading-relaxed mb-6">
              Your passive yield rate is not fixed — it adapts to how actively you build your referral network.
              The more referral income you earn relative to your deposited equity, the higher your daily percentage.
            </p>
            <div className="space-y-4">
              <InfoBox>
                Rate formula: <strong className="text-white">passiveRate = referralIncome ÷ totalEquity × 10</strong> (in basis points),
                clamped between <strong className="text-white">100 bps (1%)</strong> and <strong className="text-white">800 bps (8%)</strong> per day.
              </InfoBox>
              <InfoBox>
                Active equity decays as your <strong className="text-white">totalIncome</strong> grows.
                Each deposit tier is removed from equity once you've collected 3× that tier amount — encouraging continuous re-investment.
              </InfoBox>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Minimum Rate', value: '1% / day', icon: TrendingUp, color: 'text-brand-green' },
              { label: 'Maximum Rate', value: '8% / day', icon: Zap,        color: 'text-brand-gold' },
              { label: 'Cooldown',     value: '24 hours', icon: Clock,       color: 'text-blue-400'  },
              { label: 'FBMX Fee',     value: '0.05 FBMX', icon: Flame,     color: 'text-amber-400' },
              { label: 'Rate Driver',  value: 'Referral income / equity', icon: BarChart3, color: 'text-brand-muted' },
              { label: 'Equity Base',  value: 'Decays with income', icon: RefreshCw,  color: 'text-brand-muted' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-4">
                  <Icon size={16} className={`mb-2 ${item.color}`} />
                  <div className="text-xs text-brand-muted mb-1">{item.label}</div>
                  <div className="font-display font-bold text-white text-sm">{item.value}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Binary Tree Deep Dive ── */}
      <section className="border-y border-brand-border bg-brand-surface py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionLabel>Binary Matrix</SectionLabel>
            <SectionHeading>How the <span className="gold-text">Binary Tree</span> Works</SectionHeading>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <p className="text-brand-muted leading-relaxed">
                Every member occupies one node in a binary tree. Each node has a <strong className="text-white">left child</strong> and
                a <strong className="text-white">right child</strong>. When someone deposits or activates,
                10% of their deposit flows as <em>volume</em> up the tree to qualifying parents.
              </p>
              <div className="space-y-3">
                {[
                  { step: '1', title: 'Volume flows upward', desc: 'Each deposit sends 10% as binary volume to up to 3 qualifying parents up the tree.' },
                  { step: '2', title: 'Qualifying parent rules', desc: 'A parent qualifies only if their rank level is strictly higher than the depositing member\'s current level, and their capping has room.' },
                  { step: '3', title: 'Volume credited per leg', desc: 'Volume is credited to the child\'s leg slot (left if you\'re the left child, right otherwise), incrementing that parent\'s leg volume.' },
                  { step: '4', title: 'Collect weaker-leg rewards', desc: 'You earn rewards equal to 10% of the weaker-leg volume. The weaker leg is consumed on collection, balancing the tree.' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4 p-4 bg-brand-card border border-brand-border rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-brand-green/10 text-brand-green font-display font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                      <div className="text-brand-muted text-xs leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CSS Binary Tree Diagram */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
              <p className="text-brand-muted text-xs font-mono mb-6 text-center tracking-widest uppercase">Binary Tree Structure</p>
              <div className="flex flex-col items-center gap-2 select-none">
                {/* Root */}
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-brand-gold/20 border-2 border-brand-gold flex items-center justify-center">
                    <span className="font-display font-bold text-brand-gold text-xs">L14</span>
                  </div>
                  <span className="text-xs text-brand-muted mt-1">Sponsor</span>
                </div>
                {/* Connector */}
                <div className="flex items-center gap-24">
                  <div className="flex flex-col items-end">
                    <div className="w-12 h-px bg-brand-border" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="w-12 h-px bg-brand-border" />
                  </div>
                </div>
                {/* Level 2 */}
                <div className="flex gap-20">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-brand-green/20 border-2 border-brand-green flex items-center justify-center">
                      <span className="font-display font-bold text-brand-green text-xs">L7</span>
                    </div>
                    <span className="text-xs text-brand-muted mt-1">Left</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-brand-green/20 border-2 border-brand-green flex items-center justify-center">
                      <span className="font-display font-bold text-brand-green text-xs">L5</span>
                    </div>
                    <span className="text-xs text-brand-muted mt-1">Right</span>
                  </div>
                </div>
                {/* Level 3 — tiny nodes */}
                <div className="flex gap-6">
                  {['L3','L2','L4','L1'].map((lbl, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center
                        ${i < 2 ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-purple-500/10 border-purple-500/40 text-purple-400'}`}
                      >
                        <span className="font-display font-bold text-xs">{lbl}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-brand-muted text-center mt-4 max-w-xs leading-relaxed">
                  When a L1 member activates, volume flows up to L2, L4, L5 (first 3 qualifying parents with higher rank).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deposit Distribution ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-12">
          <SectionLabel>Deposit Allocation</SectionLabel>
          <SectionHeading>Where Every <span className="gold-text">Dollar Goes</span></SectionHeading>
          <p className="text-brand-muted max-w-xl mx-auto">
            Each USDT deposit is atomically split across six destinations in the same transaction.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Donut-style bar */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
            <div className="space-y-3">
              {[
                { label: 'Rewards Pool (stays in contract)',  pct: 50, bar: 'bg-brand-gold'    },
                { label: 'Direct Referral Reward',            pct: 10, bar: 'bg-brand-green'   },
                { label: 'Binary Volume',                     pct: 10, bar: 'bg-blue-400'      },
                { label: 'Project Wallet',                    pct: 10, bar: 'bg-purple-400'    },
                { label: 'Liquidity Pool',                    pct: 10, bar: 'bg-cyan-400'      },
                { label: 'Marketing Wallet',                  pct:  5, bar: 'bg-amber-400'     },
                { label: 'Master Agent Reward',               pct:  5, bar: 'bg-pink-400'      },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-brand-muted">{item.label}</span>
                    <span className="font-mono font-bold text-white">{item.pct}%</span>
                  </div>
                  <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.bar}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation cards */}
          <div className="space-y-3">
            {ALLOCATIONS.map((a, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-brand-card border border-brand-border rounded-xl">
                <div className={`w-10 h-10 rounded-lg bg-brand-surface flex items-center justify-center flex-shrink-0 font-display font-bold text-sm text-${a.color}`}>
                  {a.pct}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{a.label}</div>
                  <div className="text-brand-muted text-xs mt-0.5 leading-relaxed">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Withdrawal Tiers ── */}
      <section className="border-y border-brand-border bg-brand-surface py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionLabel>Withdrawals</SectionLabel>
            <SectionHeading>Tiered <span className="gold-text">Withdrawal System</span></SectionHeading>
            <p className="text-brand-muted max-w-xl mx-auto">
              Withdrawals are fixed-amount tiers unlocked by rank. Higher levels unlock larger single withdrawals.
            </p>
          </div>

          <InfoBox>
            Every withdrawal burns <strong className="text-white">0.05 FBMX</strong> from your in-contract token balance
            and is subject to the <strong className="text-white">24-hour wallet cooldown</strong>.
            Withdrawal amount must match a valid tier exactly.
          </InfoBox>

          <div className="mt-8 grid sm:grid-cols-5 gap-4">
            {WITHDRAW_TIERS.map((tier) => (
              <div
                key={tier.amount}
                className="bg-brand-card border border-brand-border rounded-xl p-5 text-center hover:border-brand-gold/30 transition-all"
              >
                <Wallet size={20} className="text-brand-gold mx-auto mb-3" />
                <div className="font-display font-bold text-2xl text-white mb-1">{tier.amount}</div>
                <div className="text-brand-muted text-xs">Requires Level {tier.minLevel}+</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── V2: Jump Activation ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-12">
          <SectionLabel>V2 Feature</SectionLabel>
          <SectionHeading>First-Activation <span className="gold-text">Level Jump</span></SectionHeading>
          <p className="text-brand-muted max-w-2xl mx-auto">
            New members can skip directly to any rank on their very first activation by paying the cumulative deposit cost upfront.
            Only available once — all future upgrades follow the standard sequential path.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <div className="bg-brand-card border border-brand-gold/20 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center">
                    <Zap size={18} />
                  </div>
                  <h3 className="font-display font-bold text-white">Jump Activation Formula</h3>
                </div>
                <div className="bg-brand-surface rounded-xl p-4 font-mono text-sm mb-4">
                  <div className="text-brand-muted mb-1">// cost to jump to level N:</div>
                  <div className="text-brand-gold">cost = entryFee × (2<sup>N</sup> − 1)</div>
                  <div className="text-brand-muted mt-2 mb-1">// example (entryFee = $5):</div>
                  <div className="text-white">N=1  →  $5 × (2 − 1)  =  <span className="text-brand-green">$5</span></div>
                  <div className="text-white">N=4  →  $5 × (16 − 1) =  <span className="text-brand-green">$75</span></div>
                  <div className="text-white">N=7  →  $5 × (128−1)  =  <span className="text-brand-green">$635</span></div>
                </div>
                <InfoBox>
                  The formula is the sum of all sequential deposits: L0→1 + L1→2 + … + L(N-1)→N.
                  It is a geometric series: <strong className="text-white">5(1 + 2 + 4 + … + 2^(N-1)) = 5(2^N − 1)</strong>.
                </InfoBox>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { icon: Shield,  title: 'One-time only',         desc: 'Jump is locked after first activation. hasActivated flag is set permanently.' },
                { icon: Award,   title: 'Full capping credit',   desc: 'Capping is calculated as if you had activated each level sequentially — no reduction in earning capacity.' },
                { icon: Star,    title: 'Instant rank rewards',  desc: 'All referral and binary rewards are distributed once with the total amount. Linear equivalence holds.' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-start gap-4 p-4 bg-brand-card border border-brand-border rounded-xl">
                    <Icon size={16} className="text-brand-gold flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white text-sm mb-0.5">{item.title}</div>
                      <div className="text-brand-muted text-xs leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Jump cost table */}
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-border">
              <h3 className="font-display font-bold text-white">Jump Cost Reference</h3>
              <p className="text-brand-muted text-xs mt-0.5">All costs in USDT. entryFee = $5</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-muted text-xs">
                  <th className="text-left py-3 px-5 font-medium">Target Level</th>
                  <th className="text-left py-3 px-5 font-medium">Rank</th>
                  <th className="text-right py-3 px-5 font-medium">Jump Cost</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.filter(l => l.level > 0).map((lv) => {
                  const cost = 5 * ((2 ** lv.level) - 1)
                  return (
                    <tr key={lv.level} className="border-b border-brand-border/30 hover:bg-brand-surface/50 transition-colors">
                      <td className="py-3 px-5">
                        <div
                          className="w-6 h-6 rounded-full inline-flex items-center justify-center text-brand-dark font-bold text-xs"
                          style={{ background: lv.color }}
                        >
                          {lv.level}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-white font-medium">{lv.name}</td>
                      <td className="py-3 px-5 text-right font-mono text-brand-gold">${cost.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Capping System ── */}
      <section className="border-y border-brand-border bg-brand-surface py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionLabel>Sustainability</SectionLabel>
            <SectionHeading>The <span className="gold-text">Capping System</span></SectionHeading>
            <p className="text-brand-muted max-w-xl mx-auto">
              Every wallet has a capping limit that prevents unlimited extraction. Rewards reduce capping;
              activating rank adds capping. This keeps the protocol self-sustaining.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Layers,
                title: 'Capping Added on Activation',
                desc: 'Each activateRank() call credits your wallet.capping by deposit × 3 for levels 1–14. Post-max activations (level 15+) use deposit × 2. This is the maximum total you can receive from that activation.',
                color: 'gold',
              },
              {
                icon: TrendingUp,
                title: 'Capping Consumed by Rewards',
                desc: 'Every passive reward, binary reward, or referral reward you receive is deducted from capping. When capping reaches zero, rewards stop until you re-activate.',
                color: 'green',
              },
              {
                icon: RefreshCw,
                title: 'Re-activate to Refill',
                desc: 'Depositing and activating the next rank level refills your capping. This incentivises continual re-investment and prevents wallet drain attacks.',
                color: 'amber',
              },
            ].map((item, i) => {
              const Icon = item.icon
              const [iconCls, rateCls] =
                item.color === 'gold'  ? ['bg-brand-gold/10 text-brand-gold',   'text-brand-gold']  :
                item.color === 'green' ? ['bg-brand-green/10 text-brand-green', 'text-brand-green'] :
                                         ['bg-amber-500/10 text-amber-400',     'text-amber-400']
              return (
                <div key={i} className="bg-brand-card border border-brand-border rounded-2xl p-7 card-glow">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${iconCls}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-display font-bold text-lg text-white mb-3">{item.title}</h3>
                  <p className="text-brand-muted text-sm leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FBMX Utility & Cooldowns ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* FBMX Utility */}
          <div>
            <SectionLabel>FBMX Token</SectionLabel>
            <SectionHeading><span className="gold-text">FBMX</span> Utility Fee</SectionHeading>
            <p className="text-brand-muted leading-relaxed mb-6">
              FBMX is the protocol's utility token. A small amount must be held inside the contract
              to execute any reward collection or withdrawal. This creates consistent buy pressure on FBMX.
            </p>
            <div className="space-y-3">
              {[
                { action: 'Collect Passive Rewards',  fee: '0.05 FBMX burned' },
                { action: 'Collect Binary Rewards',   fee: '0.05 FBMX burned' },
                { action: 'Withdraw Balance',         fee: '0.05 FBMX burned' },
                { action: 'Deposit USDT',             fee: 'No FBMX required'  },
                { action: 'Activate Rank',            fee: 'No FBMX required'  },
                { action: 'Register',                 fee: 'No FBMX required'  },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-brand-card border border-brand-border rounded-xl">
                  <span className="text-white text-sm">{row.action}</span>
                  <span className={`text-xs font-mono font-semibold ${row.fee.includes('burned') ? 'text-amber-400' : 'text-brand-muted'}`}>
                    {row.fee}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cooldowns */}
          <div>
            <SectionLabel>Anti-Spam</SectionLabel>
            <SectionHeading>Cooldown <span className="gold-text">Architecture</span></SectionHeading>
            <p className="text-brand-muted leading-relaxed mb-6">
              Two independent cooldowns prevent abuse and ensure fair reward distribution across all participants.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Clock,    title: '24-Hour Cooldown',   desc: 'Applies to each reward type separately (passive, binary, withdraw). Tracked per-user via coolDown timestamp.' },
                { icon: Lock,     title: 'Transaction Lock',   desc: 'Configurable per-user anti-spam lock (default 60s) between any two contract calls. Blocks transaction flooding from scripts or bots.' },
                { icon: Shield,   title: 'Block-Level Guard',  desc: 'One interaction per block per user (lastCallBlock). Prevents flash-loan style same-block exploits.' },
                { icon: Zap,      title: 'EOA-Only Calls',     desc: 'msg.sender must equal tx.origin. Prevents relayer contracts or nested call abuse.' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="bg-brand-card border border-brand-border rounded-xl p-4">
                    <Icon size={16} className="text-brand-gold mb-2" />
                    <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                    <div className="text-brand-muted text-xs leading-relaxed">{item.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Accordions ── */}
      <section className="border-t border-brand-border bg-brand-surface py-24">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionLabel>FAQ</SectionLabel>
            <SectionHeading>Common <span className="gold-text">Questions</span></SectionHeading>
          </div>
          <div className="space-y-3">
            <Accordion title="Do I earn from all three streams at the same time?" icon={TrendingUp} color="gold">
              <p className="text-brand-muted text-sm leading-relaxed">
                Yes. Passive rewards accrue every second based on your equity and rate. Binary volume accumulates
                whenever anyone in your downline deposits. Referral rewards are credited instantly when your direct referral activates.
                All three streams are independent and can be claimed on their respective cooldowns.
              </p>
            </Accordion>
            <Accordion title="What happens when my capping runs out?" icon={Layers} color="amber">
              <p className="text-brand-muted text-sm leading-relaxed">
                When <strong className="text-white">wallet.capping</strong> reaches zero, no new rewards can be credited to your wallet.
                Passive and binary rewards will show zero. To refill capping, deposit USDT and activate the next rank level.
                Each activation multiplies your deposit by 3 (or 2 at max rank) to add new capping.
              </p>
            </Accordion>
            <Accordion title="How does the passive rate reach 8%?" icon={Coins} color="green">
              <p className="text-brand-muted text-sm leading-relaxed">
                The passive rate formula is: <strong className="text-white">referralIncome ÷ equity × 1000 bps</strong>.
                To hit 8% (800 bps), your <strong className="text-white">totalDirect referral income must equal 80% of your totalEquity</strong>.
                For example: $500 equity + $400 referral income → 400/500 × 10 = 8%. The rate is capped at 8% and floored at 1%.
              </p>
            </Accordion>
            <Accordion title="Can I use Jump Activation for future upgrades?" icon={Zap} color="gold">
              <p className="text-brand-muted text-sm leading-relaxed">
                No. Jump Activation is a <strong className="text-white">first-activation-only</strong> feature.
                Once you complete any activation (jump or sequential), the <strong className="text-white">hasActivated</strong> flag is
                set permanently to true. All subsequent upgrades follow the normal sequential path: deposit one level at a time.
              </p>
            </Accordion>
            <Accordion title="What is the master agent system?" icon={Users} color="amber">
              <p className="text-brand-muted text-sm leading-relaxed">
                Each user inherits a <strong className="text-white">master agent</strong> address from their sponsor's affiliate record.
                The master agent receives 5% of every deposit made anywhere in their downline — regardless of depth.
                Agents are set at registration time and cannot be changed after.
              </p>
            </Accordion>
            <Accordion title="How is the binary placement determined?" icon={GitBranch} color="green">
              <p className="text-brand-muted text-sm leading-relaxed">
                When registering, you choose a placement option:<br />
                <strong className="text-white">Group 0</strong> — place in the leftmost open node of your sponsor's subtree.<br />
                <strong className="text-white">Group 1</strong> — place in the rightmost open node.<br />
                <strong className="text-white">Group 2+</strong> — auto-place in the leg with less volume (balancing mode).<br />
                All placements are final and recorded on-chain via the <em>AccountRegistered</em> event.
              </p>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 lg:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-brand-gold font-mono text-sm tracking-widest uppercase mb-4">Ready to Start</p>
            <h2 className="font-display font-black text-4xl text-white mb-4">
              Join the <span className="gold-text">FBMXDAO Network</span>
            </h2>
            <p className="text-brand-muted max-w-lg mx-auto mb-10">
              Connect your BSC wallet, register with a referrer, and choose your entry level to start earning from all three reward streams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard" className="btn-gold px-8 py-4 rounded-xl text-base flex items-center gap-2 justify-center shadow-gold">
                Launch Dashboard <ArrowRight size={18} />
              </Link>
              <Link to="/swap" className="px-8 py-4 rounded-xl text-base border border-brand-border hover:border-brand-gold/40 bg-brand-surface text-white transition-all flex items-center gap-2 justify-center">
                Buy FBMX <Coins size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gold-gradient flex items-center justify-center">
            <span className="font-display font-bold text-brand-dark text-xs">F</span>
          </div>
          <span className="font-display font-bold text-white">FBMX<span className="text-brand-gold">DAO</span></span>
        </div>
        <p className="text-brand-muted text-sm">© 2024 FBMXDAO Protocol. All rights reserved.</p>
        <p className="text-brand-muted/50 text-xs mt-2 max-w-md mx-auto">
          DeFi involves risk. Only participate with funds you can afford to lose. DYOR.
        </p>
      </footer>
    </div>
  )
}
