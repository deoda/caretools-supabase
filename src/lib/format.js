export const formatPrice = (price) =>
  price == null || price === '' ? '—' : `${Number(price).toLocaleString('en-RW')} FRW`

export const formatStock = (stock) => (stock == null || stock === '' ? '—' : stock)

export const isVisibleProduct = (product) => product.status !== 'inactive'
