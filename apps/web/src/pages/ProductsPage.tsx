import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import { getCategories, getFlavors, getProducts, getRequestError, getSizes } from '../features/products/api'
import type { CatalogCategory, CatalogFlavor, CatalogSize, ProductCardData } from '../features/products/types'

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const categoryFromUrl = searchParams.get('category') ?? ''
  const [draft, setDraft] = useState(search)
  const [category, setCategory] = useState(categoryFromUrl)
  const [flavor, setFlavor] = useState('')
  const [size, setSize] = useState('')
  const [sort, setSort] = useState<'newest' | 'name_asc' | 'price_asc' | 'price_desc'>('newest')
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [flavors, setFlavors] = useState<CatalogFlavor[]>([])
  const [sizes, setSizes] = useState<CatalogSize[]>([])
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setDraft(search)
    setCategory(categoryFromUrl)
    setPage(1)
  }, [search, categoryFromUrl])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getCategories(controller.signal),
      getFlavors(controller.signal),
      getSizes(controller.signal),
    ]).then(([categoryOptions, flavorOptions, sizeOptions]) => {
      setCategories(categoryOptions)
      setFlavors(flavorOptions)
      setSizes(sizeOptions)
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getProducts({ q: search || undefined, category: category || undefined, flavor: flavor || undefined, size: size || undefined, sort, page, limit: 12 }, controller.signal)
      .then((response) => {
        setProducts(response.data)
        setTotal(response.meta?.total ?? 0)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getRequestError(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [search, category, flavor, size, sort, page, reload])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (draft.trim()) next.set('q', draft.trim())
    else next.delete('q')
    setSearchParams(next)
    setPage(1)
  }

  const updateCategory = (value: string) => {
    setCategory(value)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('category', value)
    else next.delete('category')
    setSearchParams(next)
  }

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <p className="eyebrow">KATALOG TOKO</p>
        <h1>Semua camilan</h1>
        <p>Cari rasa yang pas untuk waktu ngemilmu.</p>
      </div>
      <div className="catalog-controls">
        <form onSubmit={submitSearch}>
          <input aria-label="Cari nama camilan" onChange={(event) => setDraft(event.target.value)} placeholder="Cari nama camilan" value={draft} />
        </form>
        <select aria-label="Filter kategori" onChange={(event) => updateCategory(event.target.value)} value={category}>
          <option value="">Semua kategori</option>
          {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <select aria-label="Filter rasa" onChange={(event) => { setFlavor(event.target.value); setPage(1) }} value={flavor}>
          <option value="">Semua rasa</option>
          {flavors.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <select aria-label="Filter ukuran" onChange={(event) => { setSize(event.target.value); setPage(1) }} value={size}>
          <option value="">Semua ukuran</option>
          {sizes.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <select aria-label="Urutkan produk" onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1) }} value={sort}>
          <option value="newest">Terbaru</option>
          <option value="name_asc">Nama A-Z</option>
          <option value="price_asc">Harga terendah</option>
          <option value="price_desc">Harga tertinggi</option>
        </select>
        <span className="catalog-count">{total} produk</span>
      </div>
      <ProductGrid products={products} loading={loading} error={error} emptyMessage="Belum ada produk yang cocok. Coba ubah kata kunci atau kategori." onRetry={() => setReload((value) => value + 1)} />
      {total > 12 && (
        <div className="pagination" aria-label="Halaman katalog">
          <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} type="button">Sebelumnya</button>
          <span>Halaman {page} dari {Math.ceil(total / 12)}</span>
          <button disabled={page >= Math.ceil(total / 12) || loading} onClick={() => setPage((value) => value + 1)} type="button">Berikutnya</button>
        </div>
      )}
    </section>
  )
}