import ProductCard from './ProductCard'
import { isVisibleProduct } from '../lib/format'

export default function HomePage({ products, onNavigate, onOpenProduct, onAdd }) {
  const featured = products.filter(isVisibleProduct).slice(0, 8)

  return (
    <div className="hero">
      <h1>Welcome to CareTools</h1>
      <img className="hero__logo" src="/Icone_CareTools.png" alt="CareTools logo" />
      <p className="hero__lead">
        Orthopedic Solutions, Made Simple. Product catalogue, sizing guides and practical demonstrations.
      </p>
      <button className="btn btn--primary" onClick={() => onNavigate('products')}>Browse Products</button>

      <h2 className="center" style={{ marginTop: 56 }}>Featured Products</h2>
      <div className="grid">
        {featured.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={onOpenProduct} onAdd={onAdd} />
        ))}
      </div>
    </div>
  )
}
