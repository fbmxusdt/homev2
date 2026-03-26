import { createConfig, http } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

const WC_PROJECT_ID = '3114629b3157317b0cf3be442a510ede'

export const config = createConfig({
  chains: [bsc],
  connectors: [
    injected(),
    walletConnect({ projectId: WC_PROJECT_ID }),
    coinbaseWallet({ appName: 'FBMXDAO' }),
  ],
  transports: {
    [bsc.id]: http('https://bsc-dataseed1.binance.org'),
  },
})

export const BSC_CHAIN_ID = bsc.id // 56
