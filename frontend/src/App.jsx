import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Lazy load pages for lower initial bundle size and faster initial load times
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

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <Loader fullPage />;
  if (!user) return <Navigate to="/" />;

  if (!user.hasPin) {
    return <Navigate to="/security-setup" />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullPage />;
  return user ? <Navigate to="/" /> : children;
};

const SecuritySetupRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullPage />;
  if (!user) return <Navigate to="/" />;
  if (user.hasPin) return <Navigate to="/" />;
  return children;
};

const IndexRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <Loader fullPage />;
  if (user) {
    if (!user.hasPin) {
      return <Navigate to="/security-setup" />;
    }
    return <Layout><DashboardPage /></Layout>;
  }
  return <LandingPage />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
    <Route path="/security-setup" element={<SecuritySetupRoute><SecurityLockSetup /></SecuritySetupRoute>} />
    <Route path="/biometric-demo" element={<BiometricDemoPage />} />
    <Route path="/pay/:customerId" element={<PaymentCheckoutPage />} />
    <Route path="/" element={<IndexRoute />} />
    <Route path="/customers" element={<ProtectedRoute><Layout><CustomersPage /></Layout></ProtectedRoute>} />
    <Route path="/customers/:id" element={<ProtectedRoute><Layout><CustomerDetailPage /></Layout></ProtectedRoute>} />
    <Route path="/transactions" element={<Navigate to="/customers" />} />
    <Route path="/cashbook" element={<ProtectedRoute><Layout><CashbookPage /></Layout></ProtectedRoute>} />
    <Route path="/reminders" element={<ProtectedRoute><Layout><RemindersPage /></Layout></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
    <Route path="/history" element={<ProtectedRoute><Layout><PermanentHistoryPage /></Layout></ProtectedRoute>} />
    <Route path="/blockchain" element={<ProtectedRoute><Layout><BlockchainPage /></Layout></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
);

function App() {
  useEffect(() => {
    initSocket();
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "1023724395376-dummyclientid.apps.googleusercontent.com"}>
            <LanguageProvider>
              <SecurityLockProvider>
                <Suspense fallback={<Loader fullPage />}>
                  <AppRoutes />
                </Suspense>
                <ToastContainer
                  position="top-center"
                  style={{ top: '10vh', left: '50%', transform: 'translateX(-50%)' }}
                  autoClose={1500}
                  hideProgressBar
                  pauseOnHover={false}
                  pauseOnFocusLoss={false}
                />
              </SecurityLockProvider>
            </LanguageProvider>
          </GoogleOAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
