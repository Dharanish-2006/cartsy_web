// src/pages/Admin.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, TrendingUp, Clock, Package,
  ChevronDown, RefreshCw, Wifi, WifiOff,
  Search, ArrowUpRight, Filter, Bell, BellOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'
import { useAdminWS } from '../features/admin/hooks/useAdminSocket'
import styles from './Admin.module.css'

const STATUS_CONFIG = {
  PLACED:    { label: 'Placed',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  PAID:      { label: 'Paid',      color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  SHIPPED:   { label: 'Shipped',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  DELIVERED: { label: 'Delivered', color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}
const ALL_STATUSES = Object.keys(STATUS_CONFIG)

function useNotifications() {
  const [notifs, setNotifs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_notifs') || '[]') } catch { return [] }
  })
  const [unread, setUnread]       = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => { setUnread(notifs.filter(n => !n.read).length) }, [notifs])

  const add = useCallback((data) => {
    const entry = { ...data, id: Date.now(), read: false, ts: new Date().toISOString() }
    setNotifs(prev => {
      const next = [entry, ...prev].slice(0, 50)
      localStorage.setItem('admin_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setNotifs(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      localStorage.setItem('admin_notifs', JSON.stringify(next))
      return next
    })
    setUnread(0)
  }, [])

  return {
    notifs, unread, panelOpen,
    openPanel:  () => { setPanelOpen(true); markAllRead() },
    closePanel: () => setPanelOpen(false),
    add,
  }
}

export default function Admin() {
  const [tab,          setTab]          = useState('orders')
  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [updatingId,   setUpdatingId]   = useState(null)
  const [products,     setProducts]     = useState([])
  const [stockEdit,    setStockEdit]    = useState({})
  const [savingId,     setSavingId]     = useState(null)

  const notifications = useNotifications()

  const fetchOrders = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    try {
      const url = statusFilter
        ? `/api/admin/orders/?status=${statusFilter}`
        : '/api/admin/orders/'
      const res = await api.get(url)
      setOrders(res.data || [])
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/products/')
      setProducts(res.data || [])
    } catch {
      toast.error('Failed to load products')
    }
  }, [])

  useEffect(() => { if (tab === 'inventory') fetchProducts() }, [tab, fetchProducts])

  const handleNewOrder = useCallback((data) => {
    notifications.add(data)
    toast.custom(t => (
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        className={styles.orderToast}
      >
        <span style={{ fontSize: 22 }}>🛒</span>
        <div>
          <div className={styles.toastTitle}>New Order #{data.order_id}</div>
          <div className={styles.toastSub}>₹{data.amount} · {data.customer}</div>
        </div>
        <button onClick={() => toast.dismiss(t.id)} className={styles.toastClose}>✕</button>
      </motion.div>
    ), { duration: 8000 })
    fetchOrders(true)
  }, [notifications, fetchOrders])

  const wsConnected = useAdminWS(handleNewOrder)

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId)
    try {
      await api.patch(`/api/admin/orders/${orderId}/status/`, { status: newStatus })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      toast.success(`Order #${orderId} → ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const updateStock = async (productId) => {
    const val = stockEdit[productId]
    if (val === undefined || val === '') return
    setSavingId(productId)
    try {
      await api.patch(`/api/admin/products/${productId}/stock/`, { stock: Number(val) })
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Number(val), is_in_stock: Number(val) > 0 } : p))
      setStockEdit(prev => { const n = { ...prev }; delete n[productId]; return n })
      toast.success('Stock updated')
    } catch {
      toast.error('Failed to update stock')
    } finally {
      setSavingId(null)
    }
  }

  const filtered = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(o.id).includes(q) || o.user?.username?.toLowerCase().includes(q)
  })

  const stats = {
    total:   orders.length,
    revenue: orders.reduce((s, o) => s + Number(o.total_amount), 0),
    pending: orders.filter(o => o.status === 'PLACED').length,
    today:   orders.filter(o => {
      const d = new Date(o.created_at), n = new Date()
      return d.getDate() === n.getDate() && d.getMonth() === n.getMonth()
    }).length,
  }

  return (
    <div className={styles.page}>

      {/* Notification panel */}
      <AnimatePresence>
        {notifications.panelOpen && (
          <>
            <motion.div className={styles.overlay}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={notifications.closePanel}
            />
            <motion.aside className={styles.notifPanel}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
              <div className={styles.notifHeader}>
                <h2>Notifications</h2>
                <button onClick={notifications.closePanel} className={styles.closeBtn}>✕</button>
              </div>
              <div className={styles.notifList}>
                {notifications.notifs.length === 0
                  ? <div className={styles.notifEmpty}>No notifications yet</div>
                  : notifications.notifs.map(n => (
                    <div key={n.id} className={`${styles.notifItem} ${n.read ? styles.notifRead : ''}`}>
                      <div className={styles.notifDot} />
                      <div>
                        <div className={styles.notifTitle}>Order #{n.order_id}</div>
                        <div className={styles.notifSub}>₹{n.amount} · {n.customer}</div>
                        <div className={styles.notifTime}>
                          {new Date(n.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={styles.inner}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>Manage orders and track sales</p>
          </div>
          <div className={styles.headerRight}>
            <div className={`${styles.wsStatus} ${wsConnected ? styles.wsOn : styles.wsOff}`}>
              {wsConnected ? <><Wifi size={13} /> Live</> : <><WifiOff size={13} /> Offline</>}
            </div>
            <button className={styles.iconBtn} onClick={() => fetchOrders(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
            </button>
            <button className={styles.bellBtn} onClick={notifications.openPanel}>
              {notifications.unread > 0 ? <Bell size={18} /> : <BellOff size={18} />}
              {notifications.unread > 0 && (
                <motion.span className={styles.badge}
                  key={notifications.unread} initial={{ scale: 1.6 }} animate={{ scale: 1 }}>
                  {notifications.unread > 9 ? '9+' : notifications.unread}
                </motion.span>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          {[
            { label: 'Total Orders', value: stats.total,                                 icon: <ShoppingBag size={18} />, accent: '#6366f1' },
            { label: 'Revenue',      value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: <TrendingUp size={18} />,  accent: '#10b981' },
            { label: 'New Today',    value: stats.today,                                 icon: <ArrowUpRight size={18} />,accent: '#f59e0b' },
            { label: 'Pending',      value: stats.pending,                               icon: <Clock size={18} />,       accent: '#ef4444' },
          ].map((s, i) => (
            <motion.div key={s.label} className={styles.statCard}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}>
              <div className={styles.statIcon} style={{ color: s.accent, background: s.accent + '18' }}>
                {s.icon}
              </div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabRow}>
          {[['orders', 'Orders'], ['inventory', 'Inventory']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`${styles.tabBtn} ${tab === key ? styles.tabActive : ''}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ ORDERS ══ */}
        {tab === 'orders' && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <input className={styles.searchInput}
                  placeholder="Search by order ID or customer…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className={styles.filters}>
                <Filter size={13} style={{ color: 'var(--text-muted)' }} />
                {['', ...ALL_STATUSES].map(s => (
                  <button key={s}
                    className={`${styles.filterBtn} ${statusFilter === s ? styles.filterActive : ''}`}
                    onClick={() => setStatusFilter(s)}
                    style={statusFilter === s && s
                      ? { background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, borderColor: STATUS_CONFIG[s].color + '55' }
                      : {}}>
                    {s || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {loading
              ? <div className={styles.loadWrap}><div className={styles.loader} /></div>
              : (
                <motion.div className={styles.tableWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {['Order', 'Customer', 'Items', 'Total', 'Payment', 'Date', 'Status', 'Update'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {filtered.map((order, i) => {
                          const sc = STATUS_CONFIG[order.status] || { label: order.status, color: '#888', bg: '#8882' }
                          return (
                            <motion.tr key={order.id} className={styles.row}
                              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                              <td><span className={styles.orderId}>#{order.id}</span></td>
                              <td>
                                <div className={styles.customer}>
                                  <div className={styles.avatar}>
                                    {(order.user?.username || '?')[0].toUpperCase()}
                                  </div>
                                  <span>{order.user?.username || '—'}</span>
                                </div>
                              </td>
                              <td className={styles.muted}>
                                {order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}
                              </td>
                              <td className={styles.amount}>
                                ₹{Number(order.total_amount).toLocaleString('en-IN')}
                              </td>
                              <td>
                                <span className={`${styles.pill} ${order.payment_method === 'COD' ? styles.pillCod : styles.pillOnline}`}>
                                  {order.payment_method}
                                </span>
                              </td>
                              <td className={styles.muted}>
                                {new Date(order.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </td>
                              <td>
                                <span className={styles.statusPill}
                                  style={{ background: sc.bg, color: sc.color }}>
                                  {sc.label}
                                </span>
                              </td>
                              <td>
                                <div className={styles.selectWrap}>
                                  <select value={order.status}
                                    onChange={e => updateStatus(order.id, e.target.value)}
                                    disabled={updatingId === order.id}
                                    className={styles.select}>
                                    {ALL_STATUSES.map(s => (
                                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={12} className={styles.selectArrow} />
                                  {updatingId === order.id && <div className={styles.miniLoader} />}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={8} className={styles.empty}>
                            <Package size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                            <div>No orders found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </motion.div>
              )
            }
          </>
        )}

        {/* ══ INVENTORY ══ */}
        {tab === 'inventory' && (
          <motion.div className={styles.tableWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {['Product', 'Price', 'Current Stock', 'Status', 'Update Stock'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <motion.tr key={p.id} className={styles.row}
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <td>
                      <div className={styles.customer}>
                        {p.image && (
                          <img src={p.image} alt={p.product_name}
                            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: 600 }}>{p.product_name}</span>
                      </div>
                    </td>
                    <td className={styles.amount}>₹{p.price?.toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
                        color: p.stock === 0 ? '#ef4444' : p.stock < 5 ? '#f59e0b' : '#10b981'
                      }}>
                        {p.stock}
                      </span>
                    </td>
                    <td>
                      <span className={styles.statusPill} style={{
                        background: p.is_in_stock ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color:      p.is_in_stock ? '#10b981' : '#ef4444',
                      }}>
                        {p.is_in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" min="0"
                          placeholder={String(p.stock)}
                          value={stockEdit[p.id] ?? ''}
                          onChange={e => setStockEdit(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className={styles.stockInput}
                        />
                        <button onClick={() => updateStock(p.id)}
                          disabled={savingId === p.id || !stockEdit[p.id]}
                          className={styles.saveBtn}
                          style={{ opacity: !stockEdit[p.id] ? 0.4 : 1 }}>
                          {savingId === p.id ? '…' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      <Package size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                      <div>No products found</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}

      </div>
    </div>
  )
}