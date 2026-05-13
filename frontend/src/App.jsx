import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'

// Auth
import Login              from './pages/auth/Login'
import Register           from './pages/auth/Register'
import AuthCallback       from './pages/auth/AuthCallback'
import CompleteProfile    from './pages/auth/CompleteProfile'
import PendingPage        from './pages/auth/PendingPage'

// Parent
import ParentDashboard    from './pages/parent/ParentDashboard'
import ParentDailyLog     from './pages/parent/ParentDailyLog'
import AIChatbot          from './pages/parent/AIChatbot'
import ParentGallery      from './pages/parent/Gallery'
import ParentBilling      from './pages/parent/Billing'
import ParentChat         from './pages/parent/ParentChat'

// Caregiver
import CaregiverDashboard from './pages/caregiver/CaregiverDashboard'
import DailyLogForm       from './pages/caregiver/DailyLogForm'
import GalleryUpload      from './pages/caregiver/GalleryUpload'
import CaregiverChat      from './pages/caregiver/CaregiverChat'

// Admin
import ChildrenManagement      from './pages/admin/ChildrenManagement'
import BillingManagement       from './pages/admin/BillingManagement'
import RegistrationManagement  from './pages/admin/RegistrationManagement'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1A1A2E', color: '#E8E8F0', border: '1px solid #2E2E4A' }
        }} />
        <Routes>
          {/* ── Public ──────────────────────────────────────────────────────── */}
          <Route path="/"                  element={<Navigate to="/login" replace />} />
          <Route path="/login"             element={<Login />} />
          <Route path="/register"          element={<Register />} />
          <Route path="/auth/callback"     element={<AuthCallback />} />
          <Route path="/complete-profile"  element={<CompleteProfile />} />
          <Route path="/pending"           element={<PendingPage />} />

          {/* ── Parent ──────────────────────────────────────────────────────── */}
          <Route path="/parent"            element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
          <Route path="/parent/daily-log"  element={<ProtectedRoute allowedRoles={['parent']}><ParentDailyLog /></ProtectedRoute>} />
          <Route path="/parent/ai-chat"    element={<ProtectedRoute allowedRoles={['parent']}><AIChatbot /></ProtectedRoute>} />
          <Route path="/parent/gallery"    element={<ProtectedRoute allowedRoles={['parent']}><ParentGallery /></ProtectedRoute>} />
          <Route path="/parent/billing"    element={<ProtectedRoute allowedRoles={['parent']}><ParentBilling /></ProtectedRoute>} />
          <Route path="/parent/chat"       element={<ProtectedRoute allowedRoles={['parent']}><ParentChat /></ProtectedRoute>} />

          {/* ── Caregiver ───────────────────────────────────────────────────── */}
          <Route path="/caregiver"         element={<ProtectedRoute allowedRoles={['caregiver']}><CaregiverDashboard /></ProtectedRoute>} />
          <Route path="/caregiver/daily-log" element={<ProtectedRoute allowedRoles={['caregiver']}><DailyLogForm /></ProtectedRoute>} />
          <Route path="/caregiver/gallery" element={<ProtectedRoute allowedRoles={['caregiver']}><GalleryUpload /></ProtectedRoute>} />
          <Route path="/caregiver/chat"    element={<ProtectedRoute allowedRoles={['caregiver']}><CaregiverChat /></ProtectedRoute>} />

          {/* ── Admin ───────────────────────────────────────────────────────── */}
          <Route path="/admin"             element={<Navigate to="/admin/children" replace />} />
          <Route path="/admin/children"    element={<ProtectedRoute allowedRoles={['admin']}><ChildrenManagement /></ProtectedRoute>} />
          <Route path="/admin/billing"     element={<ProtectedRoute allowedRoles={['admin']}><BillingManagement /></ProtectedRoute>} />
          <Route path="/admin/registrations" element={<ProtectedRoute allowedRoles={['admin']}><RegistrationManagement /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
