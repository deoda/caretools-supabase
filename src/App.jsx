import { useCallback, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProducts } from './hooks/useProducts'
import { useOrders } from './hooks/useOrders'
import { useCart } from './hooks/useCart'
import Nav from './components/Nav'
import HomePage from './components/HomePage'
import ProductsPage from './components/ProductsPage'
import ProductDetailPage from './components/ProductDetailPage'
import AuthPage from './components/AuthPage'
import RecoveryPage from './components/RecoveryPage'
import OrdersPage from './components/OrdersPage'
import AdminPage from './components/admin/AdminPage'
import Cart from './components/Cart'

export default function App() {
  const {
    user, profile, isAdmin, isSuperAdmin, recovering,
    login, register, sendPasswordReset, updatePassword, logout,
    loading: authLoading,
  } = useAuth()
  const { products, loading: productsLoading, loadProducts, saveProduct, deleteProduct } = useProducts(isAdmin)
  const { orders, placeOrder, updateOrderStatus } = useOrders(user?.id, isAdmin)
  const { cart, addToCart, updateQuantity, clearCart } = useCart()

  const [activePage, setActivePage] = useState('home')
  const [selectedId, setSelectedId] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)

  const closeCart = useCallback(() => setIsCartOpen(false), [])

  if (authLoading || productsLoading) {
    return <div className="loading" role="status">Loading...</div>
  }

  // La réinitialisation de mot de passe (lien e-mail) passe avant toute autre page.
  const page = recovering ? 'recovery' : activePage

  // Le produit affiché est relu dans la liste : son stock reste à jour.
  const selectedProduct = products.find((p) => p.id === selectedId) ?? null

  // Le panier mémorise des copies de produits : on recalcule nom, prix et stock
  // depuis le catalogue actuel (le serveur recalcule de toute façon à la commande).
  const liveCart = cart.map((item) => {
    const current = products.find((p) => p.id === item.id)
    return current ? { ...item, name: current.name, price: current.price, stock: current.stock } : item
  })
  const total = liveCart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0)

  const navigate = (target, product = null) => {
    setActivePage(target)
    setSelectedId(product?.id ?? null)
    setIsCartOpen(false)
    window.scrollTo?.(0, 0)
  }

  const openProduct = (product) => navigate('product-detail', product)

  const handleLogout = async () => {
    await logout()
    navigate('home')
  }

  const handleStatusChange = async (order, status) => {
    if (status === 'Cancelled' && !confirm(`Annuler la commande ${order.id} ? Le stock sera remis en rayon et l'annulation est définitive.`)) return
    try {
      await updateOrderStatus(order.id, status)
      if (status === 'Cancelled') await loadProducts()
    } catch (err) { alert(err.message) }
  }

  // Les erreurs remontent au panier, qui les affiche.
  const handlePlaceOrder = async ({ phone, address }) => {
    await placeOrder({
      customer: { name: profile?.name || user.email, phone, address },
      items: cart,
    })
    clearCart()
    await loadProducts() // le stock a changé côté serveur
    navigate('orders')
    alert('Order placed successfully')
  }

  return (
    <div className="app">
      <Nav
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        cartCount={cart.length}
        onNavigate={navigate}
        onOpenCart={() => setIsCartOpen(true)}
        onLogout={handleLogout}
      />

      <main>
        {page === 'home' && (
          <HomePage products={products} onNavigate={navigate} onOpenProduct={openProduct} onAdd={addToCart} />
        )}

        {page === 'products' && (
          <ProductsPage products={products} onOpenProduct={openProduct} onAdd={addToCart} />
        )}

        {page === 'product-detail' && selectedProduct && (
          <ProductDetailPage product={selectedProduct} onBack={() => navigate('products')} onAdd={addToCart} />
        )}

        {page === 'login' && (
          <AuthPage
            onLogin={login}
            onRegister={register}
            onSendReset={sendPasswordReset}
            onDone={() => navigate('home')}
          />
        )}

        {page === 'recovery' && (
          <RecoveryPage onUpdatePassword={updatePassword} onDone={() => navigate('home')} />
        )}

        {page === 'orders' && user && (
          <OrdersPage orders={orders} isAdmin={isAdmin} onStatusChange={handleStatusChange} />
        )}

        {page === 'admin' && isAdmin && (
          <AdminPage
            products={products}
            orders={orders}
            isSuperAdmin={isSuperAdmin}
            saveProduct={saveProduct}
            deleteProduct={deleteProduct}
            loadProducts={loadProducts}
          />
        )}
      </main>

      {isCartOpen && (
        <Cart
          cart={liveCart}
          total={total}
          user={user}
          onClose={closeCart}
          onUpdateQuantity={updateQuantity}
          onPlaceOrder={handlePlaceOrder}
          onLogin={() => navigate('login')}
        />
      )}
    </div>
  )
}
