import { useState, type FormEvent } from 'react'
import { ArrowRight, LogOut, Search, ShoppingBasket, User } from 'lucide-react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import AuthPage from './pages/AuthPage'
import CheckoutPage from './pages/CheckoutPage'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { AdminBoundary, AdminCouponsPage, AdminCustomersPage, AdminDashboardPage, AdminInventoryPage, AdminOrderDetailPage, AdminOrdersPage, AdminProductsPage, AdminPromotionsPage, AdminReportsPage, AdminTaxonomyPage } from './pages/admin/AdminPages'
import { AddressesPage, CustomerBoundary, OrderDetailPage, OrdersPage, ProfilePage } from './pages/customer/CustomerPages'

function SearchForm() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const search = query.trim()
    navigate(search ? `/products?q=${encodeURIComponent(search)}` : '/products')
  }

  return (
    <form className="header-search" onSubmit={handleSubmit} role="search">
      <Search size={17} aria-hidden="true" />
      <input aria-label="Cari camilan" onChange={(event) => setQuery(event.target.value)} placeholder="Cari camilan..." value={query} />
      <button aria-label="Cari" type="submit"><ArrowRight size={16} /></button>
    </form>
  )
}

function StoreLayout() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="announcement"><span>Teman ngemilmu, dikirim dari Indonesia</span><span className="announcement-mark">Pilih rasa. Buka bungkus. Ulangi.</span></div>
      <header className="site-header">
        <Link className="wordmark" to="/" aria-label="Piscokshop, beranda"><span className="wordmark-stamp">ps</span><span>piscok<span className="wordmark-light">shop</span></span></Link>
        <nav className="main-nav" aria-label="Navigasi utama">
          <NavLink end to="/">Beranda</NavLink>
          <NavLink to="/products">Semua camilan</NavLink>
          <NavLink to="/cart"><ShoppingBasket size={15} aria-hidden="true" /> Keranjang</NavLink>
          {!loading && (user ? (
            <>
              <NavLink to="/profile" title="Buka profil saya" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <User size={14} /> {user.name.split(' ')[0]}
              </NavLink>
              <button
                className="header-account"
                onClick={() => void handleSignOut()}
                type="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Keluar dari akun"
              >
                <LogOut size={13} /> Keluar
              </button>
            </>
          ) : (
            <NavLink to="/login">Masuk</NavLink>
          ))}
        </nav>
        <SearchForm />
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">
        <Link className="wordmark footer-wordmark" to="/"><span className="wordmark-stamp">ps</span><span>piscok<span className="wordmark-light">shop</span></span></Link>
        <p>Camilan kecil, jeda yang lebih seru.</p>
        <span className="footer-note">Dibuat untuk waktu ngemil.</span>
      </footer>
    </>
  )
}

function NotFoundPage() {
  return (
    <section className="message-page">
      <p className="eyebrow">404 Â· HALAMAN TIDAK DITEMUKAN</p>
      <h1>Yah, camilannya tidak ada di sini.</h1>
      <Link className="text-link" to="/products">Kembali ke katalog <ArrowRight size={16} /></Link>
    </section>
  )
}

export default function StoreApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/login" element={<AuthPage adminOnly mode="login" />} />
          <Route path="/admin" element={<AdminBoundary />}>
            <Route index element={<Navigate replace to="/admin/dashboard" />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailPage />} />
            <Route path="inventory" element={<AdminInventoryPage />} />
            <Route path="categories" element={<AdminTaxonomyPage type="categories" />} />
            <Route path="flavors" element={<AdminTaxonomyPage type="flavors" />} />
            <Route path="sizes" element={<AdminTaxonomyPage type="sizes" />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="promotions" element={<AdminPromotionsPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
          </Route>
          <Route element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:slug" element={<ProductPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
            <Route element={<CustomerBoundary />}>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="profile/addresses" element={<AddressesPage />} />
              <Route path="orders" element={<OrdersPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
