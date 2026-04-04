import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { isAddress } from 'viem'
import Navbar from './components/Navbar'

const REFERRER_KEY = 'fbmx_referrer'

// Captures ?ref=0x... from any URL into localStorage.
// Runs on every navigation so a new referral link always overwrites the old one.
function ReferralCapture() {
  const location = useLocation()
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref')
    if (ref && isAddress(ref)) {
      localStorage.setItem(REFERRER_KEY, ref)
    }
  }, [location.search])
  return null
}
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Swap from './pages/Swap'
import Admin from './pages/Admin'
import Rewards from './pages/Rewards'

export default function App() {
  return (
    <div className="min-h-screen bg-brand-dark font-body">
      <ReferralCapture />
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/swap" element={<Swap />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  )
}
