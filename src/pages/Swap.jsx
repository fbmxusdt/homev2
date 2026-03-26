import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits, maxUint256 } from 'viem'
import {
  ArrowUpDown, Settings, Loader2, AlertTriangle, CheckCircle,
  TrendingUp, Droplets, ExternalLink, Info, RefreshCw, ChevronDown
} from 'lucide-react'
import {
  USDT_ADDRESS, FBMX_ADDRESS, PANCAKE_V3_POOL, PANCAKE_V3_ROUTER,
  ERC20_ABI, PANCAKE_V3_POOL_ABI, PANCAKE_V3_ROUTER_ABI
} from '../config/contracts'
import { BSC_CHAIN_ID } from '../config/wagmi'

const TOKENS = {
  USDT: { address: USDT_ADDRESS, symbol: 'USDT', decimals: 18, color: '#26A17B' },
  FBMX: { address: FBMX_ADDRESS, symbol: 'FBMX', decimals: 18, color: '#F5A623' },
}

const SLIPPAGES = [0.1, 0.5, 1.0, 3.0]

function TokenIcon({ symbol, color, size = 36 }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-brand-dark flex-shrink-0 text-xs"
      style={{ width: size, height: size, background: color }}>
      {symbol.slice(0, 1)}
    </div>
  )
}

// Compute price from sqrtPriceX96 — USDT is token0, FBMX is token1
function computePrice(sqrtPriceX96) {
  if (!sqrtPriceX96) return null
  try {
    const sq = Number(sqrtPriceX96)
    const price = (sq / 2 ** 96) ** 2
    // token0=USDT / token1=FBMX → price = USDT per FBMX (token0 per token1)
    return price > 0 ? price : null
  } catch {
    return null
  }
}

export default function Swap() {
  const { address, isConnected, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongNetwork = isConnected && chain?.id !== BSC_CHAIN_ID

  const [tokenIn, setTokenIn] = useState('USDT')
  const [tokenOut, setTokenOut] = useState('FBMX')
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [customSlippage, setCustomSlippage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [estimatedOut, setEstimatedOut] = useState(null)
  const [priceImpact, setPriceImpact] = useState(null)
  const [swapStep, setSwapStep] = useState('idle') // idle | approving | swapping | done

  const inToken = TOKENS[tokenIn]
  const outToken = TOKENS[tokenOut]
  const activeSlippage = customSlippage ? Number(customSlippage) : slippage

  // Read pool data + balances + allowances
  const { data, isLoading: poolLoading, refetch: refetchPool } = useReadContracts({
    contracts: [
      { address: PANCAKE_V3_POOL, abi: PANCAKE_V3_POOL_ABI, functionName: 'slot0' },
      { address: PANCAKE_V3_POOL, abi: PANCAKE_V3_POOL_ABI, functionName: 'liquidity' },
      { address: PANCAKE_V3_POOL, abi: PANCAKE_V3_POOL_ABI, functionName: 'fee' },
      ...(address ? [
        { address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
        { address: FBMX_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
        { address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address, PANCAKE_V3_ROUTER] },
        { address: FBMX_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address, PANCAKE_V3_ROUTER] },
      ] : []),
    ],
    query: { refetchInterval: 12000 },
  })

  const slot0 = data?.[0]?.result
  const liquidity = data?.[1]?.result
  const fee = data?.[2]?.result ?? 2500
  const usdtBalance = data?.[3]?.result ? formatUnits(data[3].result, 18) : '0'
  const fbmxBalance = data?.[4]?.result ? formatUnits(data[4].result, 18) : '0'
  const usdtAllowance = data?.[5]?.result ? formatUnits(data[5].result, 18) : '0'
  const fbmxAllowance = data?.[6]?.result ? formatUnits(data[6].result, 18) : '0'

  const sqrtPriceX96 = slot0?.[0]
  const poolPrice = computePrice(sqrtPriceX96)
  // poolPrice = USDT per FBMX (token0/token1)
  // If buying FBMX with USDT: outAmount = amountIn / poolPrice
  // If buying USDT with FBMX: outAmount = amountIn * poolPrice

  // Estimate output from pool price
  useEffect(() => {
    if (!amountIn || !poolPrice || isNaN(amountIn) || Number(amountIn) <= 0) {
      setEstimatedOut(null)
      setPriceImpact(null)
      return
    }
    const amt = Number(amountIn)
    let out
    if (tokenIn === 'USDT' && tokenOut === 'FBMX') {
      // Selling USDT → getting FBMX: FBMX = USDT / price_USDT_per_FBMX
      out = amt / poolPrice
    } else {
      // Selling FBMX → getting USDT: USDT = FBMX * price_USDT_per_FBMX
      out = amt * poolPrice
    }
    // Apply fee impact
    const feeMultiplier = 1 - (Number(fee) / 1e6)
    const outAfterFee = out * feeMultiplier
    setEstimatedOut(outAfterFee)
    // Rough price impact estimate
    const liquidityNum = liquidity ? Number(liquidity) : 1e18
    const impact = Math.min((amt / (liquidityNum / 1e18)) * 100 * 50, 20)
    setPriceImpact(impact.toFixed(3))
  }, [amountIn, poolPrice, tokenIn, tokenOut, fee, liquidity])

  const inBalance = tokenIn === 'USDT' ? usdtBalance : fbmxBalance
  const inAllowance = tokenIn === 'USDT' ? usdtAllowance : fbmxAllowance
  const needsApproval = Number(inAllowance) < Number(amountIn || 0)

  const { writeContract, data: txHash, isPending, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleApprove = () => {
    setSwapStep('approving')
    writeContract(
      { address: inToken.address, abi: ERC20_ABI, functionName: 'approve', args: [PANCAKE_V3_ROUTER, maxUint256] },
      { onSuccess: () => setSwapStep('approved'), onError: () => setSwapStep('idle') }
    )
  }

  const handleSwap = () => {
    if (!address || !amountIn || !estimatedOut) return
    setSwapStep('swapping')
    const amtIn = parseUnits(amountIn, inToken.decimals)
    const minOut = parseUnits(
      (estimatedOut * (1 - activeSlippage / 100)).toFixed(inToken.decimals),
      outToken.decimals
    )
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
    writeContract(
      {
        address: PANCAKE_V3_ROUTER,
        abi: PANCAKE_V3_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: inToken.address,
          tokenOut: outToken.address,
          fee: BigInt(fee),
          recipient: address,
          deadline,
          amountIn: amtIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        }],
      },
      {
        onSuccess: () => setSwapStep('done'),
        onError: () => setSwapStep('idle'),
      }
    )
  }

  const handleFlip = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn('')
    setEstimatedOut(null)
    setSwapStep('idle')
  }

  const busy = isPending || isConfirming
  const canSwap = !!address && !!amountIn && Number(amountIn) > 0 && Number(amountIn) <= Number(inBalance) && !!estimatedOut && !wrongNetwork
  const effectiveStep = swapStep === 'approved' || (!needsApproval && swapStep === 'idle') ? 'swap_ready' : swapStep

  // Price display
  const priceDisplay = poolPrice
    ? tokenIn === 'USDT'
      ? `1 FBMX = ${poolPrice.toFixed(6)} USDT`
      : `1 USDT = ${(1 / poolPrice).toFixed(6)} FBMX`
    : null

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-4xl text-white mb-2">
            Swap <span className="gold-text">FBMX</span>
          </h1>
          <p className="text-brand-muted text-sm">Powered by PancakeSwap V3</p>
        </div>

        {/* Pool info bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Pool Fee', value: fee ? `${Number(fee) / 10000}%` : '—', icon: Droplets },
            { label: 'Price', value: poolPrice ? `$${poolPrice.toFixed(4)}` : '—', icon: TrendingUp },
            { label: 'Liquidity', value: liquidity ? `${(Number(liquidity) / 1e18).toFixed(0)}` : '—', icon: Info },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-brand-card border border-brand-border rounded-xl p-3 text-center">
              <Icon size={14} className="text-brand-gold mx-auto mb-1" />
              <div className="text-xs text-brand-muted">{label}</div>
              <div className="font-mono text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Swap card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-card">
          {/* Card header */}
          <div className="flex items-center justify-between p-5 border-b border-brand-border">
            <span className="font-display font-bold text-white">Swap</span>
            <div className="flex items-center gap-2">
              <button onClick={() => refetchPool()} className="p-2 text-brand-muted hover:text-brand-gold rounded-lg hover:bg-brand-surface transition-all">
                <RefreshCw size={15} />
              </button>
              <button onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-all ${showSettings ? 'text-brand-gold bg-brand-gold/10' : 'text-brand-muted hover:text-brand-gold hover:bg-brand-surface'}`}>
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-5 py-4 border-b border-brand-border bg-brand-surface">
              <div className="text-xs text-brand-muted mb-3 font-semibold uppercase tracking-wider">Slippage Tolerance</div>
              <div className="flex gap-2 flex-wrap">
                {SLIPPAGES.map((s) => (
                  <button key={s} onClick={() => { setSlippage(s); setCustomSlippage('') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${slippage === s && !customSlippage ? 'bg-brand-gold text-brand-dark' : 'bg-brand-card border border-brand-border text-brand-muted hover:border-brand-gold/30 hover:text-white'}`}>
                    {s}%
                  </button>
                ))}
                <div className="flex items-center bg-brand-card border border-brand-border rounded-lg overflow-hidden">
                  <input type="number" placeholder="Custom" value={customSlippage} onChange={(e) => setCustomSlippage(e.target.value)}
                    className="w-16 px-2 py-1.5 bg-transparent text-xs text-white outline-none" />
                  <span className="pr-2 text-xs text-brand-muted">%</span>
                </div>
              </div>
              {activeSlippage > 5 && (
                <p className="mt-2 text-xs text-brand-red flex items-center gap-1">
                  <AlertTriangle size={11} />High slippage may result in unfavorable trade
                </p>
              )}
            </div>
          )}

          <div className="p-5 space-y-2">
            {/* Token In */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-gold/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-brand-muted font-medium">You Pay</span>
                <button className="text-xs text-brand-gold hover:underline" onClick={() => setAmountIn(Number(inBalance).toFixed(6))}>
                  Balance: {Number(inBalance).toFixed(4)} {inToken.symbol}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-brand-card px-3 py-2 rounded-xl border border-brand-border flex-shrink-0">
                  <TokenIcon symbol={inToken.symbol} color={inToken.color} size={28} />
                  <span className="font-display font-bold text-white text-sm">{inToken.symbol}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={amountIn}
                  onChange={(e) => { setAmountIn(e.target.value); setSwapStep('idle') }}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-right text-2xl font-mono font-bold text-white outline-none placeholder-brand-border"
                />
              </div>
            </div>

            {/* Flip button */}
            <div className="flex justify-center">
              <button onClick={handleFlip}
                className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-gold/40 hover:bg-brand-gold/10 flex items-center justify-center transition-all group">
                <ArrowUpDown size={16} className="text-brand-muted group-hover:text-brand-gold transition-colors" />
              </button>
            </div>

            {/* Token Out */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-brand-muted font-medium">You Receive</span>
                <span className="text-xs text-brand-muted">Balance: {Number(tokenOut === 'USDT' ? usdtBalance : fbmxBalance).toFixed(4)} {outToken.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-brand-card px-3 py-2 rounded-xl border border-brand-border flex-shrink-0">
                  <TokenIcon symbol={outToken.symbol} color={outToken.color} size={28} />
                  <span className="font-display font-bold text-white text-sm">{outToken.symbol}</span>
                </div>
                <div className="flex-1 text-right text-2xl font-mono font-bold text-white">
                  {estimatedOut ? estimatedOut.toFixed(6) : <span className="text-brand-border">0.0</span>}
                </div>
              </div>
            </div>

            {/* Price info */}
            {priceDisplay && amountIn && (
              <div className="flex items-center justify-between px-2 py-2 text-xs text-brand-muted">
                <span>{priceDisplay}</span>
                {priceImpact && (
                  <span className={`font-semibold ${Number(priceImpact) > 2 ? 'text-brand-red' : Number(priceImpact) > 0.5 ? 'text-amber-400' : 'text-brand-green'}`}>
                    Price Impact: {priceImpact}%
                  </span>
                )}
              </div>
            )}

            {/* Trade details */}
            {estimatedOut && amountIn && (
              <div className="bg-brand-surface rounded-xl border border-brand-border p-4 space-y-2 text-xs">
                <div className="flex justify-between text-brand-muted">
                  <span>Minimum received</span>
                  <span className="text-white font-mono">{(estimatedOut * (1 - activeSlippage / 100)).toFixed(6)} {outToken.symbol}</span>
                </div>
                <div className="flex justify-between text-brand-muted">
                  <span>Slippage tolerance</span>
                  <span className="text-white">{activeSlippage}%</span>
                </div>
                <div className="flex justify-between text-brand-muted">
                  <span>Pool fee</span>
                  <span className="text-white">{Number(fee) / 10000}%</span>
                </div>
                <div className="flex justify-between text-brand-muted">
                  <span>Route</span>
                  <span className="text-white">{inToken.symbol} → {outToken.symbol}</span>
                </div>
              </div>
            )}

            {/* Action button */}
            {!isConnected ? (
              <div className="pt-2 text-center text-brand-muted text-sm py-4">Connect wallet to swap</div>
            ) : wrongNetwork ? (
              <button onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold bg-brand-red/10 border border-brand-red/30 text-brand-red hover:bg-brand-red/20 transition-all">
                <AlertTriangle size={16} />Switch to BSC
              </button>
            ) : needsApproval && canSwap ? (
              <div className="pt-2 grid grid-cols-2 gap-3">
                <button onClick={handleApprove} disabled={busy || swapStep === 'approving'}
                  className="btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-sm">
                  {busy && swapStep === 'approving' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  1. Approve {inToken.symbol}
                </button>
                <button disabled
                  className="py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-sm bg-brand-surface border border-brand-border text-brand-muted cursor-not-allowed opacity-50">
                  2. Swap
                </button>
              </div>
            ) : (
              <button
                onClick={swapStep === 'done' ? () => { setAmountIn(''); setEstimatedOut(null); setSwapStep('idle'); refetchPool() } : handleSwap}
                disabled={!canSwap || busy}
                className="w-full mt-2 btn-gold py-4 rounded-xl flex items-center justify-center gap-2 font-display font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <><Loader2 size={18} className="animate-spin" />{isConfirming ? 'Confirming…' : 'Processing…'}</>
                ) : swapStep === 'done' ? (
                  <><CheckCircle size={18} />Swap Successful! Swap again</>
                ) : !amountIn || Number(amountIn) <= 0 ? (
                  'Enter an amount'
                ) : Number(amountIn) > Number(inBalance) ? (
                  `Insufficient ${inToken.symbol}`
                ) : (
                  <>Swap {inToken.symbol} → {outToken.symbol}</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Pool link */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <a href={`https://pancakeswap.finance/info/v3/pairs/${PANCAKE_V3_POOL}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-gold transition-colors">
            <ExternalLink size={12} />View Pool on PancakeSwap
          </a>
          <span className="text-brand-border">·</span>
          <a href={`https://bscscan.com/address/${FBMX_ADDRESS}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-gold transition-colors">
            <ExternalLink size={12} />FBMX Token
          </a>
        </div>

        {/* Token addresses */}
        <div className="mt-4 bg-brand-card border border-brand-border rounded-xl p-4 space-y-2">
          <div className="text-xs text-brand-muted font-semibold mb-3 uppercase tracking-wider">Token Addresses</div>
          {[
            { label: 'USDT (BSC)', addr: USDT_ADDRESS, color: '#26A17B' },
            { label: 'FBMX', addr: FBMX_ADDRESS, color: '#F5A623' },
            { label: 'V3 Pool', addr: PANCAKE_V3_POOL, color: '#8892A4' },
          ].map(({ label, addr, color }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-brand-muted">{label}</span>
              </div>
              <a href={`https://bscscan.com/address/${addr}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-brand-muted hover:text-brand-gold flex items-center gap-1 transition-colors">
                {addr.slice(0, 8)}…{addr.slice(-6)}<ExternalLink size={10} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
