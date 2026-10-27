import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

// isAdmin : à sa connexion, un admin doit recharger la liste pour voir aussi les produits désactivés (RLS).
export function useProducts(isAdmin = false) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // fetchProducts ne modifie aucun état : l'effet ci-dessous range le résultat dans son .then().
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      return null
    }
    return (data || []).map((p) => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? 0,
      category: p.category || '',
      subcategory: p.subcategory || '',
      images: p.image ? [p.image] : [],
      video: p.video || '',
      stock: p.stock ?? 0,
      badge: p.badge || '',
      productCode: p.product_code || '',
      size: p.size || '',
      status: p.status || 'active',
      createdAt: p.created_at || '',
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchProducts().then((rows) => {
      if (cancelled) return
      if (rows) setProducts(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [fetchProducts, isAdmin])

  // Rechargement manuel (après une commande, une annulation, une modification).
  const loadProducts = async () => {
    const rows = await fetchProducts()
    if (rows) setProducts(rows)
  }

  const saveProduct = async (product, imageFile) => {
    let imageUrl = product.image || ''

    if (imageFile) {
      if (!imageFile.type.startsWith('image/')) throw new Error('Le fichier doit être une image.')
      if (imageFile.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum).')
      // Nom de fichier assaini : pas d'espaces, d'accents ni de caractères spéciaux dans l'URL.
      const safeName = imageFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-')
      const path = `products/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('products').upload(path, imageFile)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('products').getPublicUrl(path)
      imageUrl = data.publicUrl
    }

    const payload = {
      name: product.name,
      price: Number(product.price) || 0,
      category: product.category,
      subcategory: product.subcategory,
      description: product.description,
      image: imageUrl,
      stock: Number(product.stock) || 0,
      badge: product.badge,
      video: product.video,
      product_code: product.productCode,
      size: product.size,
      status: product.status || 'active',
    }

    if (product.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', product.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error
    }

    await loadProducts()
  }

  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
    await loadProducts()
  }

  return { products, loading, loadProducts, saveProduct, deleteProduct }
}
