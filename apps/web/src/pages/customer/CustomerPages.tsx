import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, MapPin, PackageCheck, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { createPayment, type PaymentMethod } from '../../features/orders/api'
import { createAddress, deleteAddress, getAddresses, getCustomerOrder, getCustomerOrders, updateAddress, type CustomerAddress, type CustomerOrder, type CustomerOrderDetail } from '../../features/customer/api'
import { getRequestError } from '../../features/products/api'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export function CustomerBoundary() {
  const { user, loading } = useAuth()
  if (loading) return <section className="message-page" role="status"><p className="eyebrow">AKUN</p><h1>Memeriksa sesi...</h1></section>
  if (!user) return <Navigate replace to="/login" />
  return <Outlet />
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="customer-page">
      <div className="catalog-heading"><p className="eyebrow">AKUNMU</p><h1>Profil</h1><p>Informasi akun dan aktivitas belanjamu.</p></div>
      {user?.role === 'ADMIN' && (
        <div style={{ margin: '0 0 20px', padding: '16px 20px', background: 'rgba(198, 65, 45, 0.08)', borderRadius: '12px', border: '1px solid rgba(198, 65, 45, 0.25)' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--tomato)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
            <ShieldCheck size={18} /> Akses Administrator Aktif
          </p>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--ink)' }}>
            Akun ini memiliki hak akses untuk mengelola produk (CRUD), kategori, varian harga, pesanan, dan laporan toko.
          </p>
          <Link
            className="button-primary"
            to="/admin/dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px', textDecoration: 'none' }}
          >
            Buka Dashboard & CRUD Admin <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="profile-details">
        <p><span>Nama</span><strong>{user?.name}</strong></p>
        <p><span>Email</span><strong>{user?.email}</strong></p>
        <p><span>Peran Akun</span><strong style={{ color: user?.role === 'ADMIN' ? 'var(--tomato)' : 'inherit' }}>{user?.role === 'ADMIN' ? 'ADMINISTRATOR' : 'Pelanggan'}</strong></p>
        <p><span>Telepon</span><strong>{user?.phone || 'Belum ditambahkan'}</strong></p>
      </div>
      <div className="profile-links"><Link to="/profile/addresses"><MapPin size={17} /> Kelola alamat <ArrowRight size={15} /></Link><Link to="/orders"><PackageCheck size={17} /> Riwayat pesanan <ArrowRight size={15} /></Link></div>
      <button className="text-button" onClick={() => { void signOut().then(() => navigate('/')) }} type="button">Keluar dari akun</button>
    </section>
  )
}

export function AddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [label, setLabel] = useState('Rumah')
  const [recipientName, setRecipientName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [village, setVillage] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getAddresses(controller.signal).then(setAddresses)
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(getRequestError(requestError)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAddress({ label, recipientName, phone, province, city, district, village: village || undefined, postalCode, address, isDefault })
      setAddress('')
      setReload((value) => value + 1)
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setSaving(false)
    }
  }

  const setDefault = async (id: string) => {
    try {
      await updateAddress(id, { isDefault: true })
      setReload((value) => value + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
  }

  const remove = async (id: string) => {
    try {
      await deleteAddress(id)
      setReload((value) => value + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
  }

  return (
    <section className="customer-page">
      <div className="catalog-heading"><p className="eyebrow">PENGIRIMAN</p><h1>Alamat</h1><p>Alamat yang tersimpan untuk pesananmu.</p></div>
      {error && <p className="cart-feedback cart-feedback-error" role="alert">{error}</p>}
      {loading ? <p className="shelf-state" role="status">Memuat alamat...</p> : <div className="address-list">{addresses.map((item) => (
        <article className="address-row" key={item.id}>
          <div><p className="address-label">{item.label} {item.isDefault && <span>UTAMA</span>}</p><strong>{item.recipientName} · {item.phone}</strong><p>{item.address}, {item.village ? `${item.village}, ` : ''}{item.district}, {item.city}, {item.province} {item.postalCode}</p></div>
          <div className="address-actions">{!item.isDefault && <button onClick={() => void setDefault(item.id)} type="button">Jadikan utama</button>}<button aria-label={`Hapus alamat ${item.label}`} onClick={() => void remove(item.id)} type="button"><Trash2 size={15} /></button></div>
        </article>
      ))}{addresses.length === 0 && <p className="shelf-state">Belum ada alamat tersimpan.</p>}</div>}
      <form className="address-form" onSubmit={save}>
        <h2>Tambah alamat</h2>
        <div className="checkout-field-grid">
          <label>Label<input maxLength={60} onChange={(event) => setLabel(event.target.value)} required value={label} /></label>
          <label>Nama penerima<input maxLength={120} minLength={2} onChange={(event) => setRecipientName(event.target.value)} required value={recipientName} /></label>
          <label>Telepon<input maxLength={30} minLength={8} onChange={(event) => setPhone(event.target.value)} required value={phone} /></label>
          <label>Provinsi<input maxLength={100} onChange={(event) => setProvince(event.target.value)} required value={province} /></label>
          <label>Kota atau kabupaten<input maxLength={100} onChange={(event) => setCity(event.target.value)} required value={city} /></label>
          <label>Kecamatan<input maxLength={100} onChange={(event) => setDistrict(event.target.value)} required value={district} /></label>
          <label>Kelurahan<input maxLength={100} onChange={(event) => setVillage(event.target.value)} value={village} /></label>
          <label>Kode pos<input maxLength={20} minLength={3} onChange={(event) => setPostalCode(event.target.value)} required value={postalCode} /></label>
          <label className="checkout-wide">Alamat lengkap<textarea maxLength={2000} minLength={8} onChange={(event) => setAddress(event.target.value)} required rows={3} value={address} /></label>
        </div>
        <label className="default-address-toggle"><input checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} type="checkbox" /> Jadikan alamat utama</label>
        <button className="button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Simpan alamat'} <ArrowRight size={15} /></button>
      </form>
    </section>
  )
}

export function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    getCustomerOrders(page, 20, controller.signal)
      .then((response) => { setOrders(response.data); setTotal(response.meta?.total ?? 0) })
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(getRequestError(requestError)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page])

  return (
    <section className="customer-page">
      <div className="catalog-heading"><p className="eyebrow">PESANANMU</p><h1>Riwayat pesanan</h1><p>Lihat status pembayaran dan pengiriman.</p></div>
      {loading ? <p className="shelf-state" role="status">Memuat pesanan...</p> : error ? <p className="cart-feedback cart-feedback-error" role="alert">{error}</p> : orders.length === 0 ? <div className="shelf-state"><p>Belum ada pesanan.</p><Link className="text-link" to="/products">Cari camilan <ArrowRight size={15} /></Link></div> : (
        <div className="customer-order-list">{orders.map((order) => <Link className="customer-order-row" key={order.orderNumber} to={`/orders/${encodeURIComponent(order.orderNumber)}`}>
          <span><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString('id-ID')} · {order.items.length} jenis produk</small></span>
          <span className="order-status-cell">{order.status}<small>Pembayaran: {order.paymentStatus}</small></span>
          <strong>{rupiah.format(order.total)}</strong><ArrowRight size={16} />
        </Link>)}</div>
      )}
      {total > 20 && <div className="pagination"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} type="button">Sebelumnya</button><span>Halaman {page} dari {Math.ceil(total / 20)}</span><button disabled={page >= Math.ceil(total / 20) || loading} onClick={() => setPage((value) => value + 1)} type="button">Berikutnya</button></div>}
    </section>
  )
}

export function OrderDetailPage() {
  const { orderNumber = '' } = useParams()
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    getCustomerOrder(orderNumber, controller.signal).then(setOrder)
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(getRequestError(requestError)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [orderNumber, reload])

  const pay = async () => {
    if (!order) return
    setPaying(true)
    setError(null)
    try {
      const payment = await createPayment(order.orderNumber, paymentMethod, globalThis.crypto.randomUUID())
      setPaymentUrl(payment.checkoutUrl)
    } catch (requestError) { setError(getRequestError(requestError)) }
    finally { setPaying(false) }
  }

  if (loading) return <section className="message-page" role="status"><p className="eyebrow">PESANAN</p><h1>Memuat detail...</h1></section>
  if (!order) return <section className="message-page" role="alert"><p className="eyebrow">PESANAN</p><h1>{error ?? 'Pesanan tidak ditemukan.'}</h1><Link className="text-link" to="/orders">Kembali ke riwayat <ArrowRight size={15} /></Link></section>

  return (
    <section className="customer-page">
      <div className="catalog-heading"><p className="eyebrow">DETAIL PESANAN</p><h1>{order.orderNumber}</h1><p>Status: {order.status} · Pembayaran: {order.paymentStatus} · Pengiriman: {order.shippingStatus}</p></div>
      {error && <p className="cart-feedback cart-feedback-error" role="alert">{error}</p>}
      <div className="customer-order-detail-grid">
        <section className="customer-order-section"><h2>Produk</h2>{order.items.map((item) => <div className="customer-order-item" key={item.sku}><span><strong>{item.productName}</strong><small>{item.flavorName} · {item.sizeName} · SKU {item.sku} · {item.quantity} × {rupiah.format(item.price)}{item.promotionDiscount > 0 ? ` · ${item.promotionName ?? 'Promosi'}` : ''}</small></span><strong>{rupiah.format(item.subtotal)}</strong></div>)}</section>
        <aside className="customer-order-section"><h2>Pengiriman</h2><p>{String(order.shippingAddressSnapshot.recipientName ?? '')}</p><p>{String(order.shippingAddressSnapshot.address ?? '')}</p><p>{String(order.shippingAddressSnapshot.city ?? '')}, {String(order.shippingAddressSnapshot.province ?? '')} {String(order.shippingAddressSnapshot.postalCode ?? '')}</p>{order.shipments.map((shipment, index) => <div className="tracking-row" key={`${shipment.courier}-${index}`}><strong>{shipment.courier} · {shipment.service}</strong><span>{shipment.trackingNumber ? `Resi ${shipment.trackingNumber}` : 'Nomor resi belum tersedia'}</span><small>{shipment.status}</small>{shipment.events.map((event, eventIndex) => <small key={`${event.status}-${eventIndex}`}>{new Date(event.occurredAt).toLocaleString('id-ID')} · {event.description ?? event.status}</small>)}</div>)}</aside>
      </div>
      <div className="customer-total"><span>Subtotal {rupiah.format(order.subtotal)} · Pengiriman {rupiah.format(order.shippingCost)}</span><strong>Total {rupiah.format(order.total)}</strong></div>
      {order.status === 'PENDING_PAYMENT' && order.paymentStatus !== 'EXPIRED' && <div className="payment-panel"><label>Metode pembayaran<select onChange={(event) => { setPaymentMethod(event.target.value as PaymentMethod); setPaymentUrl(null) }} value={paymentMethod}><option value="BANK_TRANSFER">Transfer bank</option><option value="GOPAY">GoPay</option><option value="QRIS">QRIS</option><option value="CREDIT_CARD">Kartu kredit</option></select></label>{paymentUrl ? <a className="button-primary payment-link" href={paymentUrl} rel="noreferrer" target="_blank">Lanjut ke pembayaran <ArrowRight size={16} /></a> : <button className="button-primary payment-link" disabled={paying} onClick={() => void pay()} type="button">{paying ? 'Menyiapkan...' : 'Bayar sekarang'} <ArrowRight size={16} /></button>}</div>}
      <button className="text-button" onClick={() => setReload((value) => value + 1)} type="button"><RefreshCw size={15} /> Perbarui status</button>
    </section>
  )
}