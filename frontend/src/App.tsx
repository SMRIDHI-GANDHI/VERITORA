import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CyberHelp } from './pages/CyberHelp'
import { Landing } from './pages/Landing'
import { NotFound } from './pages/NotFound'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { TrustScan } from './pages/TrustScan'
import { Analyze } from './pages/Analyze'
import { AnalysisResult } from './pages/AnalysisResult'
import { VerifyCompany } from './pages/VerifyCompany'
import { VerifyRecruiter } from './pages/VerifyRecruiter'
import { Reports } from './pages/Reports'
import { ReportNew } from './pages/ReportNew'
import { History } from './pages/History'
import { Saved } from './pages/Saved'
import { Exposure } from './pages/Exposure'
import { PassportPublic } from './pages/PassportPublic'
import { Chat } from './pages/Chat'
import { ProtectedRoute, RoleRoute } from './auth/guards'
import { MyPassports } from './pages/MyPassports'

const Admin = lazy(async () => ({ default: (await import('./pages/Admin')).Admin }))
const AdminNetwork = lazy(async () => ({ default: (await import('./pages/AdminNetwork')).AdminNetwork }))
const AdminWatchlist = lazy(async () => ({ default: (await import('./pages/AdminWatchlist')).AdminWatchlist }))
const AdminTrends = lazy(async () => ({ default: (await import('./pages/AdminTrends')).AdminTrends }))

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="trustscan" element={<ProtectedRoute><TrustScan /></ProtectedRoute>} />
        <Route path="analyze" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
        <Route path="verify/company" element={<ProtectedRoute><VerifyCompany /></ProtectedRoute>} />
        <Route path="analysis/:id" element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
        <Route path="verify/recruiter" element={<ProtectedRoute><VerifyRecruiter /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="reports/new" element={<ProtectedRoute><ReportNew /></ProtectedRoute>} />
        <Route path="exposure" element={<ProtectedRoute><Exposure /></ProtectedRoute>} />
        <Route path="passport/:token" element={<PassportPublic />} />
        <Route path="chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="help/cybercrime" element={<CyberHelp />} />
        <Route path="message-analyzer" element={<Navigate to="/analyze?tab=message" replace />} />
        <Route path="history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
        <Route path="passports" element={<ProtectedRoute><MyPassports /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute><RoleRoute roles={['moderator', 'admin']}><Suspense fallback={<div className="p-4 text-sm text-muted">Loading admin…</div>}><Admin /></Suspense></RoleRoute></ProtectedRoute>} />
        <Route path="admin/network" element={<ProtectedRoute><RoleRoute roles={['moderator', 'admin']}><Suspense fallback={<div className="p-4 text-sm text-muted">Loading admin…</div>}><AdminNetwork /></Suspense></RoleRoute></ProtectedRoute>} />
        <Route path="admin/watchlist" element={<ProtectedRoute><RoleRoute roles={['moderator', 'admin']}><Suspense fallback={<div className="p-4 text-sm text-muted">Loading admin…</div>}><AdminWatchlist /></Suspense></RoleRoute></ProtectedRoute>} />
        <Route path="admin/trends" element={<ProtectedRoute><RoleRoute roles={['moderator', 'admin']}><Suspense fallback={<div className="p-4 text-sm text-muted">Loading admin…</div>}><AdminTrends /></Suspense></RoleRoute></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App