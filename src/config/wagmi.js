import { createConfig, http } from 'wagmi'
import { bsc, bscTestnet, hardhat } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

const WC_PROJECT_ID = '3114629b3157317b0cf3be442a510ede'
const DEFAULT_NETWORK = 'bsc'; // the value can be bsc, hardhat, or bscTestnet

const NETWORK_CONFIG = {
  bsc: {
    chain: bsc,
    rpc: 'https://bsc-dataseed1.binance.org',
  },
  bscTestnet: {
    chain: bscTestnet,
    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
  },
  hardhat: {
    chain: hardhat,
    rpc: 'http://127.0.0.1:8545',
  },
}

const { chain: activeChain, rpc: activeRpc } = NETWORK_CONFIG[DEFAULT_NETWORK]

export const config = createConfig({
  chains: [activeChain],
  connectors: [
    injected(),
    walletConnect({ projectId: WC_PROJECT_ID }),
    coinbaseWallet({ appName: 'FBMXDAO' }),
  ],
  transports: {
    [activeChain.id]: http(activeRpc),
  },
})

export const BSC_CHAIN_ID = activeChain.id
