import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import Loader from './components/Common/Loader';
import { SecurityLockProvider } from './context/SecurityLockContext';
import { initSocket } from './services/socket';
import API from './api/axios';

// Lazy load pages for lower initial bundle size
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'));
const CashbookPage = lazy(() => import('./pages/CashbookPage'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PermanentHistoryPage = lazy(() => import('./pages/PermanentHistoryPage'));
const SecurityLockSetup = lazy(() => import('./pages/SecuritySetupPage'));
const BiometricDemoPage = lazy(() => import('./pages/BiometricDemoPage'));
const BlockchainPage = lazy(() => import('./pages/BlockchainPage'));
const PaymentCheckoutPage = lazy(() => import('./pages/PaymentCheckoutPage'));

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullPage />;
  return user ? <Navigate to="/" replace /> : children;
};

const SecuritySetupRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullPage />;
  if (!user) return <Navigate to="/" replace />;
  if (user.hasPin) return <Navigate to="/" replace />;
  return children;
};

// Persistent Authenticated App Layout - Keeps Sidebar, Nav, and Shell permanently mounted
const AuthenticatedLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader fullPage />;

  if (!user) {
    if (location.pathname === '/') {
      return <LandingPage />;
    }
    return <Navigate to="/login" replace />;
  }

  if (!user.hasPin) {
    return <Navigate to="/security-setup" replace />;
  }

  return <Layout />;
};

const AppRoutes = () => (
  <Routes>
    {/* Public Standalone Routes */}
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/security-setup" element={<SecuritySetupRoute><SecurityLockSetup /></SecuritySetupRoute>} />
    <Route path="/biometric-demo" element={<BiometricDemoPage />} />
    <Route path="/pay/:customerId/:token" element={<PaymentCheckoutPage />} />
    <Route path="/pay/:customerId" element={<PaymentCheckoutPage />} />
    <Route path="/pay" element={<PaymentCheckoutPage />} />

    {/* Persistent App Shell Layout - Sidebar & Navigation stay permanently mounted during navigation */}
    <Route element={<AuthenticatedLayout />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />
      <Route path="/transactions" element={<Navigate to="/history" replace />} />
      <Route path="/cashbook" element={<CashbookPage />} />
      <Route path="/reminders" element={<RemindersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/history" element={<PermanentHistoryPage />} />
      <Route path="/blockchain" element={<BlockchainPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  useEffect(() => {
    initSocket();

    // Idle prefetch of primary page bundles and datasets so navigation is instantaneous
    const timer = setTimeout(() => {
      // 1. Prefetch page bundles
      import('./pages/DashboardPage');
      import('./pages/CustomersPage');
      import('./pages/CashbookPage');
      import('./pages/PermanentHistoryPage');
      import('./pages/RemindersPage');
      import('./pages/SettingsPage');

      // 2. Prefetch core datasets in background
      try {
        const storedUser = JSON.parse(localStorage.getItem('udhaar-user'));
        if (storedUser?.token) {
          API.get('/transactions/stats').catch(() => {});
          API.get('/customers?sort=balance-high').catch(() => {});
          API.get('/customers').catch(() => {});
          API.get('/cashbook', { params: { period: 'today' } }).catch(() => {});
          API.get('/history').catch(() => {});
        }
      } catch (e) {
        // Safe fail
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
            <LanguageProvider>
              <SecurityLockProvider>
                <Suspense fallback={<Loader fullPage />}>
                  <AppRoutes />
                </Suspense>
                <ToastContainer
                  position="top-right"
                  autoClose={2500}
                  hideProgressBar
                  pauseOnHover={false}
                  pauseOnFocusLoss={false}
                  toastClassName="dark:bg-slate-800 dark:text-white font-medium text-xs rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
                />
              </SecurityLockProvider>
            </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
