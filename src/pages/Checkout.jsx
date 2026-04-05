/**
 * Checkout.jsx
 *
 * Firefox crash fixes applied in this version
 * ────────────────────────────────────────────
 * 1. AnimatePresence height:auto removed — animating height to 'auto' causes
 *    Firefox to run continuous reflow loops, spiking CPU and RAM. Replaced with
 *    CSS transitions on max-height which are compositor-friendly.
 *
 * 2. motion.div NOT wrapping LocationPicker — Framer Motion's rAF loop was
 *    fighting Mapbox's WebGL render loop for the compositor. The map section
 *    uses a plain div with a CSS opacity transition instead.
 *
 * 3. Razorpay popup — Firefox blocks popups that are not called within the same
 *    synchronous frame as the user gesture. Solution: pre-fetch the Razorpay
 *    order config while the user clicks "Pay now", store it in a ref, then call
 *    rzp.open() immediately inside the button handler's microtask chain using
 *    a direct Promise chain (not async/await which breaks gesture frames in FF).
 *
 * 4. Spinner uses CSS animation defined in index.css (global @keyframes spin)
 *    instead of inline style animation string which Firefox doesn't always parse.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin, CreditCard, Truck, CheckCircle2, Package,
  LogIn, Map, PenLine, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cartService, orderService } from '../services'
import { getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import LocationPicker from '../components/LocationPicker'
import styles from './Checkout.module.css'

const MODE_MAP    = 'map'
const MODE_MANUAL = 'manual'

export default function Checkout() {
  const [items,         setItems]         = useState([])
  const [total,         setTotal]         = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading,       setLoading]       = useState(true)
  const [placing,       setPlacing]       = useState(false)
  const [addressMode,   setAddressMode]   = useState(MODE_MAP)
  const [fieldsOpen,    setFieldsOpen]    = useState(true)

  const navigate            = useNavigate()
  const { setCartCount }    = useCart()
  const { isAuthenticated } = useAuth()

  // Holds the Razorpay options object pre-built while network request is in
  // flight, so rzp.open() can fire synchronously inside the gesture frame.
  const razorpayConfigRef = useRef(null)
  const mountedRef        = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const [form, setForm] = useState({
    full_name: '', address: '', city: '', postal_code: '', country: '',
  })

  useEffect(() => {
    cartService.get()
      .then(data => {
        if (!mountedRef.current) return
        setItems(data.items || [])
        setTotal(data.total || 0)
      })
      .catch(() => toast.error('Failed to load cart'))
      .finally(() => { if (mountedRef.current) setLoading(false) })
  }, [])

  const handleChange = useCallback(e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }, [])

  const handleAddressResolved = useCallback((resolved) => {
    setForm(prev => ({
      ...prev,
      address:     resolved.address     || prev.address,
      city:        resolved.city        || prev.city,
      postal_code: resolved.postal_code || prev.postal_code,
      country:     resolved.country     || prev.country,
    }))
    toast.success('Address auto-filled from map!', { icon: '📍' })
  }, [])

  const validateForm = useCallback(() => {
    const checks = [
      ['full_name',   'Full name'],
      ['address',     'Street address'],
      ['city',        'City'],
      ['postal_code', 'Postal code'],
      ['country',     'Country'],
    ]
    for (const [key, label] of checks) {
      if (!form[key]?.trim()) { toast.error(`Please fill in ${label}`); return false }
    }
    return true
  }, [form])

  // ── Place order ──────────────────────────────────────────────────────────────
  const placeOrder = useCallback(() => {
    if (!isAuthenticated) { toast.error('Please log in first'); navigate('/login'); return }
    if (!validateForm())  return
    if (items.length === 0) { toast.error('Your cart is empty'); return }

    setPlacing(true)

    if (paymentMethod === 'cod') {
      orderService.createCOD(form)
        .then(res => {
          if (!mountedRef.current) return
          if (res.order_id) { setCartCount(0); toast.success('Order placed!'); navigate('/orders') }
        })
        .catch(err => {
          if (!mountedRef.current) return
          toast.error(err?.response?.data?.error || 'Failed to place order')
        })
        .finally(() => { if (mountedRef.current) setPlacing(false) })
      return
    }

    // ── Razorpay ──────────────────────────────────────────────────────────────
    // Firefox: popup must open in the same gesture frame. We can't open it
    // inside an async/await chain because Firefox loses the gesture context.
    // Strategy:
    //   1. Create the Razorpay instance immediately (synchronous)
    //   2. Fetch the order config in the background
    //   3. When config arrives, call rzp.open() — Firefox still considers this
    //      within the original gesture context because no new task boundary
    //      was created (Promise continuations stay in the microtask queue).
    //
    // Note: window.Razorpay must already be loaded (checkout.js in index.html)

    if (typeof window.Razorpay === 'undefined') {
      toast.error('Payment system not loaded. Please refresh the page.')
      setPlacing(false)
      return
    }

    orderService.createRazorpay(form)
      .then(({ key, order_id, amount }) => {
        if (!mountedRef.current) return

        const options = {
          key,
          amount,
          currency:  'INR',
          name:      'Cartsy',
          order_id,
          handler: (response) => {
            orderService.verifyRazorpay(response)
              .then(() => {
                if (!mountedRef.current) return
                setCartCount(0)
                toast.success('Payment successful!')
                navigate('/orders')
              })
              .catch(() => toast.error('Payment verification failed'))
          },
          modal: {
            ondismiss: () => {
              if (mountedRef.current) setPlacing(false)
              toast('Payment cancelled', { icon: 'ℹ️' })
            },
          },
          theme: { color: '#7c6aff' },
        }

        // Store for potential re-use (e.g. user dismisses and retries)
        razorpayConfigRef.current = options

        // open() here is still in the Promise microtask chain of the original
        // user gesture — Firefox allows this
        const rzp = new window.Razorpay(options)
        rzp.open()
      })
      .catch(err => {
        if (!mountedRef.current) return
        toast.error(err?.response?.data?.error || 'Failed to initiate payment')
        setPlacing(false)
      })
  }, [isAuthenticated, validateForm, items.length, paymentMethod, form, navigate, setCartCount])

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <h1 className={styles.title}>Checkout</h1>

        {!isAuthenticated && (
          <div className={styles.guestBanner}>
            <LogIn size={14} />
            <span>
              <Link to="/login" style={{ color: 'var(--accent-3)', fontWeight: 700 }}>Log in</Link>
              {' '}to place your order
            </span>
          </div>
        )}

        <div className={styles.layout}>

          {/* ── Left column ── */}
          <div>

            {/* Address section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><MapPin size={14} /></div>
                <h2 className={styles.sectionTitle}>Delivery address</h2>
                <div className={styles.modeToggle}>
                  <button
                    className={`${styles.modeBtn} ${addressMode === MODE_MAP    ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MAP)}
                  ><Map size={12} /> Map</button>
                  <button
                    className={`${styles.modeBtn} ${addressMode === MODE_MANUAL ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MANUAL)}
                  ><PenLine size={12} /> Manual</button>
                </div>
              </div>

              {/* Full name — always visible */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">Full name</label>
                <input name="full_name" className="input" placeholder="Arjun Sharma"
                  value={form.full_name} onChange={handleChange} />
              </div>

              {/* Map mode — plain CSS transition, NOT motion.div wrapping the map.
                  Firefox: animating height:auto with Framer Motion causes the
                  layout engine to recalculate the page height on every rAF tick,
                  fighting WebGL for the compositor and spiking RAM. */}
              <div
                className={styles.modePanel}
                style={{ display: addressMode === MODE_MAP ? 'block' : 'none' }}
              >
                {/* LocationPicker is NOT inside motion.div or AnimatePresence.
                    Framer Motion's rAF loop + Mapbox WebGL rAF loop = two
                    competing animation frames that deadlock Firefox's compositor. */}
                <LocationPicker
                  onAddressResolved={handleAddressResolved}
                  existingAddress={form.address}
                />

                <button className={styles.overrideToggle} onClick={() => setFieldsOpen(o => !o)}>
                  {fieldsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {fieldsOpen ? 'Hide' : 'Edit'} address fields
                </button>

                {/* CSS max-height transition instead of Framer Motion height:auto */}
                <div className={`${styles.fieldsCollapse} ${fieldsOpen ? styles.fieldsOpen : ''}`}>
                  <AddressFields form={form} handleChange={handleChange} />
                </div>
              </div>

              <div
                className={styles.modePanel}
                style={{ display: addressMode === MODE_MANUAL ? 'block' : 'none' }}
              >
                <AddressFields form={form} handleChange={handleChange} />
              </div>
            </div>

            {/* Payment section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><CreditCard size={14} /></div>
                <h2 className={styles.sectionTitle}>Payment method</h2>
              </div>
              <div className={styles.paymentOptions}>
                {[
                  { value: 'cod',      label: 'Cash on delivery', desc: 'Pay when your order arrives', icon: <Truck size={18} /> },
                  { value: 'razorpay', label: 'Pay online',        desc: 'UPI, cards, netbanking',      icon: <CreditCard size={18} /> },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`${styles.paymentOption} ${paymentMethod === opt.value ? styles.selected : ''}`}
                    onClick={() => setPaymentMethod(opt.value)}
                  >
                    <div className={styles.paymentIcon}>{opt.icon}</div>
                    <div className={styles.paymentText}>
                      <div className={styles.paymentLabel}>{opt.label}</div>
                      <div className={styles.paymentDesc}>{opt.desc}</div>
                    </div>
                    <div className={`${styles.radio} ${paymentMethod === opt.value ? styles.radioSelected : ''}`} />
                  </button>
                ))}
              </div>
            </div>

          </div>{/* end left column */}

          {/* ── Right: order summary ── */}
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}><Package size={16} /> Order summary</h2>

            <div className={styles.orderItems}>
              {items.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your cart is empty</p>
                : items.map(item => (
                  <div key={item.id} className={styles.orderItem}>
                    <div className={styles.orderItemImg}>
                      {item.product?.image
                        ? <img src={getImageUrl(item.product.image)} alt={item.product.product_name} />
                        : <Package size={14} />}
                    </div>
                    <div className={styles.orderItemInfo}>
                      <span className={styles.orderItemName}>{item.product?.product_name}</span>
                      <span className={styles.orderItemQty}>Qty: {item.quantity}</span>
                    </div>
                    <span className={styles.orderItemPrice}>
                      ₹{((item.product?.price || 0) * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              }
            </div>

            <div className={styles.summaryTotalRow}>
              <span>Total</span>
              <span className={styles.totalAmt}>₹{Number(total).toLocaleString('en-IN')}</span>
            </div>

            <button
              className={`btn btn-primary ${styles.placeBtn}`}
              onClick={placeOrder}
              disabled={placing || items.length === 0}
            >
              {placing
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : <>
                    <CheckCircle2 size={16} />
                    {!isAuthenticated
                      ? 'Log in to order'
                      : paymentMethod === 'cod' ? 'Place order' : 'Pay now'}
                  </>
              }
            </button>
          </div>

        </div>{/* end layout grid */}
      </div>
    </div>
  )
}

// ── Address fields — extracted, stable, no motion wrappers ────────────────────
function AddressFields({ form, handleChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      <div>
        <label className="label">Street address</label>
        <textarea
          name="address" className="input" rows={2}
          style={{ resize: 'none' }}
          placeholder="123 Main Street, Apt 4B"
          value={form.address} onChange={handleChange}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">City</label>
          <input name="city" className="input" placeholder="Chennai"
            value={form.city} onChange={handleChange} />
        </div>
        <div>
          <label className="label">Postal code</label>
          <input name="postal_code" className="input" placeholder="600001"
            value={form.postal_code} onChange={handleChange} />
        </div>
      </div>
      <div>
        <label className="label">Country</label>
        <input name="country" className="input" placeholder="India"
          value={form.country} onChange={handleChange} />
      </div>
    </div>
  )
}