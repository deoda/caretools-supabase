import { jsPDF } from 'jspdf'

const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') return '—'
  return `${Number(price).toLocaleString('en-RW')} FRW`
}

export const buildOrderPdf = (order, shippingDocument = false) => {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = 20

  // Header
  pdf.setFillColor(26, 26, 46)
  pdf.rect(0, 0, pageWidth, 40, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CARETOOLS', 20, 25)
  pdf.setFontSize(10)
  pdf.text(shippingDocument ? 'SHIPPING DOCUMENT' : 'ORDER CONFIRMATION', pageWidth - 20, 25, { align: 'right' })

  pdf.setTextColor(0, 0, 0)
  y = 55

  const addLine = (text, x = 20, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.text(String(text ?? ''), x, y)
    y += 7
  }

  addLine(`Order: ${order?.id || '—'}`, 20, 12, true)
  addLine(`Date: ${new Date(order?.created_at || Date.now()).toLocaleString()}`)
  y += 5

  addLine('CUSTOMER', 20, 11, true)
  addLine(`Name: ${order?.customer?.name || '—'}`)
  addLine(`Email: ${order?.customer?.email || '—'}`)
  addLine(`Phone: ${order?.customer?.phone || '—'}`)
  pdf.splitTextToSize(`Address: ${order?.customer?.address || '—'}`, pageWidth - 40).forEach((line) => addLine(line))
  y += 5

  addLine('ITEMS', 20, 11, true)
  const items = Array.isArray(order?.items) ? order.items : []
  items.forEach((item) => {
    const qty = item.quantity || 0
    const price = Number(item.price || 0)
    addLine(`${item.name || 'Product'}  × ${qty}  =  ${formatPrice(price * qty)}`)
  })

  y += 5
  addLine(`Subtotal: ${formatPrice(order?.subtotal)}`)
  addLine(`Shipping: ${formatPrice(order?.shipping)}`)
  addLine(`TOTAL: ${formatPrice(order?.total)}`, 20, 14, true)

  pdf.setFontSize(8)
  pdf.setTextColor(120)
  pdf.text('CareTools — Orthopedic & Prosthetic Materials', pageWidth / 2, 285, { align: 'center' })

  return pdf
}

export const downloadOrderPdf = (order, shippingDocument = false) => {
  if (!order) return
  const pdf = buildOrderPdf(order, shippingDocument)
  pdf.save(`${shippingDocument ? 'shipping' : 'order'}-${order.id}.pdf`)
}
