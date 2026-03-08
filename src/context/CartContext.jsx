import { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../utils/api'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0)
  const { isAuthenticated } = useAuth()

  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await api.get('/api/cart/')
      setCartCount(res.data.items?.length || 0)
    } catch {}
  }, [isAuthenticated])

  const increment = () => setCartCount(c => c + 1)

  return (
    <CartContext.Provider value={{ cartCount, refreshCount, setCartCount, increment }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
