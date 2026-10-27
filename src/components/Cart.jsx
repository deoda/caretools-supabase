import { useEffect, useState } from 'react'
import { formatPrice } from '../lib/format'

export default function Cart({ cart, total, user, onClose, onUpdateQuantity, onPlaceOrder, onLogin }) {
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  // Échap ferme le panier.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const cleanPhone = phone.trim()
    const cleanAddress = address.trim()
    if (!cleanPhone || !cleanAddress) {
      setError('Veuillez renseigner un numéro de téléphone et une adresse de livraison.')
      return
    }
    setError('')
    setPlacing(true)
    try {
      await onPlaceOrder({ phone: cleanPhone, address: cleanAddress })
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="cart" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="cart__head">
          <h2 style={{ margin: 0 }}>Cart</h2>
          <button className="btn btn--nav" style={{ color: 'var(--ink)', borderColor: '#ccc' }} onClick={onClose} aria-label="Close cart">✕</button>
        </div>

        {cart.length === 0 && <p>Your cart is empty</p>}

        {cart.map((item) => {
          const atMax = Number.isFinite(Number(item.stock)) && item.quantity >= Number(item.stock)
          return (
            <div key={item.id} className="cart__item">
              <strong>{item.name}</strong>
              <p style={{ margin: '4px 0' }}>{formatPrice(item.price)} × {item.quantity}</p>
              <div className="cart__qty">
                <button className="btn btn--small" aria-label={`Remove one ${item.name}`}
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>-</button>
                <span aria-live="polite">{item.quantity}</span>
                <button className="btn btn--small" aria-label={`Add one ${item.name}`} disabled={atMax}
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
            </div>
          )
        })}

        <p className="cart__total">Total: {formatPrice(total)}</p>

        {error && <p className="msg-error" role="alert">{error}</p>}

        {user ? (
          <>
            <input className="input" aria-label="Phone number" placeholder="Phone number *" type="tel"
              autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <textarea className="input" style={{ minHeight: 70 }} aria-label="Delivery address"
              placeholder="Delivery address *" autoComplete="street-address"
              value={address} onChange={(e) => setAddress(e.target.value)} />
            <button className="btn btn--primary btn--block" disabled={!cart.length || placing} onClick={submit}>
              {placing ? 'Placing order…' : 'Place order'}
            </button>
          </>
        ) : (
          <button className="btn btn--primary btn--block" onClick={onLogin}>Login to order</button>
        )}
      </aside>
    </>
  )
}
