import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { cartService } from '../services'
import { getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import styles from './Cart.module.css'

export default function Cart() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { setCartCount } = useCart()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const fetchCart = async () => {
    if (!isAuthenticated) {
      // Guest users see an empty cart with a prompt to log in
      setLoading(false)
      return
    }
    try {
      const data = await cartService.get()
      setItems(data.items || [])
      setTotal(data.total || 0)
      setCartCount(data.items?.length || 0)
    } catch {
      toast.error('Failed to load cart')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCart() }, [isAuthenticated])

  const updateQty = async (itemId, action) => {
    try {
      await cartService.update(itemId, action)
      fetchCart()
    } catch {
      toast.error('Failed to update quantity')
    }
  }

  const removeItem = async (itemId) => {
    try {
      // Decrease until gone — backend deletes at qty 0
      await cartService.update(itemId, 'decrease')
      fetchCart()
      toast.success('Item removed')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to checkout')
      navigate('/login')
      return
    }
    navigate('/checkout')
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  // Guest empty state
  if (!isAuthenticated) return (
    <div className="page">
      <div className="container">
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Your Cart</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ borderRadius: '50%' }}>
            <ShoppingCart size={36} />
          </div>
          <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
            Sign in to see your cart
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Log in to add items and checkout
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/login" className="btn btn-primary">Log in</Link>
            <Link to="/" className="btn btn-ghost">Continue shopping</Link>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Your Cart</h1>
            <span className={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ borderRadius: '50%' }}>
                <ShoppingCart size={36} />
              </div>
              <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                Your cart is empty
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                Looks like you haven't added anything yet
              </p>
              <Link to="/" className="btn btn-primary">
                <ShoppingBag size={16} />
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className={styles.layout}>
              {/* Items */}
              <div className={styles.items}>
                <AnimatePresence mode="popLayout">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      className={styles.item}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      layout
                    >
                      <div className={styles.itemImage}>
                        {item.product?.image ? (
                          <img src={getImageUrl(item.product.image)} alt={item.product.product_name} />
                        ) : (
                          <div className={styles.imgPlaceholder}><ShoppingBag size={20} /></div>
                        )}
                      </div>

                      <div className={styles.itemInfo}>
                        <h3 className={styles.itemName}>{item.product?.product_name}</h3>
                        <p className={styles.itemPrice}>₹{item.product?.price?.toLocaleString('en-IN')} each</p>
                      </div>

                      <div className={styles.itemControls}>
                        <div className={styles.qtyControl}>
                          <button className={styles.qtyBtn} onClick={() => updateQty(item.id, 'decrease')}>
                            <Minus size={14} />
                          </button>
                          <span className={styles.qtyValue}>{item.quantity}</span>
                          <button className={styles.qtyBtn} onClick={() => updateQty(item.id, 'increase')}>
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className={styles.itemTotal}>
                          ₹{(item.product?.price * item.quantity)?.toLocaleString('en-IN')}
                        </div>

                        <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Summary */}
              <motion.div
                className={styles.summary}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className={styles.summaryTitle}>Order Summary</h2>

                <div className={styles.summaryRows}>
                  <div className={styles.summaryRow}>
                    <span>Subtotal</span>
                    <span>₹{Number(total).toLocaleString('en-IN')}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Shipping</span>
                    <span className={styles.free}>Free</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Tax</span>
                    <span>₹0</span>
                  </div>
                </div>

                <div className={styles.summaryTotal}>
                  <span>Total</span>
                  <span className={styles.totalAmount}>₹{Number(total).toLocaleString('en-IN')}</span>
                </div>

                <button onClick={handleCheckout} className={`btn btn-primary ${styles.checkoutBtn}`}>
                  Proceed to Checkout
                  <ArrowRight size={16} />
                </button>

                <Link to="/" className={`btn btn-ghost ${styles.continueBtn}`}>
                  Continue Shopping
                </Link>
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}