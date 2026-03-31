import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, ShieldCheck, Zap, Truck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { productService, cartService } from '../services'
import ProductCard from '../components/ProductCard'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import styles from './Home.module.css'

const FEATURES = [
  { icon: <Zap size={20} />, title: 'Fast Delivery', desc: 'Express shipping to your doorstep' },
  { icon: <ShieldCheck size={20} />, title: 'Secure Payments', desc: 'Razorpay + COD supported' },
  { icon: <Sparkles size={20} />, title: 'Premium Quality', desc: 'Curated products you\'ll love' },
  { icon: <Truck size={20} />, title: 'Free Returns', desc: 'Hassle-free 30-day returns' },
]

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const { increment } = useCart()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    productService.list()
      .then(setProducts)
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false))
  }, [])

  const handleAddToCart = async (product) => {
    if (!isAuthenticated) {
      toast('Log in to add items to your cart', { icon: '🔒' })
      navigate('/login')
      return
    }
    try {
      await cartService.add(product.id, 1)
      increment()
      toast.success(`${product.product_name} added to cart!`)
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  return (
    <div className="page">
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className={styles.heroBadge}>
              <Sparkles size={12} />
              New arrivals just dropped
            </div>
            <h1 className={styles.heroTitle}>
              Shop what<br />
              <span className={styles.heroHighlight}>you love</span>
            </h1>
            <p className={styles.heroSub}>
              Discover curated products delivered with care.
              From electronics to lifestyle — Cartsy has it all.
            </p>
            <div className={styles.heroCta}>
              <a href="#products" className="btn btn-primary btn-lg">
                Explore Products
                <ArrowRight size={18} />
              </a>
              {isAuthenticated ? (
                <Link to="/orders" className="btn btn-outline btn-lg">My Orders</Link>
              ) : (
                <Link to="/login" className="btn btn-outline btn-lg">Sign In</Link>
              )}
            </div>
          </motion.div>

          <motion.div
            className={styles.heroVisual}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className={styles.heroOrb} />
            <div className={styles.heroCard}>
              <div className={styles.heroCardStat}>
                <span className={styles.heroCardNum}>10K+</span>
                <span className={styles.heroCardLabel}>Happy customers</span>
              </div>
              <div className={styles.heroCardDivider} />
              <div className={styles.heroCardStat}>
                <span className={styles.heroCardNum}>500+</span>
                <span className={styles.heroCardLabel}>Products</span>
              </div>
              <div className={styles.heroCardDivider} />
              <div className={styles.heroCardStat}>
                <span className={styles.heroCardNum}>4.9★</span>
                <span className={styles.heroCardLabel}>Rating</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className={styles.featureItem}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              >
                <div className={styles.featureIcon}>{f.icon}</div>
                <div>
                  <div className={styles.featureTitle}>{f.title}</div>
                  <div className={styles.featureDesc}>{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className={styles.productsSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Featured Products</h2>
              <p className={styles.sectionSub}>Handpicked just for you</p>
            </div>
          </div>

          {loading ? (
            <div className="products-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={styles.skeleton}>
                  <div className="skeleton" style={{ aspectRatio: '4/3' }} />
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="skeleton" style={{ height: '12px', width: '60%' }} />
                    <div className="skeleton" style={{ height: '18px', width: '85%' }} />
                    <div className="skeleton" style={{ height: '24px', width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="products-grid">
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  delay={i * 0.07}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Sparkles size={32} />
              </div>
              <h3>No products yet</h3>
              <p style={{ color: 'var(--text-muted)' }}>Check back soon!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}