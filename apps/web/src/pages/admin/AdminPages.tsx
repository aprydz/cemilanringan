import { useEffect, useState, type FormEvent } from 'react'
import { Activity, ArrowRight, Box, ClipboardList, LogOut, Package, RefreshCw, Shapes, TicketPercent, Trash2, Users } from 'lucide-react'
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { adjustInventory, createAdminCoupon, createAdminProduct, createAdminPromotion, createAdminTaxonomy, getAdminCoupons, getAdminCustomers, getAdminOrder, getAdminOrders, getAdminProducts, getAdminPromotions, getAdminTaxonomy, getDashboard, getSalesReport, updateOrderShipping, updateOrderStatus, type AdminCustomer, type AdminDashboardData, type AdminOrder, type AdminOrderDetail, type AdminProduct, type AdminPromotion, type AdminTaxonomy, type SalesReportRow } from '../../features/admin/api'
import { getRequestError } from '../../features/products/api'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const orderStatuses = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']

function AdminBoundary() {
  const { user, loading } = useAuth()
  if (loading) return <main className="admin-message" role="status">Memeriksa sesi admin...</main>
  if (!user) return <Navigate replace to="/admin/login" />
  if (user.role !== 'ADMIN') return <main className="admin-message" role="alert">Akun ini tidak memiliki akses admin.</main>
  return <AdminLayout />
}

function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="admin-brand" to="/admin/dashboard"><span className="wordmark-stamp">ps</span><span>piscok<span className="wordmark-light">shop</span><small>ADMIN</small></span></Link>
        <span className="admin-user">{user?.name}</span>
        <button className="admin-signout" onClick={() => void handleSignOut()} type="button"><LogOut size={16} /> Keluar</button>
      </header>
      <div className="admin-body">
        <nav className="admin-nav" aria-label="Navigasi admin">
          <NavLink to="/admin/dashboard"><Activity size={16} /> Ringkasan</NavLink>
          <NavLink to="/admin/products"><Package size={16} /> Produk</NavLink>
          <NavLink to="/admin/orders"><ClipboardList size={16} /> Pesanan</NavLink>
          <NavLink to="/admin/inventory"><Box size={16} /> Inventori</NavLink>
          <NavLink to="/admin/categories"><Shapes size={16} /> Kategori</NavLink>
          <NavLink to="/admin/flavors"><Shapes size={16} /> Rasa</NavLink>
          <NavLink to="/admin/sizes"><Shapes size={16} /> Ukuran</NavLink>
          <NavLink to="/admin/coupons"><TicketPercent size={16} /> Kupon</NavLink>
          <NavLink to="/admin/promotions"><TicketPercent size={16} /> Promosi</NavLink>
          <NavLink to="/admin/customers"><Users size={16} /> Pelanggan</NavLink>
          <NavLink to="/admin/reports"><Activity size={16} /> Laporan</NavLink>
        </nav>
        <main className="admin-main"><Outlet /></main>
      </div>
    </div>
  )
}

function AdminPageState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (loading) return <p className="admin-state" role="status">Memuat data...</p>
  if (error) return <div className="admin-state" role="alert"><p>{error}</p><button onClick={retry} type="button"><RefreshCw size={14} /> Coba lagi</button></div>
  return null
}

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getDashboard().then((value) => { if (active) setData(value) })
      .catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">TOKO HARI INI</p><h1>Ringkasan</h1></div><button className="admin-refresh" onClick={() => setReload((value) => value + 1)} type="button" aria-label="Muat ulang"><RefreshCw size={16} /></button></div>
      <AdminPageState loading={loading} error={error} retry={() => setReload((value) => value + 1)} />
      {data && <>
        <div className="admin-metrics">
          <article><span>Total penjualan</span><strong>{rupiah.format(data.totalSales)}</strong></article>
          <article><span>Penjualan hari ini</span><strong>{rupiah.format(data.todaySales)}</strong></article>
          <article><span>Total pesanan</span><strong>{data.totalOrders}</strong></article>
          <article><span>Menunggu pembayaran</span><strong>{data.pendingOrders}</strong></article>
          <article><span>Produk terjual</span><strong>{data.productsSold}</strong></article>
        </div>
        <section className="admin-section">
          <div className="admin-section-heading"><h2>Pesanan terbaru</h2><Link to="/admin/orders">Semua pesanan</Link></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Status</th><th>Total</th></tr></thead><tbody>
            {data.recentOrders.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.customerName}</td><td>{order.status}</td><td>{rupiah.format(order.total)}</td></tr>)}
            {data.recentOrders.length === 0 && <tr><td colSpan={4}>Belum ada pesanan.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="admin-section">
          <div className="admin-section-heading"><h2>Stok menipis</h2><Link to="/admin/inventory">Kelola inventori</Link></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>SKU</th><th>Stok tersedia</th></tr></thead><tbody>
            {data.lowStock.map((item) => <tr key={item.id}><td>{item.product.name}</td><td>{item.sku}</td><td className={item.availableStock <= 2 ? 'stock-critical' : ''}>{item.availableStock}</td></tr>)}
            {data.lowStock.length === 0 && <tr><td colSpan={3}>Tidak ada stok menipis.</td></tr>}
          </tbody></table></div>
        </section>
      </>}
    </>
  )
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getAdminOrders(status || undefined).then((value) => { if (active) setOrders(value) })
      .catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [status, reload])

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">OPERASIONAL</p><h1>Pesanan</h1></div><select aria-label="Filter status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Semua status</option>{orderStatuses.map((value) => <option key={value}>{value}</option>)}</select></div>
      <AdminPageState loading={loading} error={error} retry={() => setReload((value) => value + 1)} />
      {!loading && !error && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Pembayaran</th><th>Pesanan</th><th>Total</th></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}><td><Link to={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td><td>{order.customerName}<small>{order.customerEmail}</small></td><td>{order.paymentStatus}</td><td>{order.status}</td><td>{rupiah.format(order.total)}</td></tr>)}
        {orders.length === 0 && <tr><td colSpan={5}>Tidak ada pesanan untuk filter ini.</td></tr>}
      </tbody></table></div>}
    </>
  )
}

export function AdminInventoryPage() {
  const [variantId, setVariantId] = useState('')
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await adjustInventory({ variantId, type, quantity: Number(quantity), note: note || undefined })
      setMessage(`${updated.sku}: stok tersedia ${updated.availableStock}.`)
      setVariantId('')
      setQuantity('')
      setNote('')
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">STOK DAN PERGERAKAN</p><h1>Inventori</h1></div></div>
      <form className="inventory-form" onSubmit={submit}>
        <label>ID varian<input maxLength={30} onChange={(event) => setVariantId(event.target.value)} required value={variantId} /></label>
        <label>Jenis<select onChange={(event) => setType(event.target.value as typeof type)} value={type}><option value="IN">Stok masuk</option><option value="OUT">Stok keluar</option><option value="ADJUSTMENT">Setel stok aktual</option></select></label>
        <label>{type === 'ADJUSTMENT' ? 'Stok aktual' : 'Jumlah'}<input min={1} onChange={(event) => setQuantity(event.target.value)} required type="number" value={quantity} /></label>
        <label>Catatan<input maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="inventory-success" role="status">{message}</p>}
        <button className="button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Simpan penyesuaian'} <Package size={16} /></button>
      </form>
    </>
  )
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [courier, setCourier] = useState('')
  const [service, setService] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('0')

  useEffect(() => {
    let active = true
    setLoading(true)
    getAdminOrder(id).then((value) => {
      if (!active) return
      setOrder(value)
      const shipment = value.shipments[0]
      if (shipment) {
        setCourier(shipment.courier)
        setService(shipment.service)
        setTrackingNumber(shipment.trackingNumber ?? '')
      }
    }).catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, reload])

  const changeStatus = async (status: string) => {
    setSaving(true)
    setError(null)
    try {
      await updateOrderStatus(id, status)
      setReload((value) => value + 1)
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setSaving(false)
    }
  }

  const saveShipping = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateOrderShipping(id, { courier, service, trackingNumber: trackingNumber || undefined, shippingCost: Number(shippingCost) })
      setReload((value) => value + 1)
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="admin-state" role="status">Memuat pesanan...</p>
  if (!order) return <div className="admin-state" role="alert"><p>{error ?? 'Pesanan tidak ditemukan.'}</p><Link to="/admin/orders">Kembali ke pesanan</Link></div>

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">DETAIL PESANAN</p><h1>{order.orderNumber}</h1></div><Link className="text-link" to="/admin/orders">Semua pesanan</Link></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="admin-detail-grid">
        <section className="admin-section"><h2>Produk</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk / SKU</th><th>Jumlah</th><th>Subtotal</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.productName}<small>{item.flavorName} · {item.sizeName} · {item.sku}</small></td><td>{item.quantity}</td><td>{rupiah.format(item.subtotal)}</td></tr>)}</tbody></table></div></section>
        <section className="admin-section"><h2>Penerima</h2><p>{order.customerName}</p><p>{order.customerEmail}</p><p>{String(order.shippingAddressSnapshot.address ?? '')}</p><p>{String(order.shippingAddressSnapshot.city ?? '')}, {String(order.shippingAddressSnapshot.province ?? '')} {String(order.shippingAddressSnapshot.postalCode ?? '')}</p><p className="admin-detail-status">Status: {order.status} · Pembayaran: {order.paymentStatus}</p></section>
      </div>
      <section className="admin-section admin-transition-section"><h2>Perbarui status</h2><div className="status-actions">{orderStatuses.map((status) => <button key={status} disabled={saving || status === order.status} onClick={() => void changeStatus(status)} type="button">{status}</button>)}</div></section>
      <section className="admin-section"><h2>Pengiriman</h2><form className="inventory-form shipping-admin-form" onSubmit={saveShipping}>
        <label>Kurir<input maxLength={80} minLength={2} onChange={(event) => setCourier(event.target.value)} required value={courier} /></label>
        <label>Layanan<input maxLength={80} minLength={2} onChange={(event) => setService(event.target.value)} required value={service} /></label>
        <label>Nomor resi<input maxLength={120} onChange={(event) => setTrackingNumber(event.target.value)} value={trackingNumber} /></label>
        <label>Biaya pengiriman<input min={0} onChange={(event) => setShippingCost(event.target.value)} required type="number" value={shippingCost} /></label>
        <button className="button-primary" disabled={saving} type="submit">Simpan info pengiriman <Package size={16} /></button>
      </form></section>
    </>
  )
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<AdminTaxonomy[]>([])
  const [flavors, setFlavors] = useState<AdminTaxonomy[]>([])
  const [sizes, setSizes] = useState<AdminTaxonomy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [variantRows, setVariantRows] = useState([{ flavorId: '', sizeId: '', sku: '', price: '', stock: '' }])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getAdminProducts(), getAdminTaxonomy('categories'), getAdminTaxonomy('flavors'), getAdminTaxonomy('sizes')])
      .then(([productData, categoryData, flavorData, sizeData]) => {
        if (!active) return
        setProducts(productData)
        setCategories(categoryData.filter((item) => item.status === 'ACTIVE'))
        setFlavors(flavorData.filter((item) => item.status === 'ACTIVE'))
        setSizes(sizeData.filter((item) => item.status === 'ACTIVE'))
      })
      .catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAdminProduct({
        name,
        slug,
        categoryId,
        description: description || undefined,
        images: image ? [{ url: image, altText: name }] : [],
        variants: variantRows.map((variant) => ({ ...variant, price: Number(variant.price), initialStock: Number(variant.stock), weightGrams: Number(sizes.find((size) => size.id === variant.sizeId)?.weightGrams ?? 0) })),
      })
      setName('')
      setSlug('')
      setDescription('')
      setImage('')
      setVariantRows([{ flavorId: '', sizeId: '', sku: '', price: '', stock: '' }])
      setReload((value) => value + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
    finally { setSaving(false) }
  }

  const updateVariant = (index: number, key: keyof typeof variantRows[number], value: string) => {
    setVariantRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">KATALOG</p><h1>Produk</h1></div><button className="admin-refresh" aria-label="Muat ulang produk" onClick={() => setReload((value) => value + 1)} type="button"><RefreshCw size={16} /></button></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="admin-create-form" onSubmit={save}>
        <h2>Tambah produk</h2>
        <div className="checkout-field-grid">
          <label>Nama<input maxLength={180} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <label>Slug<input maxLength={200} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={slug} /></label>
          <label>Kategori<select onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}><option value="">Pilih kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>URL foto<input onChange={(event) => setImage(event.target.value)} type="url" value={image} /></label>
          <label className="checkout-wide">Deskripsi<textarea maxLength={10000} onChange={(event) => setDescription(event.target.value)} rows={2} value={description} /></label>
        </div>
        <div className="variant-draft-heading"><h3>SKU dan varian</h3><button className="quote-button" onClick={() => setVariantRows((rows) => [...rows, { flavorId: '', sizeId: '', sku: '', price: '', stock: '' }])} type="button">Tambah varian</button></div>
        {variantRows.map((variant, index) => <div className="variant-draft" key={index}>
          <label>Rasa<select onChange={(event) => updateVariant(index, 'flavorId', event.target.value)} required value={variant.flavorId}><option value="">Pilih rasa</option>{flavors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Ukuran<select onChange={(event) => updateVariant(index, 'sizeId', event.target.value)} required value={variant.sizeId}><option value="">Pilih ukuran</option>{sizes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>SKU<input maxLength={100} minLength={2} onChange={(event) => updateVariant(index, 'sku', event.target.value)} required value={variant.sku} /></label>
          <label>Harga<input min={0} onChange={(event) => updateVariant(index, 'price', event.target.value)} required type="number" value={variant.price} /></label>
          <label>Stok awal<input min={0} onChange={(event) => updateVariant(index, 'stock', event.target.value)} required type="number" value={variant.stock} /></label>
          {variantRows.length > 1 && <button className="icon-button" aria-label="Hapus baris varian" onClick={() => setVariantRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} type="button"><Trash2 size={15} /></button>}
        </div>)}
        <button className="button-primary" disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Simpan produk'} <Package size={16} /></button>
      </form>
      <section className="admin-section"><h2>Daftar produk</h2><AdminPageState loading={loading} error={error} retry={() => setReload((value) => value + 1)} />{!loading && !error && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Varian</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}<small>{product.slug}</small></td><td>{product.category.name}</td><td>{product.variants.length} SKU</td><td>{product.status}</td></tr>)}{products.length === 0 && <tr><td colSpan={4}>Belum ada produk.</td></tr>}</tbody></table></div>}</section>
    </>
  )
}

export function AdminTaxonomyPage({ type }: { type: 'categories' | 'flavors' | 'sizes' }) {
  const isSize = type === 'sizes'
  const [records, setRecords] = useState<AdminTaxonomy[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [weightGrams, setWeightGrams] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const title = type === 'categories' ? 'Kategori' : type === 'flavors' ? 'Rasa' : 'Ukuran'

  useEffect(() => {
    let active = true
    getAdminTaxonomy(type).then((value) => { if (active) setRecords(value) })
      .catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
    return () => { active = false }
  }, [type, reload])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      await createAdminTaxonomy(type, { name, slug, ...(isSize ? { weightGrams: Number(weightGrams), unit: 'g' } : {}) })
      setName('')
      setSlug('')
      setWeightGrams('')
      setReload((value) => value + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
  }

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">KATALOG</p><h1>{title}</h1></div></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="taxonomy-form" onSubmit={save}><label>Nama<input maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Slug<input maxLength={160} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={slug} /></label>{isSize && <label>Berat (gram)<input min={1} onChange={(event) => setWeightGrams(event.target.value)} required type="number" value={weightGrams} /></label>}<button className="button-primary" type="submit">Tambah {title.toLowerCase()} <ArrowRight size={15} /></button></form>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nama</th><th>Slug</th>{isSize && <th>Berat</th>}<th>Status</th></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.slug}</td>{isSize && <td>{item.weightGrams} {item.unit}</td>}<td>{item.status}</td></tr>)}{records.length === 0 && <tr><td colSpan={isSize ? 4 : 3}>Belum ada {title.toLowerCase()}.</td></tr>}</tbody></table></div>
    </>
  )
}

export function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Awaited<ReturnType<typeof getAdminCoupons>>>([])
  const [code, setCode] = useState('')
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED')
  const [value, setValue] = useState('')
  const [minimumPurchase, setMinimumPurchase] = useState('0')
  const [usageLimit, setUsageLimit] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    getAdminCoupons().then(setCoupons).catch((requestError: unknown) => setError(getRequestError(requestError)))
  }, [reload])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      await createAdminCoupon({ code, type, value: Number(value), minimumPurchase: Number(minimumPurchase), usageLimit: usageLimit ? Number(usageLimit) : undefined, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() })
      setCode('')
      setValue('')
      setReload((current) => current + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
  }

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">PROMOSI</p><h1>Kupon</h1></div></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="taxonomy-form coupon-form" onSubmit={save}><label>Kode<input maxLength={80} minLength={3} onChange={(event) => setCode(event.target.value.toUpperCase())} required value={code} /></label><label>Jenis<select onChange={(event) => setType(event.target.value as typeof type)} value={type}><option value="FIXED">Potongan nominal</option><option value="PERCENTAGE">Persentase</option></select></label><label>Nilai<input min={0} max={type === 'PERCENTAGE' ? 100 : undefined} onChange={(event) => setValue(event.target.value)} required type="number" value={value} /></label><label>Minimum belanja<input min={0} onChange={(event) => setMinimumPurchase(event.target.value)} required type="number" value={minimumPurchase} /></label><label>Batas penggunaan<input min={1} onChange={(event) => setUsageLimit(event.target.value)} type="number" value={usageLimit} /></label><label>Mulai<input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label><label>Berakhir<input onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label><button className="button-primary" type="submit">Simpan kupon <ArrowRight size={15} /></button></form>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Kode</th><th>Diskon</th><th>Penggunaan</th><th>Status</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td>{coupon.code}</td><td>{coupon.value}{coupon.type === 'PERCENTAGE' ? '%' : ' IDR'}</td><td>{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}</td><td>{coupon.status}</td></tr>)}{coupons.length === 0 && <tr><td colSpan={4}>Belum ada kupon.</td></tr>}</tbody></table></div>
    </>
  )
}

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getAdminCustomers(submittedQuery || undefined).then((value) => { if (active) setCustomers(value) })
      .catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [submittedQuery])

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">AKUN TOKO</p><h1>Pelanggan</h1></div></div>
      <form className="customer-search-form" onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query.trim()) }}><input aria-label="Cari pelanggan" onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau email" value={query} /><button className="button-primary" type="submit">Cari <ArrowRight size={15} /></button></form>
      <AdminPageState loading={loading} error={error} retry={() => setSubmittedQuery((value) => value)} />
      {!loading && !error && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pelanggan</th><th>Telepon</th><th>Pesanan</th><th>Status</th><th>Bergabung</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td>{customer.name}<small>{customer.email}</small></td><td>{customer.phone ?? '-'}</td><td>{customer._count.orders}</td><td>{customer.status}</td><td>{new Date(customer.createdAt).toLocaleDateString('id-ID')}</td></tr>)}{customers.length === 0 && <tr><td colSpan={5}>Pelanggan tidak ditemukan.</td></tr>}</tbody></table></div>}
    </>
  )
}

export function AdminReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date()
  monthStart.setDate(1)
  const [from, setFrom] = useState(monthStart.toISOString().slice(0, 10))
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<SalesReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setLoading(true)
    setError(null)
    try { setRows(await getSalesReport(from, to)) }
    catch (requestError) { setError(getRequestError(requestError)) }
    finally { setLoading(false) }
  }

  const totalSales = rows.reduce((total, row) => total + row.totalSales, 0)
  const totalOrders = rows.reduce((total, row) => total + row.orderCount, 0)

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">ANALISIS TOKO</p><h1>Laporan penjualan</h1></div></div>
      <form className="report-filter" onSubmit={load}><label>Dari<input onChange={(event) => setFrom(event.target.value)} required type="date" value={from} /></label><label>Sampai<input onChange={(event) => setTo(event.target.value)} required type="date" value={to} /></label><button className="button-primary" disabled={loading} type="submit">{loading ? 'Memuat...' : 'Tampilkan'} <ArrowRight size={15} /></button></form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="admin-metrics report-metrics"><article><span>Total penjualan lunas</span><strong>{rupiah.format(totalSales)}</strong></article><article><span>Pesanan lunas</span><strong>{totalOrders}</strong></article></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tanggal</th><th>Pesanan lunas</th><th>Penjualan</th></tr></thead><tbody>{rows.map((row) => <tr key={row.day}><td>{new Date(`${row.day}T00:00:00`).toLocaleDateString('id-ID')}</td><td>{row.orderCount}</td><td>{rupiah.format(row.totalSales)}</td></tr>)}{rows.length === 0 && <tr><td colSpan={3}>Pilih rentang tanggal untuk melihat laporan.</td></tr>}</tbody></table></div>
    </>
  )
}

export function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE')
  const [value, setValue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [productIds, setProductIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([getAdminPromotions(), getAdminProducts()]).then(([promotionData, productData]) => {
      if (!active) return
      setPromotions(promotionData)
      setProducts(productData.filter((product) => product.status === 'ACTIVE'))
    }).catch((requestError: unknown) => { if (active) setError(getRequestError(requestError)) })
    return () => { active = false }
  }, [reload])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    try {
      await createAdminPromotion({ name, description: description || undefined, type, value: Number(value), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), productIds })
      setName('')
      setDescription('')
      setValue('')
      setProductIds([])
      setReload((current) => current + 1)
    } catch (requestError) { setError(getRequestError(requestError)) }
  }

  return (
    <>
      <div className="admin-page-heading"><div><p className="eyebrow">PROMOSI TOKO</p><h1>Promosi</h1></div></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="admin-create-form" onSubmit={save}>
        <h2>Tambah promosi</h2>
        <div className="checkout-field-grid">
          <label>Nama<input maxLength={150} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <label>Jenis<select onChange={(event) => setType(event.target.value as typeof type)} value={type}><option value="PERCENTAGE">Persentase</option><option value="FIXED">Potongan nominal</option></select></label>
          <label>Nilai<input min={0} max={type === 'PERCENTAGE' ? 100 : undefined} onChange={(event) => setValue(event.target.value)} required type="number" value={value} /></label>
          <label>Mulai<input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label>
          <label>Berakhir<input onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} /></label>
          <label className="checkout-wide">Deskripsi<textarea maxLength={10000} onChange={(event) => setDescription(event.target.value)} rows={2} value={description} /></label>
        </div>
        <fieldset className="promotion-products"><legend>Produk yang termasuk</legend>{products.map((product) => <label key={product.id}><input checked={productIds.includes(product.id)} onChange={(event) => setProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} type="checkbox" /> {product.name}</label>)}</fieldset>
        <button className="button-primary" type="submit">Simpan promosi <ArrowRight size={15} /></button>
      </form>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Promosi</th><th>Diskon</th><th>Produk</th><th>Status</th></tr></thead><tbody>{promotions.map((promotion) => <tr key={promotion.id}><td>{promotion.name}<small>{new Date(promotion.startsAt).toLocaleDateString('id-ID')} - {new Date(promotion.endsAt).toLocaleDateString('id-ID')}</small></td><td>{promotion.value}{promotion.type === 'PERCENTAGE' ? '%' : ' IDR'}</td><td>{promotion.promotionProducts.length}</td><td>{promotion.status}</td></tr>)}{promotions.length === 0 && <tr><td colSpan={4}>Belum ada promosi.</td></tr>}</tbody></table></div>
    </>
  )
}

export { AdminBoundary }