import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, CreditCard, Truck, CheckCircle2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import styles from './Checkout.module.css'

export default function Checkout() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const navigate = useNavigate()
  const { setCartCount } = useCart()

  const [form, setForm] = useState({
    full_name: '', address: '', city: '', postal_code: '', country: ''
  })

  useEffect(() => {
    api.get('/api/cart/').then(res => {
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    }).catch(() => toast.error('Failed to load cart')).finally(() => setLoading(false))
  }, [])

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const placeOrder = async () => {
    for (const key of Object.keys(form)) {
      if (!form[key].trim()) {
        toast.error(`Please fill in ${key.replace('_', ' ')}`)
        return
      }
    }

    setPlacing(true)

    if (paymentMethod === 'cod') {
      try {
        const res = await api.post('/api/orders/create/', { ...form, payment_method: 'COD' })
        if (res.data.order_id) {
          setCartCount(0)
          toast.success('Order placed successfully!')
          navigate('/orders')
        }
      } catch {
        toast.error('Failed to place order')
      } finally {
        setPlacing(false)
      }
    } else {
      // Razorpay
      try {
        const res = await api.post('/api/orders/razorpay/', { ...form })
        const { key, order_id, amount } = res.data

        const options = {
          key,
          amount,
          currency: 'INR',
          name: 'Cartsy',
          order_id,
          handler: async function (response) {
            try {
              await api.post('/orders/razorpay/verify/', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
              setCartCount(0)
              toast.success('Payment successful!')
              navigate('/orders')
            } catch {
              toast.error('Payment verification failed')
            }
          },
          theme: { color: '#7c6aff' },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      } catch {
        toast.error('Failed to initiate payment')
      } finally {
        setPlacing(false)
      }
    }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page">
      <script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="container">
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Checkout
        </motion.h1>

        <div className={styles.layout}>
          {/* Left: Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Shipping */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><MapPin size={16} /></div>
                <h2 className={styles.sectionTitle}>Shipping Details</h2>
              </div>

              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className="label">Full Name</label>
                  <input name="full_name" className="input" placeholder="John Doe" value={form.full_name} onChange={handleChange} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className="label">Address</label>
                  <textarea name="address" className={`input ${styles.textarea}`} placeholder="Street address" value={form.address} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <label className="label">City</label>
                  <input name="city" className="input" placeholder="Mumbai" value={form.city} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <label className="label">Postal Code</label>
                  <input name="postal_code" className="input" placeholder="400001" value={form.postal_code} onChange={handleChange} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label className="label">Country</label>
                  <input name="country" className="input" placeholder="India" value={form.country} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}><CreditCard size={16} /></div>
                <h2 className={styles.sectionTitle}>Payment Method</h2>
              </div>

              <div className={styles.paymentOptions}>
                {[
                  { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: <Truck size={20} /> },
                  { value: 'razorpay', label: 'Pay Online', desc: 'UPI, Cards, Netbanking via Razorpay', icon: <CreditCard size={20} /> },
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
          </motion.div>

          {/* Right: Summary */}
          <motion.div
            className={styles.summary}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className={styles.summaryTitle}>
              <Package size={18} />
              Order Summary
            </h2>

            <div className={styles.orderItems}>
              {items.map(item => (
                <div key={item.id} className={styles.orderItem}>
                  <div className={styles.orderItemImg}>
                    {item.product?.image ? (
                      <img src={getImageUrl(item.product.image)} alt={item.product.product_name} />
                    ) : <Package size={16} />}
                  </div>
                  <div className={styles.orderItemInfo}>
                    <span className={styles.orderItemName}>{item.product?.product_name}</span>
                    <span className={styles.orderItemQty}>Qty: {item.quantity}</span>
                  </div>
                  <span className={styles.orderItemPrice}>
                    ₹{(item.product?.price * item.quantity)?.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.summaryTotalRow}>
              <span>Total</span>
              <span className={styles.totalAmt}>₹{Number(total).toLocaleString('en-IN')}</span>
            </div>

            <motion.button
              className={`btn btn-primary ${styles.placeBtn}`}
              onClick={placeOrder}
              disabled={placing || items.length === 0}
              whileTap={{ scale: 0.97 }}
            >
              {placing ? (
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  {paymentMethod === 'cod' ? 'Place Order' : 'Pay Now'}
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
