import { Link } from 'react-router-dom'
import {
  Zap, TrendingUp, GitBranch, Shield, Users, Clock, ArrowRight,
  Coins, Award, Layers, BarChart3, RefreshCw, Lock, Droplets, Star, Briefcase, Megaphone
} from 'lucide-react'

const STATS = [
  { label: 'Total Value Locked', value: '$2.4M+' },
  { label: 'Active Members', value: '8,400+' },
  { label: 'Rewards Distributed', value: '$890K+' },
  { label: 'Max Daily Yield', value: '3.5%' },
]

const REWARD_TYPES = [
  {
    icon: Coins,
    title: 'Passive Rewards',
    color: 'gold',
    rate: '1%–8% per day (dynamic)',
    desc: 'Earn daily passive income based on your deposit level. Rewards accumulate every 24 hours and can be collected once per day. Higher levels unlock greater daily return rates.',
    details: [
      'Rate = referralIncome ÷ equity (1%–8% cap)',
      'Compounds daily via activateRank',
      'Requires FBMX fee per collection',
    ],
  },
  {
    icon: GitBranch,
    title: 'Binary Rewards',
    color: 'green',
    rate: '10% of weaker leg',
    desc: 'FBMXDAO uses a binary matrix structure. Each user can have two direct placements. Binary rewards are calculated on the weaker of your two legs, paid out once every 24 hours.',
    details: [
      'Auto-balances via binary tree',
      'Earn 10% of weaker leg volume',
      'Compound by reinvesting',
    ],
  },
  {
    icon: Users,
    title: 'Referral / Affiliate',
    color: 'amber',
    rate: 'Multi-level commissions',
    desc: 'Introduce new participants to the protocol and earn commissions from their deposits and upgrades. Your affiliate genealogy tree tracks every member you directly or indirectly refer.',
    details: [
      'Direct referral bonus',
      'Multi-level override commissions',
      'Real-time genealogy tree',
    ],
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Connect & Register', desc: 'Connect your BSC wallet, provide a referrer address, and join the FBMXDAO network.', icon: Shield },
  { step: '02', title: 'Deposit Capital', desc: 'Deposit USDT or FBMX tokens. Your deposit level determines your passive rate.', icon: Coins },
  { step: '03', title: 'Upgrade Levels', desc: 'Upgrade your membership level to unlock higher daily reward percentages.', icon: Layers },
  { step: '04', title: 'Collect & Grow', desc: 'Collect passive and binary rewards daily, withdraw or reinvest to compound.', icon: TrendingUp },
]

const TOKENOMICS = [
  {
    label: 'Liquidity Pool',
    pct: 70,
    amount: '70,000,000',
    color: '#00D4AA',
    barColor: 'bg-brand-green',
    icon: Droplets,
    desc: 'Locked in PancakeSwap V3 FBMX/USDT pool. Every deposit automatically adds liquidity, creating a self-reinforcing price floor.',
  },
  {
    label: 'Staking Rewards',
    pct: 10,
    amount: '10,000,000',
    color: '#F5A623',
    barColor: 'bg-brand-gold',
    icon: Star,
    desc: 'Locked allocation reserved for future staking incentives, distributed to long-term holders who lock their FBMX.',
  },
  {
    label: 'Marketing',
    pct: 10,
    amount: '10,000,000',
    color: '#A855F7',
    barColor: 'bg-purple-500',
    icon: Megaphone,
    desc: 'Funds community campaigns, exchange listings, influencer partnerships, and global growth initiatives.',
  },
  {
    label: 'Project Funding',
    pct: 10,
    amount: '10,000,000',
    color: '#3B82F6',
    barColor: 'bg-blue-500',
    icon: Briefcase,
    desc: 'Allocated to ongoing development, audits, infrastructure, and team operations to ensure protocol longevity.',
  },
]

export default function Landing() {
  return (
    <div className="pt-16 overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center animate-grid">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-gold/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-brand-green/5 blur-[80px] pointer-events-none" />

        <div className="relative text-center px-4 max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-gold/30 bg-brand-gold/5 text-brand-gold text-sm font-medium mb-8">
            <Zap size={14} className="animate-pulse" />
            Powered by Binance Smart Chain
          </div>

          <h1 className="font-display font-black text-5xl sm:text-7xl leading-[1.05] mb-6">
            <span className="text-white">Decentralized</span>
            <br />
            <span className="gold-text">Rewards Protocol</span>
          </h1>

          <p className="text-brand-muted text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            FBMXDAO is a community-owned DeFi protocol on BSC delivering passive income,
            binary matrix rewards, and multi-level affiliate commissions — all on-chain and transparent.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/dashboard"
              className="btn-gold px-8 py-4 rounded-xl text-base flex items-center gap-2 justify-center shadow-gold"
            >
              Launch Dashboard
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/swap"
              className="px-8 py-4 rounded-xl text-base border border-brand-border hover:border-brand-gold/40 bg-brand-surface hover:bg-brand-card text-white transition-all flex items-center gap-2 justify-center"
            >
              Swap FBMX
              <RefreshCw size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats ticker */}
      <div className="border-y border-brand-border bg-brand-surface overflow-hidden py-4">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...STATS, ...STATS].map((s, i) => (
            <div key={i} className="inline-flex items-center gap-2 px-8">
              <span className="text-brand-muted text-sm">{s.label}</span>
              <span className="font-display font-bold text-brand-gold">{s.value}</span>
              <span className="text-brand-border">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reward Types */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <p className="text-brand-gold font-medium mb-3 font-mono text-sm tracking-widest uppercase">Three Revenue Streams</p>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-white">
            How You <span className="gold-text">Earn</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {REWARD_TYPES.map((r, i) => {
            const Icon = r.icon
            return (
              <div
                key={i}
                className="bg-brand-card border border-brand-border rounded-2xl p-8 card-glow transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                  r.color === 'gold' ? 'bg-brand-gold/10 text-brand-gold'
                  : r.color === 'green' ? 'bg-brand-green/10 text-brand-green'
                  : 'bg-amber-500/10 text-amber-400'
                }`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-1">{r.title}</h3>
                <div className={`text-sm font-semibold mb-4 ${
                  r.color === 'gold' ? 'text-brand-gold'
                  : r.color === 'green' ? 'text-brand-green'
                  : 'text-amber-400'
                }`}>{r.rate}</div>
                <p className="text-brand-muted text-sm leading-relaxed mb-6">{r.desc}</p>
                <ul className="space-y-2">
                  {r.details.map((d, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Tokenomics */}
      <section className="border-y border-brand-border bg-brand-surface py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-brand-gold font-mono text-sm tracking-widest uppercase mb-3">Tokenomics</p>
            <h2 className="font-display font-bold text-4xl text-white">
              FBMX <span className="gold-text">Token Distribution</span>
            </h2>
            <p className="text-brand-muted mt-3 max-w-lg mx-auto">
              100,000,000 FBMX total supply — fixed forever, no minting.
            </p>
          </div>

          {/* Total supply badge */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/5">
              <Coins size={20} className="text-brand-gold" />
              <div>
                <div className="text-xs text-brand-muted font-mono uppercase tracking-widest">Total Supply</div>
                <div className="font-display font-black text-2xl text-white">100,000,000 <span className="text-brand-gold">FBMX</span></div>
              </div>
            </div>
          </div>

          {/* Stacked bar */}
          <div className="mb-10 rounded-2xl overflow-hidden h-5 flex">
            {TOKENOMICS.map((t) => (
              <div
                key={t.label}
                className={`h-full ${t.barColor} transition-all`}
                style={{ width: `${t.pct}%` }}
                title={`${t.label}: ${t.pct}%`}
              />
            ))}
          </div>

          {/* Legend + cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TOKENOMICS.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.label} className="bg-brand-card border border-brand-border rounded-2xl p-6 card-glow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${t.color}18` }}>
                      <Icon size={18} style={{ color: t.color }} />
                    </div>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: t.color }}
                    />
                    <span className="font-display font-semibold text-white text-sm">{t.label}</span>
                  </div>
                  <div className="font-display font-black text-3xl mb-0.5" style={{ color: t.color }}>
                    {t.pct}%
                  </div>
                  <div className="font-mono text-xs text-brand-muted mb-3">{t.amount} FBMX</div>
                  <p className="text-brand-muted text-xs leading-relaxed">{t.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 py-24 ">
        <div className="text-center mb-16">
          <p className="text-brand-gold font-mono text-sm tracking-widest uppercase mb-3">Simple Steps</p>
          <h2 className="font-display font-bold text-4xl text-white">
            Get Started in <span className="gold-text">Minutes</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-brand-gold/30 to-transparent" />
                )}
                <div className="bg-brand-card border border-brand-border rounded-2xl p-6 card-glow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <span className="font-mono font-bold text-brand-gold/40 text-2xl">{step.step}</span>
                  </div>
                  <h3 className="font-display font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-brand-muted text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Cooldown Explainer */}
      <section className="max-w-7xl mx-auto px-4 pb-24">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl" />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-brand-gold font-mono text-sm tracking-widest uppercase mb-3">Security & Fairness</p>
              <h2 className="font-display font-bold text-3xl text-white mb-4">
                Cooldown <span className="gold-text">Architecture</span>
              </h2>
              <p className="text-brand-muted leading-relaxed">
                To ensure fair distribution and network stability, all collection and withdrawal actions
                are governed by a dual-cooldown system built directly into the smart contract.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Clock, title: '24-Hour Window', desc: 'Collect passive, binary, or withdraw once every 24 hours per user.' },
                { icon: Lock, title: 'Transaction Lock', desc: 'A configurable per-user anti-spam lock (default 60s) between any contract interactions.' },
                { icon: RefreshCw, title: 'Auto-Refetch', desc: 'Cooldown timers are live and update every second in the dashboard.' },
                { icon: BarChart3, title: 'Transparent On-Chain', desc: 'All cooldown timestamps are publicly readable from the blockchain.' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="bg-brand-surface rounded-xl p-4 border border-brand-border">
                    <Icon size={18} className="text-brand-gold mb-3" />
                    <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                    <div className="text-brand-muted text-xs leading-relaxed">{item.desc}</div>
                  </div>
                )
              })}
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
