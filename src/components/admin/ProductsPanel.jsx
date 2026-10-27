import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { formatPrice } from '../../lib/format'

const EMPTY_PRODUCT = {
  name: '', price: '', stock: '', category: '', subcategory: '', productCode: '', size: '',
  badge: '', video: '', description: '', status: 'active',
}

export default function ProductsPanel({ products, saveProduct, deleteProduct, loadProducts }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [imageFile, setImageFile] = useState(null)
  const [fileKey, setFileKey] = useState(0) // remet à zéro le champ fichier
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const reset = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT)
    setImageFile(null)
    setFileKey((k) => k + 1)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveProduct({ ...form, id: editing?.id }, imageFile)
      reset()
      alert('Product saved')
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name || '', price: p.price ?? '', stock: p.stock ?? '', category: p.category || '',
      subcategory: p.subcategory || '', productCode: p.productCode || '', size: p.size || '',
      badge: p.badge || '', video: p.video || '', description: p.description || '',
      status: p.status || 'active',
      image: p.images?.[0] || '', // conservée si aucune nouvelle image n'est choisie
    })
    setImageFile(null)
    setFileKey((k) => k + 1)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const toggleStatus = async (p) => {
    const next = p.status === 'inactive' ? 'active' : 'inactive'
    const { error } = await supabase.from('products').update({ status: next }).eq('id', p.id)
    if (error) alert(error.message)
    await loadProducts()
  }

  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}" ?`)) return
    try {
      await deleteProduct(p.id)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <>
      <div className="section">
        <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
        <form onSubmit={submit}>
          <input className="input" aria-label="Name" placeholder="Name" value={form.name} onChange={set('name')} required />
          <input className="input" aria-label="Price" placeholder="Price (FRW)" type="number" min="0" value={form.price} onChange={set('price')} />
          <input className="input" aria-label="Stock" placeholder="Stock" type="number" min="0" value={form.stock} onChange={set('stock')} />
          <input className="input" aria-label="Category" placeholder="Category" value={form.category} onChange={set('category')} />
          <input className="input" aria-label="Subcategory" placeholder="Subcategory" value={form.subcategory} onChange={set('subcategory')} />
          <input className="input" aria-label="Product code" placeholder="Product code" value={form.productCode} onChange={set('productCode')} />
          <input className="input" aria-label="Sizes" placeholder="Size(s) (ex : S, M, L)" value={form.size} onChange={set('size')} />
          <input className="input" aria-label="Badge" placeholder="Badge (ex : New, Best seller)" value={form.badge} onChange={set('badge')} />
          <input className="input" aria-label="Video URL" placeholder="Video URL (https://...)" type="url" value={form.video} onChange={set('video')} />
          <select className="input" aria-label="Status" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (hidden from customers)</option>
          </select>
          <textarea className="input" style={{ minHeight: 90 }} aria-label="Description" placeholder="Description"
            value={form.description} onChange={set('description')} />
          <label style={{ display: 'block', marginBottom: 12 }}>
            Image{' '}
            <input key={fileKey} type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </label>
          <div className="row">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update Product' : 'Create Product'}
            </button>
            {editing && <button type="button" className="btn btn--back" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>

      <h2>Products</h2>
      <div className="grid">
        {products.map((p) => (
          <article key={p.id} className="card">
            {p.images?.[0] && <img className="card__img" src={p.images[0]} alt={p.name} loading="lazy" />}
            <strong>{p.name}</strong>
            <p>{formatPrice(p.price)} · Stock: {p.stock} · <em>{p.status || 'active'}</em></p>
            <div className="row">
              <button className="btn btn--small" onClick={() => startEdit(p)}>Edit</button>
              <button className="btn btn--small" onClick={() => toggleStatus(p)}>
                {p.status === 'inactive' ? 'Activate' : 'Deactivate'}
              </button>
              <button className="btn btn--small btn--danger" onClick={() => remove(p)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
