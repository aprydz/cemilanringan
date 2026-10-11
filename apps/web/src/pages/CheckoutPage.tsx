import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { getCart, type CartData } from '../features/cart/api'
import { createOrder, getShippingQuote, validateCoupon, type CouponValidation, type ShippingQuote } from '../features/orders/api'
import { getRequestError } from '../features/products/api'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cart, setCart] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponValidation | null>(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  const [customerName, setCustomerName] = useState(user?.name ?? '')
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '')
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? '')
  const [recipientName, setRecipientName] = useState(user?.name ?? '')
  const [addressPhone, setAddressPhone] = useState(user?.phone ?? '')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [village, setVillage] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getCart(controller.signal)
      .then((value) => setCart(value))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getRequestError(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!user) return
    setCustomerName(user.name)
    setCustomerEmail(user.email)
    setCustomerPhone(user.phone ?? '')
    setRecipientName((current) => current || user.name)
    setAddressPhone((current) => current || user.phone || '')
  }, [user])

  const requestQuote = async () => {
    setQuoting(true)
    setError(null)
    try {
      setQuote(await getShippingQuote(postalCode))
    } catch (requestError) {
      setQuote(null)
      setError(getRequestError(requestError))
    } finally {
      setQuoting(false)
    }
  }

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!quote) {
      setError('Periksa biaya pengiriman terlebih dahulu.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const createdOrder = await createOrder({
        customerName,
        customerEmail,
        customerPhone,
        address: { recipientName, phone: addressPhone, province, city, district, village: village || undefined, postalCode, address },
        notes: notes || undefined,
        couponCode: coupon?.code,
      })
      navigate(`/orders/${encodeURIComponent(createdOrder.orderNumber)}`, { replace: true })
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  const applyCoupon = async () => {
    setValidatingCoupon(true)
    setError(null)
    try {
      setCoupon(await validateCoupon(couponCode))
    } catch (requestError) {
      setCoupon(null)
      setError(getRequestError(requestError))
    } finally {
      setValidatingCoupon(false)
    }
  }

  if (loading) return <section className="message-page" role="status"><p className="eyebrow">CHECKOUT</p><h1>Memuat pesanan...</h1></section>
  if (error && !cart) return <section className="message-page" role="alert"><p className="eyebrow">CHECKOUT</p><h1>{error}</h1><Link className="text-link" to="/cart"><ArrowLeft size={15} /> Kembali ke keranjang</Link></section>
  if (!cart || cart.items.length === 0) return <section className="message-page"><p className="eyebrow">CHECKOUT</p><h1>Keranjangmu masih kosong.</h1><Link className="button-primary" to="/products">Cari camilan <ArrowRight size={16} /></Link></section>

  const itemsAvailable = cart.items.every((item) => item.isQuantityValid)

  return (
    <section className="checkout-page">
      <div className="catalog-heading"><p className="eyebrow">LANGKAH TERAKHIR</p><h1>Checkout</h1><p>Isi alamat tujuan dan periksa ringkasan pesanan.</p></div>
      {error && <p className="cart-feedback cart-feedback-error" role="alert">{error}</p>}
      <form className="checkout-layout" onSubmit={submitOrder}>
        <div className="checkout-fields">
          <section className="checkout-section">
            <h2>Informasi penerima</h2>
            <div className="checkout-field-grid">
              <label>Nama lengkap<input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setCustomerName(event.target.value)} required value={customerName} /></label>
              <label>Email<input autoComplete="email" onChange={(event) => setCustomerEmail(event.target.value)} required type="email" value={customerEmail} /></label>
              <label>Nomor telepon<input autoComplete="tel" maxLength={30} minLength={8} onChange={(event) => setCustomerPhone(event.target.value)} required type="tel" value={customerPhone} /></label>
            </div>
          </section>
          <section className="checkout-section">
            <h2><MapPin size={17} /> Alamat pengiriman</h2>
            <div className="checkout-field-grid">
              <label>Nama penerima<input autoComplete="shipping name" maxLength={120} minLength={2} onChange={(event) => setRecipientName(event.target.value)} required value={recipientName} /></label>
              <label>Telepon penerima<input autoComplete="shipping tel" maxLength={30} minLength={8} onChange={(event) => setAddressPhone(event.target.value)} required type="tel" value={addressPhone} /></label>
              <label>Provinsi<input autoComplete="shipping address-level1" maxLength={100} onChange={(event) => setProvince(event.target.value)} required value={province} /></label>
              <label>Kota atau kabupaten<input autoComplete="shipping address-level2" maxLength={100} onChange={(event) => setCity(event.target.value)} required value={city} /></label>
              <label>Kecamatan<input maxLength={100} onChange={(event) => setDistrict(event.target.value)} required value={district} /></label>
              <label>Kelurahan <span className="optional-label">Opsional</span><input maxLength={100} onChange={(event) => setVillage(event.target.value)} value={village} /></label>
              <label>Kode pos<input autoComplete="shipping postal-code" maxLength={20} minLength={3} onChange={(event) => { setPostalCode(event.target.value); setQuote(null) }} required value={postalCode} /></label>
              <label className="checkout-wide">Alamat lengkap<textarea autoComplete="shipping street-address" maxLength={2000} minLength={8} onChange={(event) => setAddress(event.target.value)} required rows={3} value={address} /></label>
              <label className="checkout-wide">Catatan pesanan <span className="optional-label">Opsional</span><textarea maxLength={1000} onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} /></label>
            </div>
          </section>
        </div>
        <aside className="checkout-summary">
          <h2>Ringkasan pesanan</h2>
          <div className="checkout-item-list">
            {cart.items.map((item) => <div className="checkout-item" key={item.id}><span>{item.quantity} × {item.product.name}<small>{item.flavor.name} · {item.size.name}{item.promotionName ? ` · ${item.promotionName}` : ''}</small></span><strong>{rupiah.format(item.subtotal)}</strong></div>)}
          </div>
          <div className="summary-row"><span>Subtotal</span><strong>{rupiah.format(cart.subtotal)}</strong></div>
          <div className="coupon-entry"><label htmlFor="checkout-coupon">Kode kupon</label><div><input id="checkout-coupon" autoComplete="off" disabled={Boolean(coupon)} maxLength={80} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null) }} placeholder="Masukkan kode" value={coupon?.code ?? couponCode} /><button disabled={validatingCoupon || !couponCode.trim() || Boolean(coupon)} onClick={() => void applyCoupon()} type="button">{validatingCoupon ? 'Memeriksa...' : coupon ? 'Diterapkan' : 'Terapkan'}</button></div></div>
          {coupon && <div className="summary-row coupon-discount"><span>Kupon {coupon.code}</span><strong>-{rupiah.format(coupon.discount)}</strong></div>}
          <button className="quote-button" disabled={quoting || postalCode.length < 3} onClick={() => void requestQuote()} type="button">{quoting ? 'Menghitung...' : quote ? 'Hitung ulang pengiriman' : 'Hitung pengiriman'}</button>
          {quote && <div className="summary-row"><span>{quote.courier} · {quote.service}<small>Estimasi {quote.estimatedDays.minimum}-{quote.estimatedDays.maximum} hari</small></span><strong>{rupiah.format(quote.cost)}</strong></div>}
          <div className="summary-row summary-total"><span>Total</span><strong>{rupiah.format(cart.subtotal - (coupon?.discount ?? 0) + (quote?.cost ?? 0))}</strong></div>
          <p className="summary-note">Total dihitung kembali di server. Stok akan dikunci sementara saat pesanan dibuat.</p>
          <button className="button-primary checkout-button" disabled={!itemsAvailable || !quote || submitting} type="submit">{submitting ? 'Membuat pesanan...' : 'Buat pesanan'} <ArrowRight size={16} /></button>
          {!itemsAvailable && <p className="cart-feedback cart-feedback-error">Perbaiki jumlah produk yang melebihi stok sebelum checkout.</p>}
        </aside>
      </form>
    </section>
  )
}