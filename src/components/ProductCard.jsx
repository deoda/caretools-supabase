import { formatPrice, formatStock } from '../lib/format'

export default function ProductCard({ product, showStock = false, onOpen, onAdd }) {
  const outOfStock = Number(product.stock) <= 0
  const open = () => onOpen(product)

  return (
    <article className="card">
      {/* Zone cliquable accessible au clavier (Entrée ou Espace) */}
      <div
        className="card__main"
        role="link"
        tabIndex={0}
        aria-label={`View ${product.name}`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open()
          }
        }}
      >
        {product.images?.[0] ? (
          <img className="card__img" src={product.images[0]} alt={product.name} loading="lazy" />
        ) : (
          <div className="card__noimg">No image</div>
        )}
        <h3>{product.name}</h3>
        <p className="price">{formatPrice(product.price)}</p>
        {showStock && <p className="muted">Stock: {formatStock(product.stock)}</p>}
      </div>

      <button className="btn btn--primary" disabled={outOfStock} onClick={() => onAdd(product)}>
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </button>
    </article>
  )
}
