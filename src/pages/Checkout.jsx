import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, CreditCard, Truck, CheckCircle2, Package,
  LogIn, Map, PenLine, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cartService, orderService } from '../services'
import { getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import LocationPicker from './Locationpicker'
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

  const [form, setForm] = useState({
    full_name: '', address: '', city: '', postal_code: '', country: ''
  })

  useEffect(() => {
    cartService.get()
      .then(data => { setItems(data.items || []); setTotal(data.total || 0) })
      .catch(() => toast.error('Failed to load cart'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

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

  const validateForm = () => {
    const checks = [
      ['full_name',   'Full name'],
      ['address',     'Street address'],
      ['city',        'City'],
      ['postal_code', 'Postal code'],
      ['country',     'Country'],
    ]
    for (const [key, label] of checks) {
      if (!form[key].trim()) { toast.error(`Please fill in ${label}`); return false }
    }
    return true
  }

  const placeOrder = async () => {
    if (!isAuthenticated) { toast.error('Please log in first'); navigate('/login'); return }
    if (!validateForm()) return
    if (items.length === 0) { toast.error('Your cart is empty'); return }
    setPlacing(true)

    if (paymentMethod === 'cod') {
      try {
        const res = await orderService.createCOD(form)
        if (res.order_id) { setCartCount(0); toast.success('Order placed!'); navigate('/orders') }
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Failed to place order')
      } finally { setPlacing(false) }
      return
    }

    try {
      const { key, order_id, amount } = await orderService.createRazorpay(form)
      const options = {
        key, amount, currency: 'INR', name: 'Cartsy', order_id,
        handler: async (response) => {
          try {
            await orderService.verifyRazorpay(response)
            setCartCount(0); toast.success('Payment successful!'); navigate('/orders')
          } catch { toast.error('Payment verification failed') }
        },
        modal: { ondismiss: () => { setPlacing(false); toast('Payment cancelled', { icon: 'ℹ️' }) } },
        theme: { color: '#7c6aff' },
      }
      new window.Razorpay(options).open()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to initiate payment')
      setPlacing(false)
    }
  }

  if (loading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <motion.h1 className={styles.title} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
          Checkout
        </motion.h1>

        {!isAuthenticated && (
          <div className={styles.guestBanner}>
            <LogIn size={14} />
            <span>
              <Link to="/login" style={{ color:'var(--accent-3)', fontWeight:700 }}>Log in</Link>
              {' '}to place your order
            </span>
          </div>
        )}

        <div className={styles.layout}>
          {/* ── Left ── */}
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>

            {/* Address section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><MapPin size={14} /></div>
                <h2 className={styles.sectionTitle}>Delivery address</h2>
                <div className={styles.modeToggle}>
                  <button
                    className={`${styles.modeBtn} ${addressMode === MODE_MAP ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MAP)}
                  ><Map size={12} /> Map</button>
                  <button
                    className={`${styles.modeBtn} ${addressMode === MODE_MANUAL ? styles.modeBtnActive : ''}`}
                    onClick={() => setAddressMode(MODE_MANUAL)}
                  ><PenLine size={12} /> Manual</button>
                </div>
              </div>

              {/* Full name — always visible */}
              <div style={{ marginBottom:14 }}>
                <label className="label">Full name</label>
                <input name="full_name" className="input" placeholder="Arjun Sharma"
                  value={form.full_name} onChange={handleChange} />
              </div>

              <AnimatePresence mode="wait">
                {addressMode === MODE_MAP ? (
                  <motion.div key="map"
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }}
                    style={{ overflow:'hidden' }}
                  >
                    <LocationPicker
                      onAddressResolved={handleAddressResolved}
                      existingAddress={form.address}
                    />

                    {/* Toggle to show/edit the filled fields */}
                    <button className={styles.overrideToggle} onClick={() => setFieldsOpen(o => !o)}>
                      {fieldsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {fieldsOpen ? 'Hide' : 'Edit'} address fields
                    </button>

                    <AnimatePresence>
                      {fieldsOpen && (
                        <motion.div key="fields"
                          initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                          exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }}
                          style={{ overflow:'hidden' }}
                        >
                          <AddressFields form={form} handleChange={handleChange} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div key="manual"
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.25 }}
                    style={{ overflow:'hidden' }}
                  >
                    <AddressFields form={form} handleChange={handleChange} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Payment section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><CreditCard size={14} /></div>
                <h2 className={styles.sectionTitle}>Payment method</h2>
              </div>
              <div className={styles.paymentOptions}>
                {[
                  { value:'cod',      label:'Cash on delivery', desc:'Pay when your order arrives', icon:<Truck size={18} /> },
                  { value:'razorpay', label:'Pay online',        desc:'UPI, cards, netbanking',      icon:<CreditCard size={18} /> },
                ].map(opt => (
                  <button key={opt.value}
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
          </motion.div>

          {/* ── Right: summary ── */}
          <motion.div className={styles.summary}
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
            <h2 className={styles.summaryTitle}><Package size={16} /> Order summary</h2>

            <div className={styles.orderItems}>
              {items.length === 0
                ? <p style={{ fontSize:13, color:'var(--text-muted)' }}>Your cart is empty</p>
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
                      ₹{(item.product?.price * item.quantity)?.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              }
            </div>

            <div className={styles.summaryTotalRow}>
              <span>Total</span>
              <span className={styles.totalAmt}>₹{Number(total).toLocaleString('en-IN')}</span>
            </div>

            <motion.button
              className={`btn btn-primary ${styles.placeBtn}`}
              onClick={placeOrder}
              disabled={placing || items.length === 0}
              whileTap={{ scale:0.97 }}
            >
              {placing
                ? <span style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', display:'inline-block', animation:'spin .65s linear infinite' }} />
                : <><CheckCircle2 size={16} />{!isAuthenticated ? 'Log in to order' : paymentMethod === 'cod' ? 'Place order' : 'Pay now'}</>
              }
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function AddressFields({ form, handleChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
      <div>
        <label className="label">Street address</label>
        <textarea name="address" className="input" rows={2} style={{ resize:'none' }}
          placeholder="123 Main Street, Apt 4B"
          value={form.address} onChange={handleChange} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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