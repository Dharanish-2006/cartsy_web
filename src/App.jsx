import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VerifyOTP from './pages/VerifyOTP'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'

function Layout({ children }) {
  return (
    <>
      <div className="mesh-bg" />
      <Navbar />
      {children}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                borderRadius: '12px',
              },
              success: {
                iconTheme: { primary: '#22d3a0', secondary: 'var(--bg-2)' },
              },
              error: {
                iconTheme: { primary: '#ff4d6d', secondary: 'var(--bg-2)' },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />

            <Route path="/" element={
              <Layout><Home /></Layout>
            } />
            <Route path="/product/:id" element={
              <Layout><ProductDetail /></Layout>
            } />
            <Route path="/cart" element={
              <Layout><Cart /></Layout>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <Layout><Checkout /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Layout><Orders /></Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}