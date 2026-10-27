import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

export const ORDER_STATUSES = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

// Client : ses propres commandes. Admin : toutes les commandes
// (la RLS côté serveur applique la même règle, le filtre ci-dessous évite seulement un travail inutile).
export function useOrders(userId, isAdmin = false) {
  // Les commandes sont rangées avec l'identifiant de leur propriétaire :
  // après un changement d'utilisateur, les anciennes lignes ne sont jamais montrées.
  const [store, setStore] = useState({ userId: null, rows: [] })

  const fetchOrders = useCallback(async () => {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Impossible de charger les commandes :', error.message)
      return null
    }
    return data || []
  }, [userId, isAdmin])

  // Chargement automatique quand l'utilisateur (ou son rôle) change.
  useEffect(() => {
    if (!userId) return undefined

    let cancelled = false
    fetchOrders().then((rows) => {
      if (!cancelled && rows) setStore({ userId, rows })
    })

    return () => { cancelled = true }
  }, [userId, fetchOrders])

  // Rechargement manuel (après une commande ou un changement de statut).
  const loadOrders = async () => {
    if (!userId) return
    const rows = await fetchOrders()
    if (rows) setStore({ userId, rows })
  }

  // La commande est créée côté serveur (fonction SQL place_order) :
  // le numéro, les prix, le total et le stock sont calculés en base, jamais
  // depuis le navigateur. On n'envoie que les identifiants et quantités.
  const placeOrder = async ({ items, customer = {} }) => {
    const { data: order, error } = await supabase.rpc('place_order', {
      p_items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
      p_customer: customer,
    })

    if (error) throw error

    await loadOrders()
    return order
  }

  // Réservé aux administrateurs (RLS). L'annulation remet le stock en rayon (migration 002).
  const updateOrderStatus = async (orderId, status) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (error) throw error
    await loadOrders()
  }

  const orders = userId && store.userId === userId ? store.rows : []

  return { orders, loadOrders, placeOrder, updateOrderStatus }
}
