import Header from './components/Header'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <Header />
      <Dashboard />
    </div>
  )
}
