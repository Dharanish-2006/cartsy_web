import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ShoppingCart, Star } from 'lucide-react'
import { getImageUrl } from '../utils/api'
import styles from './ProductCard.module.css'

export default function ProductCard({ product, onAddToCart, delay = 0 }) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4 }}
    >
      <Link to={`/product/${product.id}`} className={styles.imageWrap}>
        {product.image ? (
          <img
            src={getImageUrl(product.image)}
            alt={product.product_name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <ShoppingCart size={32} color="var(--text-dim)" />
          </div>
        )}
        <div className={styles.overlay} />
      </Link>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.category}>Product</span>
          <div className={styles.rating}>
            <Star size={11} fill="var(--warning)" color="var(--warning)" />
            <span>4.8</span>
          </div>
        </div>

        <Link to={`/product/${product.id}`}>
          <h3 className={styles.name}>{product.product_name}</h3>
        </Link>

        <div className={styles.footer}>
          <div className={styles.price}>
            <span className={styles.priceCurrency}>₹</span>
            <span className={styles.priceAmount}>{product.price?.toLocaleString('en-IN')}</span>
          </div>

          <motion.button
            className={styles.addBtn}
            onClick={() => onAddToCart?.(product)}
            whileTap={{ scale: 0.92 }}
          >
            <ShoppingCart size={14} />
            <span>Add</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
