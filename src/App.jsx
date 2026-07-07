import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

import Login from './pages/Login';
import StudentRegistration from './pages/StudentRegistration';

const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const VotingPage = lazy(() => import('./pages/VotingPage'));
const VoteConfirmation = lazy(() => import('./pages/VoteConfirmation'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Elections = lazy(() => import('./pages/admin/Elections').then(m => ({ default: m.Elections })));
const ElectionDetails = lazy(() => import('./pages/admin/ElectionDetails').then(m => ({ default: m.ElectionDetails })));
const CandidateManagement = lazy(() => import('./pages/CandidateManagement'));
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const ResultsVerification = lazy(() => import('./pages/admin/ResultsVerification'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3"></div>
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<StudentRegistration />} />
            
            <Route path="/student" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route index element={<Suspense fallback={<PageLoader />}><StudentDashboard /></Suspense>} />
              <Route path="vote" element={<Suspense fallback={<PageLoader />}><VotingPage /></Suspense>} />
              <Route path="confirmation" element={<Suspense fallback={<PageLoader />}><VoteConfirmation /></Suspense>} />
            </Route>
            
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
              <Route path="elections" element={<Suspense fallback={<PageLoader />}><Elections /></Suspense>} />
              <Route path="elections/:id" element={<Suspense fallback={<PageLoader />}><ElectionDetails /></Suspense>} />
              <Route path="elections/:id/verify" element={<Suspense fallback={<PageLoader />}><ResultsVerification /></Suspense>} />
              <Route path="candidates" element={<Suspense fallback={<PageLoader />}><CandidateManagement /></Suspense>} />
              <Route path="students" element={<Suspense fallback={<PageLoader />}><StudentManagement /></Suspense>} />
              <Route path="analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
              <Route path="audit-logs" element={<Suspense fallback={<PageLoader />}><AuditLogs /></Suspense>} />
              <Route path="manage-admins" element={<Suspense fallback={<PageLoader />}><AdminManagement /></Suspense>} />
            </Route>
            
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
