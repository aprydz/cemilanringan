import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, PackageCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import { getCategories, getProducts, getRequestError } from '../features/products/api'
import type { CatalogCategory, ProductCardData } from '../features/products/types'

const heroImage = 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=2000&q=85'

export default function HomePage() {
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([getProducts({ limit: 4, sort: 'newest' }, controller.signal), getCategories(controller.signal)])
      .then(([productResponse, categoryResponse]) => {
        setProducts(productResponse.data)
        setCategories(categoryResponse)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getRequestError(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reload])

  return (
    <>
      <section className="hero">
        <img className="hero-image" src={heroImage} alt="Aneka keripik untuk waktu santai" fetchPriority="high" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">PILIHAN CAMILAN LOKAL</p>
          <h1>Waktu santai, <em>teman kriuk.</em></h1>
          <p>Temukan camilan favorit untuk nemenin cerita, kerja, atau jeda kecil di tengah hari.</p>
          <Link className="button-primary" to="/products">Jelajahi camilan <ArrowRight size={17} /></Link>
        </div>
        <span className="hero-count">01 / PILIH YANG KAMU SUKA</span>
      </section>

      <section className="benefit-strip" aria-label="Informasi toko">
        <div className="benefit-item"><PackageCheck size={18} /><span>Dikemas dengan rapi</span></div>
        <div className="benefit-item"><ShieldCheck size={18} /><span>Belanja mudah dan aman</span></div>
        <div className="benefit-item"><BadgeCheck size={18} /><span>Pilihan rasa beragam</span></div>
      </section>

      <section className="section-wrap">
        <div className="section-heading">
          <div><p className="eyebrow">CARI SESUAI SELERA</p><h2>Rak camilan</h2></div>
          <Link className="text-link" to="/products">Lihat semua <ArrowRight size={15} /></Link>
        </div>
        {categories.length > 0 ? (
          <div className="category-list">
            {categories.map((category) => <Link className="category-link" key={category.id} to={`/products?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link>)}
          </div>
        ) : loading ? <div className="shelf-state" role="status"><p>Memuat kategori...</p></div> : null}
      </section>

      <section className="section-wrap featured-section">
        <div className="section-heading">
          <div><p className="eyebrow">DARI RAK KAMI</p><h2>Yang baru mampir</h2><p>Pilihan terbaru untuk teman ngemilmu.</p></div>
          <Link className="text-link" to="/products">Buka katalog <ArrowRight size={15} /></Link>
        </div>
        <ProductGrid products={products} loading={loading} error={error} emptyMessage="Produk akan tampil di sini setelah katalog tersedia." onRetry={() => setReload((value) => value + 1)} />
      </section>

      <section className="section-wrap">
        <div className="section-heading"><div><p className="eyebrow">SEDERHANA SAJA</p><h2>Ngemil, tanpa ribet.</h2></div></div>
        <div className="category-list"><span className="category-link">Pilih rasa favorit</span><span className="category-link">Tentukan ukuran</span><span className="category-link">Pesan dari rumah</span></div>
      </section>
    </>
  )
}