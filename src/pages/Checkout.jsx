import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin, CreditCard, Truck, CheckCircle2, Package,
  LogIn, Map, PenLine, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import styles from './Checkout.module.css'

const cartService = {
  get: () => api.get('/api/cart/').then(r => r.data),
}
const orderService = {
  createCOD:      (payload) => api.post('/api/orders/create/',           { ...payload, payment_method: 'COD' }).then(r => r.data),
  createRazorpay: (payload) => api.post('/api/orders/razorpay/',         payload).then(r => r.data),
  verifyRazorpay: (payload) => api.post('/api/orders/razorpay/verify/',  payload).then(r => r.data),
}

const MODE_MAP    = 'map'
const MODE_MANUAL = 'manual'

export default function Checkout() {
  const [items,         setItems]         = useState([])
  const [total,         setTotal]         = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading,       setLoading]       = useState(true)
  const [placing,       setPlacing]       = useState(false)
  const [addressMode,   setAddressMode]   = useState(MODE_MANUAL)
  const [fieldsOpen,    setFieldsOpen]    = useState(true)

  const navigate            = useNavigate()
  const { setCartCount }    = useCart()
  const { isAuthenticated } = useAuth()

  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

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

  const placeOrder = useCallback(() => {
    if (!isAuthenticated) {
      toast.error('Please log in first')
      navigate('/login')
      return
    }
    if (!validateForm())       return
    if (items.length === 0)    { toast.error('Your cart is empty'); return }

    setPlacing(true)

    if (paymentMethod === 'cod') {
      orderService.createCOD(form)
        .then(res => {
          if (!mountedRef.current) return
          if (res.order_id) {
            setCartCount(0)
            toast.success('Order placed successfully!')
            navigate('/orders')
          } else {
            toast.error(res.error || 'Failed to place order')
            setPlacing(false)
          }
        })
        .catch(err => {
          if (!mountedRef.current) return
          toast.error(err?.response?.data?.error || 'Failed to place order')
          setPlacing(false)
        })
      return
    }

    if (typeof window.Razorpay === 'undefined') {
      toast.error('Payment gateway not loaded — please refresh the page.')
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
            orderService.verifyRazorpay({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            })
              .then(() => {
                if (!mountedRef.current) return
                setCartCount(0)
                toast.success('Payment successful!')
                navigate('/orders')
              })
              .catch(() => {
                toast.error('Payment verification failed — contact support.')
                if (mountedRef.current) setPlacing(false)
              })
          },
          modal: {
            ondismiss: () => {
              if (mountedRef.current) setPlacing(false)
              toast('Payment cancelled', { icon: 'ℹ️' })
            },
          },
          theme: { color: '#7c6aff' },
        }

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
                    className={`${styles.modeBtn} ${addressMode === MODE_MANUAL ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MANUAL)}
                  ><PenLine size={12} /> Manual</button>
                  <button
                    className={`${styles.modeBtn} ${addressMode === MODE_MAP ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MAP)}
                  ><Map size={12} /> Map</button>
                </div>
              </div>

              {/* Full name — always visible */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">Full name</label>
                <input
                  name="full_name"
                  className="input"
                  placeholder="Arjun Sharma"
                  value={form.full_name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>

              {/* Manual mode */}
              <div
                style={{ display: addressMode === MODE_MANUAL ? 'block' : 'none' }}
              >
                <AddressFields form={form} handleChange={handleChange} />
              </div>
              <div
                style={{ display: addressMode === MODE_MAP ? 'block' : 'none' }}
              >
                <MapAddressSection
                  form={form}
                  handleChange={handleChange}
                  fieldsOpen={fieldsOpen}
                  setFieldsOpen={setFieldsOpen}
                  onAddressResolved={handleAddressResolved}
                />
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
                  { value: 'cod',      label: 'Cash on delivery', desc: 'Pay when your order arrives',    icon: <Truck size={18} /> },
                  { value: 'razorpay', label: 'Pay online',       desc: 'UPI, cards, netbanking via Razorpay', icon: <CreditCard size={18} /> },
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

function AddressFields({ form, handleChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="label">Street address</label>
        <textarea
          name="address"
          className="input"
          rows={2}
          style={{ resize: 'none' }}
          placeholder="123 Anna Salai, Apt 4B"
          value={form.address}
          onChange={handleChange}
          autoComplete="street-address"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">City</label>
          <input
            name="city"
            className="input"
            placeholder="Chennai"
            value={form.city}
            onChange={handleChange}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <label className="label">Postal code</label>
          <input
            name="postal_code"
            className="input"
            placeholder="600001"
            value={form.postal_code}
            onChange={handleChange}
            autoComplete="postal-code"
          />
        </div>
      </div>
      <div>
        <label className="label">Country</label>
        <input
          name="country"
          className="input"
          placeholder="India"
          value={form.country}
          onChange={handleChange}
          autoComplete="country-name"
        />
      </div>
    </div>
  )
}

function MapAddressSection({ form, handleChange, fieldsOpen, setFieldsOpen, onAddressResolved }) {
  const [LocationPicker, setLocationPicker] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('./Locationpicker')
      .then(m => { if (!cancelled) setLocationPicker(() => m.default) })
      .catch(() => { /* Locationpicker not available — map mode will show a fallback */ })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      {LocationPicker
        ? (
          <div style={{ opacity: 1, transition: 'opacity 0.2s' }}>
            <LocationPicker
              onAddressResolved={onAddressResolved}
              existingAddress={form.address}
            />
          </div>
        )
        : (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Map picker unavailable — please fill in the address manually below.
          </p>
        )
      }

      <button
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', marginTop: 8, padding: 0,
        }}
        onClick={() => setFieldsOpen(o => !o)}
      >
        {fieldsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {fieldsOpen ? 'Hide' : 'Edit'} address fields
      </button>
      <div style={{
        maxHeight: fieldsOpen ? '400px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ paddingTop: 12 }}>
          <AddressFields form={form} handleChange={handleChange} />
        </div>
      </div>
    </div>
  )
}