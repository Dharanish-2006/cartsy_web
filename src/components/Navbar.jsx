import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Package, LogOut, Menu, X, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { isAuthenticated, logout, user } = useAuth()
  const { cartCount } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => setMobileOpen(false), [location])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/cart', label: 'Cart', icon: <ShoppingCart size={15} /> },
    { to: '/orders', label: 'Orders', icon: <Package size={15} /> },
  ]

  return (
    <>
      <motion.header
        className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={styles.inner}>
          {/* Logo */}
          <Link to="/" className={styles.logo}>
            <div className={styles.logoIcon}><Zap size={16} /></div>
            <span>Cartsy</span>
          </Link>

          {/* Desktop Nav */}
          {isAuthenticated && (
            <nav className={styles.nav}>
              {navLinks.map(({ to, label, icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`${styles.navLink} ${location.pathname === to ? styles.active : ''}`}
                >
                  {icon && <span>{icon}</span>}
                  {label}
                  {to === '/cart' && cartCount > 0 && (
                    <motion.span
                      className={styles.badge}
                      key={cartCount}
                      initial={{ scale: 1.5 }}
                      animate={{ scale: 1 }}
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className={styles.right}>
            {isAuthenticated ? (
              <>
                <span className={styles.greeting}>Hey, {user?.username || 'there'} 👋</span>
                <button onClick={handleLogout} className={`btn btn-ghost btn-sm ${styles.logoutBtn}`}>
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div className={styles.authLinks}>
                <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}

            {isAuthenticated && (
              <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)}>
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className={styles.mobileMenu}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {navLinks.map(({ to, label, icon }) => (
              <Link key={to} to={to} className={styles.mobileLink}>
                {icon}
                {label}
                {to === '/cart' && cartCount > 0 && (
                  <span className={styles.badge}>{cartCount}</span>
                )}
              </Link>
            ))}
            <button onClick={handleLogout} className={styles.mobileLink} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textAlign: 'left' }}>
              <LogOut size={15} />
              Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
