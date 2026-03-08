import { useState, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'
import styles from './Auth.module.css'

export default function VerifyOTP() {
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refs = useRef([])
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || ''

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]
    next[i] = val.slice(-1)
    setDigits(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length < 6) { setError('Enter all 6 digits'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/api/verify-otp/', { email, otp })
      toast.success('Account verified! Please log in.')
      navigate('/login')
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid OTP'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={styles.brand}>
          <div className={styles.brandIcon}><Zap size={20} /></div>
          <span className={styles.brandName}>Cartsy</span>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Verify your email</h1>
          <p className={styles.subtitle}>
            We sent a 6-digit code to<br />
            <strong style={{ color: 'var(--text)' }}>{email || 'your email'}</strong>
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.otpInputs}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => refs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={styles.otpInput}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
              />
            ))}
          </div>

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? <span className={styles.btnSpinner} /> : 'Verify Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link to="/login" className={styles.link} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
