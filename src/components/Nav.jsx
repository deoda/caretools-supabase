export default function Nav({ user, profile, isAdmin, cartCount, onNavigate, onOpenCart, onLogout }) {
  return (
    <nav className="nav" aria-label="Main navigation">
      <button className="nav__brand" onClick={() => onNavigate('home')}>CareTools</button>

      <div className="nav__links">
        <button className="btn btn--nav" onClick={() => onNavigate('home')}>Home</button>
        <button className="btn btn--nav" onClick={() => onNavigate('products')}>Products</button>
        {user && (
          <button className="btn btn--nav" onClick={() => onNavigate('orders')}>
            {isAdmin ? 'Orders' : 'My Orders'}
          </button>
        )}
        {isAdmin && <button className="btn btn--nav" onClick={() => onNavigate('admin')}>Admin</button>}
      </div>

      <div className="nav__right">
        <button className="btn btn--cart" onClick={onOpenCart} aria-label={`Open cart, ${cartCount} items`}>
          Cart ({cartCount})
        </button>
        {user ? (
          <>
            <span className="nav__user">{profile?.name || user.email}</span>
            <button className="btn btn--nav" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <button className="btn btn--nav" onClick={() => onNavigate('login')}>Login</button>
        )}
      </div>
    </nav>
  )
}
