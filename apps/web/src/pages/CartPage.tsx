import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCart, removeCartItem, updateCartItem, type CartData } from '../features/cart/api'
import { getRequestError } from '../features/products/api'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getCart(controller.signal)
      .then(setCart)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getRequestError(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const changeQuantity = async (itemId: string, quantity: number) => {
    setBusyItemId(itemId)
    setError(null)
    try {
      setCart(await updateCartItem(itemId, quantity))
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setBusyItemId(null)
    }
  }

  const removeItem = async (itemId: string) => {
    setBusyItemId(itemId)
    setError(null)
    try {
      setCart(await removeCartItem(itemId))
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setBusyItemId(null)
    }
  }

  if (loading) return <section className="message-page" role="status"><p className="eyebrow">KERANJANG</p><h1>Memuat keranjang...</h1></section>
  if (error && !cart) return <section className="message-page" role="alert"><p className="eyebrow">KERANJANG</p><h1>{error}</h1><Link className="text-link" to="/products">Kembali ke katalog <ArrowRight size={16} /></Link></section>
  if (!cart || cart.items.length === 0) {
    return <section className="message-page"><p className="eyebrow">KERANJANG</p><h1>Keranjangmu masih kosong.</h1><Link className="button-primary" to="/products">Cari camilan <ArrowRight size={16} /></Link></section>
  }

  return (
    <section className="cart-page">
      <div className="catalog-heading"><p className="eyebrow">PILIHANMU</p><h1>Keranjang</h1><p>{cart.itemCount} produk di keranjangmu.</p></div>
      {error && <p className="cart-feedback cart-feedback-error" role="alert">{error}</p>}
      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <article className={`cart-line${!item.isQuantityValid ? ' cart-line-warning' : ''}`} key={item.id}>
              <Link className="cart-line-image" to={`/products/${encodeURIComponent(item.product.slug)}`}>
                {item.product.image ? <img src={item.product.image} alt={item.product.name} /> : <span>{item.product.name.slice(0, 1)}</span>}
              </Link>
              <div className="cart-line-info">
                <p className="product-category">{item.sku}</p>
                <Link className="cart-product-name" to={`/products/${encodeURIComponent(item.product.slug)}`}>{item.product.name}</Link>
                <p className="cart-variant">{item.flavor.name} · {item.size.name}</p>
                {item.promotionDiscount > 0 && <p className="cart-promotion-price"><del>{rupiah.format(item.listPrice)}</del> {item.promotionName}</p>}
                {!item.isQuantityValid && <p className="cart-line-alert">Stok tersedia {item.availableStock}. Sesuaikan jumlah.</p>}
              </div>
              <div className="cart-line-actions">
                <div className="quantity-control">
                  <button aria-label={`Kurangi ${item.product.name}`} disabled={busyItemId === item.id || item.quantity <= 1} onClick={() => changeQuantity(item.id, item.quantity - 1)} type="button"><Minus size={14} /></button>
                  <span aria-label={`Jumlah ${item.quantity}`}>{item.quantity}</span>
                  <button aria-label={`Tambah ${item.product.name}`} disabled={busyItemId === item.id || item.quantity >= item.availableStock} onClick={() => changeQuantity(item.id, item.quantity + 1)} type="button"><Plus size={14} /></button>
                </div>
                <span className="cart-line-total">{rupiah.format(item.subtotal)}</span>
                <button className="icon-button" aria-label={`Hapus ${item.product.name}`} disabled={busyItemId === item.id} onClick={() => removeItem(item.id)} type="button"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
        <aside className="cart-summary" aria-label="Ringkasan keranjang">
          <h2>Ringkasan</h2>
          <div className="summary-row"><span>Subtotal</span><strong>{rupiah.format(cart.subtotal)}</strong></div>
          <div className="summary-row summary-muted"><span>Pengiriman</span><span>Dihitung saat checkout</span></div>
          <p className="summary-note">Harga diperbarui dari katalog saat keranjang dimuat. Stok akan diperiksa kembali saat checkout.</p>
          <Link className="button-primary checkout-button" to="/checkout">Lanjut checkout <ArrowRight size={16} /></Link>
          <Link className="continue-shopping" to="/products">Lanjut belanja</Link>
        </aside>
      </div>
    </section>
  )
}