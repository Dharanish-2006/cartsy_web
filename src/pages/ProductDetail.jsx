import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingCart, ArrowLeft, Star, Package, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getImageUrl } from '../utils/api'
import { useCart } from '../context/CartContext'
import styles from './ProductDetail.module.css'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const { increment } = useCart()

  useEffect(() => {
    api.get(`/api/products/${id}/`).then(res => {
      setProduct(res.data)
    }).catch(() => {
      toast.error('Product not found')
      navigate('/')
    }).finally(() => setLoading(false))
  }, [id])

  const allImages = product ? [product.image, ...(product.images?.map(i => i.image) || [])].filter(Boolean) : []

  const handleAddToCart = async () => {
    try {
      await api.post('/api/cart/', { product_id: product.id, quantity: qty })
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
          {/* Gallery */}
          <motion.div
            className={styles.gallery}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.mainImage}>
              {allImages[activeImg] ? (
                <img src={getImageUrl(allImages[activeImg])} alt={product.product_name} />
              ) : (
                <div className={styles.imgPlaceholder}><Package size={60} /></div>
              )}
              {allImages.length > 1 && (
                <>
                  <button className={`${styles.navBtn} ${styles.navPrev}`} onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)}>
                    <ChevronLeft size={20} />
                  </button>
                  <button className={`${styles.navBtn} ${styles.navNext}`} onClick={() => setActiveImg(i => (i + 1) % allImages.length)}>
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

          {/* Info */}
          <motion.div
            className={styles.info}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className={styles.badge}>
              <span className="badge badge-accent">In Stock</span>
            </div>

            <h1 className={styles.name}>{product.product_name}</h1>

            <div className={styles.rating}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill={i < 4 ? 'var(--warning)' : 'none'} color="var(--warning)" />
              ))}
              <span className={styles.ratingCount}>(124 reviews)</span>
            </div>

            <div className={styles.price}>
              <span className={styles.priceSymbol}>₹</span>
              <span className={styles.priceValue}>{product.price?.toLocaleString('en-IN')}</span>
            </div>

            <p className={styles.description}>{product.description}</p>

            <div className={styles.qtyRow}>
              <span className={styles.qtyLabel}>Quantity</span>
              <div className={styles.qtyControl}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className={styles.qtyBtn}>-</button>
                <span className={styles.qtyValue}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className={styles.qtyBtn}>+</button>
              </div>
            </div>

            <motion.button
              className={`btn btn-primary ${styles.addCartBtn}`}
              onClick={handleAddToCart}
              whileTap={{ scale: 0.97 }}
            >
              <ShoppingCart size={18} />
              Add to Cart
            </motion.button>

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
