import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Swap from './pages/Swap'
import Admin from './pages/Admin'
import Rewards from './pages/Rewards'

export default function App() {
  return (
    <div className="min-h-screen bg-brand-dark font-body">
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
