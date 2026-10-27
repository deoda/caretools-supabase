import { ORDER_STATUSES } from '../hooks/useOrders'
import { downloadOrderPdf } from '../services/pdf'
import { formatPrice } from '../lib/format'

export default function OrdersPage({ orders, isAdmin, onStatusChange }) {
  return (
    <div className="page">
      <h1>{isAdmin ? 'All Orders' : 'My Orders'}</h1>
      {orders.length === 0 && <p className="muted">No orders yet.</p>}

      {orders.map((o) => (
        <article key={o.id} className="order-card">
          <div className="order-card__head">
            <strong>{o.id}</strong>
            {isAdmin ? (
              <select
                aria-label={`Status of order ${o.id}`}
                value={o.status}
                disabled={o.status === 'Cancelled'}
                onChange={(e) => onStatusChange(o, e.target.value)}
              >
                {ORDER_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            ) : (
              <span>{o.status}</span>
            )}
          </div>

          <p>{formatPrice(o.total)} · {new Date(o.created_at).toLocaleDateString()}</p>
          {isAdmin && (
            <p className="muted">
              {o.customer?.name || '—'} · {o.customer?.phone || '—'} · {o.customer?.address || '—'}
            </p>
          )}

          <ul className="order-card__items">
            {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
              <li key={i}>{it.name} × {it.quantity}</li>
            ))}
          </ul>

          <div className="row">
            <button className="btn btn--small" onClick={() => downloadOrderPdf(o)}>Download PDF</button>
            {isAdmin && (
              <button className="btn btn--small" onClick={() => downloadOrderPdf(o, true)}>Shipping document</button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
