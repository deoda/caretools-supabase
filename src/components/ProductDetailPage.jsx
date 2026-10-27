import { formatPrice, formatStock } from '../lib/format'

export default function ProductDetailPage({ product, onBack, onAdd }) {
  const outOfStock = Number(product.stock) <= 0
  const hasVideo = /^https?:\/\//.test(product.video)

  return (
    <div className="page page--narrow">
      <button className="btn btn--back" onClick={onBack}>← Back to products</button>

      <div className="detail">
        {product.images?.[0] ? (
          <img className="detail__img" src={product.images[0]} alt={product.name} />
        ) : (
          <div className="card__noimg">No image</div>
        )}

        <div>
          <h1>{product.name}</h1>
          <p className="detail__price">{formatPrice(product.price)}</p>
          {product.badge && <p><span className="badge">{product.badge}</span></p>}
          {(product.category || product.subcategory) && (
            <p className="muted">{[product.category, product.subcategory].filter(Boolean).join(' › ')}</p>
          )}
          {product.productCode && <p>Code: {product.productCode}</p>}
          {product.size && <p>Size: {product.size}</p>}
          <p>Stock available: {formatStock(product.stock)}</p>
          <p>{product.description || 'No description available.'}</p>
          {hasVideo && (
            <p><a href={product.video} target="_blank" rel="noreferrer">Watch demonstration video</a></p>
          )}
          <button className="btn btn--primary" disabled={outOfStock} onClick={() => onAdd(product)}>
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
