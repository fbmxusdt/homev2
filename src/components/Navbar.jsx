import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { BSC_CHAIN_ID } from '../config/wagmi'
import { Zap, LayoutDashboard, ArrowLeftRight, Menu, X, ChevronDown, AlertTriangle, ShieldCheck, BarChart3 } from 'lucide-react'

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  const wrongNetwork = isConnected && chain?.id !== BSC_CHAIN_ID

  const navLinks = [
    { to: '/', label: 'Home', icon: Zap },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/swap', label: 'Swap', icon: ArrowLeftRight },
    { to: '/rewards', label: 'Rewards', icon: BarChart3 },
    { to: '/admin', label: 'Admin', icon: ShieldCheck },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-brand-border bg-brand-dark/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shadow-gold">
              <span className="font-display font-800 text-brand-dark text-sm">F</span>
            </div>
            <span className="font-display font-bold text-lg text-white group-hover:text-brand-gold transition-colors">
              FBMX<span className="text-brand-gold">DAO</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === to
                    ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20'
                    : 'text-brand-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3">
            {wrongNetwork && (
              <button
                onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs font-semibold hover:bg-brand-red/20 transition-all"
              >
                <AlertTriangle size={12} />
                Switch to BSC
              </button>
            )}

            {!isConnected ? (
              <div className="relative">
                <button
                  onClick={() => setWalletOpen(!walletOpen)}
                  className="btn-gold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"
                >
                  Connect Wallet
                  <ChevronDown size={14} className={`transition-transform ${walletOpen ? 'rotate-180' : ''}`} />
                </button>
                {walletOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-brand-card border border-brand-border rounded-xl shadow-card overflow-hidden">
                    {connectors.map((connector) => (
                      <button
                        key={connector.uid}
                        onClick={() => { connect({ connector }); setWalletOpen(false) }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-brand-gold/10 hover:text-brand-gold transition-colors text-brand-muted border-b border-brand-border last:border-0"
                      >
                        {connector.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-border hover:border-brand-gold/30 bg-brand-surface hover:bg-brand-card transition-all text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                <span className="font-mono text-xs text-white">{shortAddr(address)}</span>
              </button>
            )}

            {/* Mobile menu */}
            <button
              className="md:hidden p-2 text-brand-muted hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-surface px-4 py-3 space-y-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                pathname === to
                  ? 'bg-brand-gold/10 text-brand-gold'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {wrongNetwork && (
            <button
              onClick={() => { switchChain({ chainId: BSC_CHAIN_ID }); setMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-brand-red bg-brand-red/10"
            >
              <AlertTriangle size={14} />
              Switch to BSC Network
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
