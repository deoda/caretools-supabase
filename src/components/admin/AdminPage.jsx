import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { formatPrice } from '../../lib/format'
import UsersPanel from './UsersPanel'
import ProductsPanel from './ProductsPanel'

export default function AdminPage({ products, orders, isSuperAdmin, saveProduct, deleteProduct, loadProducts }) {
  const [users, setUsers] = useState([])

  // fetchUsers ne modifie aucun état : l'effet ci-dessous range le résultat dans son .then().
  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) console.error('Impossible de charger les utilisateurs :', error.message)
    return data || []
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchUsers().then((rows) => {
      if (!cancelled) setUsers(rows)
    })
    return () => { cancelled = true }
  }, [fetchUsers])

  const refreshUsers = async () => setUsers(await fetchUsers())

  const revenue = orders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0)

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>

      <div className="stats">
        <div className="stat"><strong>{products.length}</strong><span>Products</span></div>
        <div className="stat"><strong>{orders.length}</strong><span>Orders</span></div>
        <div className="stat"><strong>{users.length}</strong><span>Users</span></div>
        <div className="stat"><strong>{formatPrice(revenue)}</strong><span>Revenue</span></div>
      </div>

      <UsersPanel users={users} isSuperAdmin={isSuperAdmin} onChanged={refreshUsers} />
      <ProductsPanel
        products={products}
        saveProduct={saveProduct}
        deleteProduct={deleteProduct}
        loadProducts={loadProducts}
      />
    </div>
  )
}
