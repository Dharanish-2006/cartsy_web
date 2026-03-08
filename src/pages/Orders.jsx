import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ShoppingBag, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getImageUrl } from '../utils/api'
import styles from './Orders.module.css'

const STATUS_MAP = {
  PLACED: { label: 'Placed', cls: 'badge-accent' },
  PAID: { label: 'Paid', cls: 'badge-success' },
  SHIPPED: { label: 'Shipped', cls: 'badge-warning' },
  DELIVERED: { label: 'Delivered', cls: 'badge-success' },
  CANCELLED: { label: 'Cancelled', cls: 'badge-danger' },
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/orders/').then(res => {
      setOrders(res.data || [])
    }).catch(() => toast.error('Failed to load orders')).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <motion.h1
          className={styles.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          My Orders
        </motion.h1>

        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ borderRadius: '50%' }}>
              <Package size={36} />
            </div>
            <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
              No orders yet
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Your orders will appear here
            </p>
            <Link to="/" className="btn btn-primary">
              <ShoppingBag size={16} />
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {orders.map((order, i) => {
              const status = STATUS_MAP[order.status] || { label: order.status, cls: 'badge-muted' }
              return (
                <motion.div
                  key={order.id}
                  className={styles.card}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.orderMeta}>
                      <span className={styles.orderId}>Order #{order.id}</span>
                      <span className={styles.orderDate}>
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <span className={`badge ${status.cls}`}>{status.label}</span>
                  </div>

                  <div className={styles.orderItems}>
                    {order.items?.slice(0, 3).map(item => (
                      <div key={item.product_name} className={styles.orderItem}>
                        <div className={styles.itemImg}>
                          {item.product_image ? (
                            <img src={getImageUrl(item.product_image)} alt={item.product_name} />
                          ) : <Package size={14} />}
                        </div>
                        <div className={styles.itemDetails}>
                          <span className={styles.itemName}>{item.product_name}</span>
                          <span className={styles.itemQty}>×{item.quantity}</span>
                        </div>
                        <span className={styles.itemPrice}>₹{Number(item.price).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    {order.items?.length > 3 && (
                      <p className={styles.moreItems}>+{order.items.length - 3} more items</p>
                    )}
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.totalInfo}>
                      <span className={styles.totalLabel}>Total</span>
                      <span className={styles.totalValue}>₹{Number(order.total_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <ChevronRight size={18} className={styles.chevron} />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
