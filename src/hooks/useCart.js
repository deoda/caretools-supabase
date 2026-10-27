import { useState, useEffect } from 'react'

const CART_KEY = 'caretools-cart'

export function useCart() {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, { ...product, quantity }]
    })
  }

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== id))
    } else {
      setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)))
    }
  }

  const clearCart = () => setCart([])

  const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0)

  return { cart, addToCart, updateQuantity, clearCart, total }
}
