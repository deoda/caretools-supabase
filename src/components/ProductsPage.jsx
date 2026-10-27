import { useMemo, useState } from 'react'
import ProductCard from './ProductCard'
import { isVisibleProduct } from '../lib/format'

export default function ProductsPage({ products, onOpenProduct, onAdd }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const visible = useMemo(() => products.filter(isVisibleProduct), [products])
  const categories = useMemo(
    () => ['All', ...new Set(visible.map((p) => p.category).filter(Boolean))],
    [visible],
  )
  const filtered = useMemo(
    () =>
      visible.filter((p) => {
        const matchesSearch = !search || (p.name || '').toLowerCase().includes(search.toLowerCase())
        const matchesCategory = category === 'All' || p.category === category
        return matchesSearch && matchesCategory
      }),
    [visible, search, category],
  )

  return (
    <div className="page">
      <h1>All Products</h1>

      <div className="filters">
        <input
          className="input"
          type="search"
          aria-label="Search products"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <p className="muted">No products found.</p>}

      <div className="grid">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} showStock onOpen={onOpenProduct} onAdd={onAdd} />
        ))}
      </div>
    </div>
  )
}
