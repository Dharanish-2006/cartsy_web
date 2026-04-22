import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  ArrowLeft,
  Star,
  Package,
  Shield,
  ChevronLeft,
  ChevronRight,
  XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productService, cartService } from '../services'
import { getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import styles from './ProductDetail.module.css'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)

  const { increment } = useCart()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    productService.get(id)
      .then(setProduct)
      .catch(() => {
        toast.error('Product not found')
        navigate('/')
      })
      .finally(() => setLoading(false))
  }, [id])

  const allImages = product
    ? [product.image, ...(product.images?.map(i => i.image) || [])].filter(Boolean)
    : []

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast('Log in to add items to your cart', { icon: '🔒' })
      navigate('/login')
      return
    }

    try {
      await cartService.add(product.id, qty)
      for (let i = 0; i < qty; i++) increment()
      toast.success('Added to cart!')
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="page">
      <div className="container">

        {/* BACK BUTTON */}
        <motion.button
          className={styles.back}
          onClick={() => navigate(-1)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ x: -4 }}
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <div className={styles.grid}>

          {/* ── GALLERY ── */}
          <motion.div
            className={styles.gallery}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className={styles.mainImage}>
              {allImages[activeImg] ? (
                <img src={getImageUrl(allImages[activeImg])} alt={product.product_name} />
              ) : (
                <div className={styles.imgPlaceholder}>
                  <Package size={60} />
                </div>
              )}

              {allImages.length > 1 && (
                <>
                  <button
                    className={`${styles.navBtn} ${styles.navPrev}`}
                    onClick={() =>
                      setActiveImg(i => (i - 1 + allImages.length) % allImages.length)
                    }
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    className={`${styles.navBtn} ${styles.navNext}`}
                    onClick={() =>
                      setActiveImg(i => (i + 1) % allImages.length)
                    }
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {allImages.length > 1 && (
              <div className={styles.thumbs}>
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    className={`${styles.thumb} ${activeImg === i ? styles.thumbActive : ''}`}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={getImageUrl(img)} alt="" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── INFO ── */}
          <motion.div
            className={styles.info}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className={styles.badge}>
              <span className={`badge ${
                product.is_in_stock ? 'badge-accent' : 'badge-error'
              }`}>
                {product.is_in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            <h1 className={styles.name}>{product.product_name}</h1>

            <div className={styles.rating}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  fill={i < 4 ? 'var(--warning)' : 'none'}
                  color="var(--warning)"
                />
              ))}
              <span className={styles.ratingCount}>(124 reviews)</span>
            </div>

            <div className={styles.price}>
              <span className={styles.priceSymbol}>₹</span>
              <span className={styles.priceValue}>
                {product.price?.toLocaleString('en-IN')}
              </span>
            </div>

            <p className={styles.description}>{product.description}</p>

            <div className={styles.qtyRow}>
              <span className={styles.qtyLabel}>Quantity</span>
              <div className={styles.qtyControl}>
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className={styles.qtyBtn}
                >
                  -
                </button>

                <span className={styles.qtyValue}>{qty}</span>

                <button
                  onClick={() => setQty(q => q + 1)}
                  className={styles.qtyBtn}
                >
                  +
                </button>
              </div>
            </div>
            {product.is_in_stock === false || product.stock === 0 ? (
              <div
                style={{
                  width: '100%',
                  height: 54,
                  borderRadius: 'var(--radius)',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: 16,
                  gap: 8,
                }}
              >
                <XCircle size={18} />
                Out of Stock
              </div>
            ) : (
              <>
                {product.stock <= 5 && (
                  <p
                    style={{
                      fontSize: 13,
                      color: '#f59e0b',
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Only {product.stock} left in stock!
                  </p>
                )}

                <motion.button
                  className={`btn btn-primary ${styles.addCartBtn}`}
                  onClick={handleAddToCart}
                  whileTap={{ scale: 0.97 }}
                >
                  <ShoppingCart size={18} />
                  {isAuthenticated ? 'Add to Cart' : 'Log in to Add'}
                </motion.button>
              </>
            )}

            <div className={styles.guarantees}>
              <div className={styles.guarantee}>
                <Shield size={16} />
                <span>Secure payment</span>
              </div>
              <div className={styles.guarantee}>
                <Package size={16} />
                <span>Free shipping above ₹999</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}