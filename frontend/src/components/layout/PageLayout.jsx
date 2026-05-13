import Sidebar from './Sidebar'

export default function PageLayout({ children }) {
  return (
    <div className="page-layout" style={{ 
      display: 'flex', 
      height: '100dvh', 
      background: 'var(--bg)', 
      padding: '1.25rem',
      boxSizing: 'border-box',
      gap: '1.25rem',
      overflow: 'hidden'
    }}>
      <Sidebar />
      <main className="main-content" style={{ 
        flex: 1, 
        overflowY: 'auto',
        position: 'relative'
      }}>
        {children}
      </main>
    </div>
  )
}
