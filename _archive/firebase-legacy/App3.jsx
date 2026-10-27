import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProducts } from './hooks/useProducts'
import { useOrders } from './hooks/useOrders'
import { useCart } from './hooks/useCart'
import { downloadOrderPdf } from './services/pdf'

export default function App() {
  const { user, profile, isAdmin, login, logout, loading: authLoading } = useAuth()
  const { products, loading: productsLoading } = useProducts()
  const { orders, placeOrder, updateOrderStatus } = useOrders(user?.id)
  const { cart, addToCart, updateQuantity, clearCart, total } = useCart()

  const [activePage, setActivePage] = useState('home')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isCartOpen, setIsCartOpen] = useState(false)

  if (authLoading || productsLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
  }

  const displayProducts = products

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return '—'
    return `${Number(price).toLocaleString('en-RW')} FRW`
  }

  const formatStock = (stock) => {
    if (stock === null || stock === undefined || stock === '') return '—'
    return stock
  }

  const navigate = (page, product = null) => {
    setActivePage(page)
    setSelectedProduct(product)
    setIsCartOpen(false)
  }

  // ==================== NAVIGATION ====================
  const Nav = () => (
    <nav style={{ background: '#1a1a2e', color: 'white', padding: '12px 24px', display: 'flex', gap: 20, alignItems: 'center' }}>
      <strong style={{ cursor: 'pointer' }} onClick={() => navigate('home')}>CareTools</strong>
      <button onClick={() => navigate('home')} style={navBtn}>Home</button>
      <button onClick={() => navigate('products')} style={navBtn}>Products</button>
      {user && <button onClick={() => navigate('orders')} style={navBtn}>My Orders</button>}
      {isAdmin && <button onClick={() => navigate('admin')} style={navBtn}>Admin</button>}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={() => setIsCartOpen(true)} style={navBtn}>
          Cart ({cart.length})
        </button>
        {user ? (
          <>
            <span>{profile?.name || user.email}</span>
            <button onClick={logout} style={navBtn}>Logout</button>
          </>
        ) : (
          <button onClick={() => navigate('login')} style={navBtn}>Login</button>
        )}
      </div>
    </nav>
  )

  // ==================== HOME ====================
  const HomePage = () => (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h1>Welcome to CareTools</h1>

      {/* Logo */}
      <img
        src="/Logo_CareTools.png"
        alt="CareTools / Samson Orthopedics"
        style={{ maxWidth: 320, height: 'auto', margin: '20px auto', display: 'block' }}
      />

      <p style={{ fontSize: 18 }}>Discover our products.</p>
      <button onClick={() => navigate('products')} style={primaryBtn}>View Products</button>

      <h2 style={{ marginTop: 40 }}>Featured Products</h2>
      <div style={grid}>
        {displayProducts.slice(0, 6).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )

  // ==================== PRODUCTS ====================
  const ProductsPage = () => (
    <div style={{ padding: 24 }}>
      <h1>All Products</h1>
      <p style={{ color: '#666' }}>All products are displayed, even if price or stock are empty.</p>
      <div style={grid}>
        {displayProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {displayProducts.length === 0 && <p>No products at the moment.</p>}
    </div>
  )

  const ProductCard = ({ product }) => (
    <div style={card} onClick={() => navigate('product-detail', product)}>
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }} />
      ) : (
        <div style={{ height: 160, background: '#eee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No image</div>
      )}
      <h3 style={{ margin: '12px 0 4px' }}>{product.name || 'Unnamed'}</h3>
      <p style={{ margin: 0, color: '#555' }}>{formatPrice(product.price)}</p>
      <p style={{ margin: '4px 0', fontSize: 14 }}>Stock: {formatStock(product.stock)}</p>
      <button
        style={primaryBtn}
        onClick={(e) => {
          e.stopPropagation()
          addToCart(product)
        }}
      >
        Add to cart
      </button>
    </div>
  )

  // ==================== PRODUCT DETAIL ====================
  const ProductDetailPage = () => {
    if (!selectedProduct) return <div style={{ padding: 24 }}>Product not found</div>
    const p = selectedProduct
    return (
      <div style={{ padding: 24, maxWidth: 800 }}>
        <button onClick={() => navigate('products')}>← Back</button>
        <h1>{p.name || 'Unnamed'}</h1>
        {p.images?.[0] && <img src={p.images[0]} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />}
        <p>{p.description || 'No description'}</p>
        <p><strong>Price:</strong> {formatPrice(p.price)}</p>
        <p><strong>Stock:</strong> {formatStock(p.stock)}</p>
        <p><strong>Category:</strong> {p.category || '—'}</p>
        <button style={primaryBtn} onClick={() => addToCart(p)}>Add to cart</button>
      </div>
    )
  }

  // ==================== LOGIN ====================
  const LoginPage = () => (
    <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
      <h2>Login</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await login(email, password)
            navigate('home')
          } catch (err) {
            alert(err.message || 'Login error')
          }
        }}
      >
        <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input style={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        <button style={primaryBtn} type="submit">Sign in</button>
      </form>
    </div>
  )

  // ==================== ORDERS ====================
  const OrdersPage = () => (
    <div style={{ padding: 24 }}>
      <h1>My Orders</h1>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} style={{ border: '1px solid #ddd', padding: 16, marginBottom: 12, borderRadius: 8 }}>
          <strong>{o.id}</strong> — {o.status} — {formatPrice(o.total)}
          <br />
          <small>{new Date(o.created_at).toLocaleString()}</small>
          <div style={{ marginTop: 8 }}>
            <button style={navBtn} onClick={() => downloadOrderPdf(o)}>Download PDF</button>
            {isAdmin && (
              <button style={navBtn} onClick={() => updateOrderStatus(o.id, 'Shipped')}>Mark as shipped</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // ==================== ADMIN ====================
  const AdminPage = () => (
    <div style={{ padding: 24 }}>
      <h1>Admin Area</h1>
      <p>Logged in as {profile?.role}</p>
      <h2>All products ({displayProducts.length})</h2>
      <div style={grid}>
        {displayProducts.map((p) => (
          <div key={p.id} style={card}>
            <strong>{p.name}</strong>
            <p>Price: {formatPrice(p.price)} | Stock: {formatStock(p.stock)}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ==================== CART SIDEBAR ====================
  const CartSidebar = () => (
    isCartOpen && (
      <div style={{ position: 'fixed', top: 0, right: 0, width: 360, height: '100%', background: 'white', boxShadow: '-4px 0 12px rgba(0,0,0,0.15)', padding: 20, zIndex: 100, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>Cart</h2>
          <button onClick={() => setIsCartOpen(false)}>✕</button>
        </div>
        {cart.length === 0 && <p>Cart is empty</p>}
        {cart.map((item) => (
          <div key={item.id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
            <strong>{item.name}</strong>
            <p>{formatPrice(item.price)} × {item.quantity}</p>
            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
            <span style={{ margin: '0 8px' }}>{item.quantity}</span>
            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
          </div>
        ))}
        <p><strong>Total: {total.toLocaleString('en-RW')} FRW</strong></p>
        {user ? (
          <button
            style={primaryBtn}
            disabled={!cart.length}
            onClick={async () => {
              try {
                await placeOrder({
                  userId: user.id,
                  customer: { name: profile?.name || user.email, email: user.email },
                  items: cart,
                  subtotal: total,
                  shipping: 0,
                  total,
                })
                clearCart()
                setIsCartOpen(false)
                alert('Order placed successfully')
                navigate('orders')
              } catch (err) {
                alert(err.message || 'Error placing order')
              }
            }}
          >
            Place order
          </button>
        ) : (
          <button style={primaryBtn} onClick={() => { setIsCartOpen(false); navigate('login') }}>
            Login to order
          </button>
        )}
      </div>
    )
  )

  return (
    <div>
      <Nav />
      {activePage === 'home' && <HomePage />}
      {activePage === 'products' && <ProductsPage />}
      {activePage === 'product-detail' && <ProductDetailPage />}
      {activePage === 'login' && <LoginPage />}
      {activePage === 'orders' && user && <OrdersPage />}
      {activePage === 'admin' && isAdmin && <AdminPage />}
      <CartSidebar />
    </div>
  )
}

const navBtn = { background: 'transparent', color: 'white', border: '1px solid #555', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }
const primaryBtn = { background: '#4f46e5', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', marginTop: 8 }
const input = { display: 'block', width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ccc', borderRadius: 6 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 16 }
const card = { border: '1px solid #ddd', borderRadius: 8, padding: 12, cursor: 'pointer' }
