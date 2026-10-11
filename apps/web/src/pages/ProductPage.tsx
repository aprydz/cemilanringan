import { useEffect, useState } from 'react'
import { ChevronRight, Minus, Plus, ShoppingBasket } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { addCartItem } from '../features/cart/api'
import { getProduct, getRequestError } from '../features/products/api'
import type { ProductDetailData } from '../features/products/types'

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export default function ProductPage() {
  const { slug = '' } = useParams()
  const [product, setProduct] = useState<ProductDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ flavorId: string; sizeId: string } | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [cartMessage, setCartMessage] = useState<string | null>(null)
  const [cartError, setCartError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setProduct(null)
    setError(null)
    getProduct(slug, controller.signal)
      .then((value) => {
        setProduct(value)
        const firstVariant = value.variants[0]
        if (firstVariant) setSelection({ flavorId: firstVariant.flavor.id, sizeId: firstVariant.size.id })
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getRequestError(requestError))
      })
    return () => controller.abort()
  }, [slug])

  if (error) {
    return <section className="message-page" role="alert"><p className="eyebrow">KATALOG</p><h1>{error}</h1><Link className="text-link" to="/products">Kembali ke katalog <ChevronRight size={16} /></Link></section>
  }

  if (!product) {
    return <section className="message-page" role="status"><p className="eyebrow">KATALOG</p><h1>Memuat detail camilan...</h1></section>
  }

  const flavors = [...new Map(product.variants.map(({ flavor }) => [flavor.id, flavor])).values()]
  const selectedFlavorId = selection?.flavorId ?? product.variants[0]?.flavor.id
  const availableSizes = product.variants.filter(({ flavor }) => flavor.id === selectedFlavorId)
  const selectedSizeId = availableSizes.some(({ size }) => size.id === selection?.sizeId)
    ? selection?.sizeId
    : availableSizes[0]?.size.id
  const selectedVariant = availableSizes.find(({ size }) => size.id === selectedSizeId)
  const image = selectedVariant?.image ?? product.images[0]?.url ?? null

  const handleAddToCart = async () => {
    if (!selectedVariant || selectedVariant.availableStock < quantity) return
    setAdding(true)
    setCartMessage(null)
    setCartError(null)
    try {
      await addCartItem(selectedVariant.id, quantity)
      setCartMessage('Ditambahkan ke keranjang.')
    } catch (requestError) {
      setCartError(getRequestError(requestError))
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Beranda</Link><ChevronRight size={13} /><Link to="/products">Camilan</Link><ChevronRight size={13} /><span>{product.name}</span>
      </nav>
      <div className="product-detail-grid">
        <div className="product-detail-image">
          {image ? <img src={image} alt={product.name} /> : <div className="product-photo-fallback">{product.name.slice(0, 1)}</div>}
        </div>
        <div className="product-info">
          <p className="eyebrow">{product.category.name}</p>
          <h1>{product.name}</h1>
          <p className="product-info-description">{product.description || 'Pilih varian rasa dan ukuran yang paling pas untukmu.'}</p>
          {selectedVariant && <div className="detail-price-wrap">
            {selectedVariant.promotionDiscount > 0 && <span className="detail-list-price">{rupiah.format(selectedVariant.listPrice)}</span>}
            <p className="detail-price">{rupiah.format(selectedVariant.price)}</p>
            {selectedVariant.promotionName && <span className="promotion-label">{selectedVariant.promotionName}</span>}
          </div>}
          <fieldset className="variant-control">
            <legend>Pilih rasa</legend>
            <select
              aria-label="Pilih rasa"
              onChange={(event) => {
                const next = product.variants.find(({ flavor }) => flavor.id === event.target.value)
                if (next) {
                  setSelection({ flavorId: next.flavor.id, sizeId: next.size.id })
                  setQuantity(1)
                }
              }}
              value={selectedFlavorId}
            >
              {flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}
            </select>
          </fieldset>
          <fieldset className="variant-control">
            <legend>Pilih ukuran</legend>
            <select
              aria-label="Pilih ukuran"
              onChange={(event) => {
                setSelection({ flavorId: selectedFlavorId!, sizeId: event.target.value })
                setQuantity(1)
              }}
              value={selectedSizeId}
            >
              {availableSizes.map(({ size }) => <option key={size.id} value={size.id}>{size.name}</option>)}
            </select>
          </fieldset>
          <p className={`stock-note${selectedVariant && selectedVariant.availableStock === 0 ? ' out-of-stock' : ''}`}>
            {selectedVariant && selectedVariant.availableStock > 0 ? `${selectedVariant.availableStock} tersedia · SKU ${selectedVariant.sku}` : 'Varian ini sedang habis.'}
          </p>
          <div className="purchase-controls">
            <div className="quantity-control" aria-label="Jumlah produk">
              <button aria-label="Kurangi jumlah" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button"><Minus size={15} /></button>
              <input aria-label="Jumlah" max={selectedVariant?.availableStock ?? 1} min={1} onChange={(event) => setQuantity(Math.max(1, Math.min(selectedVariant?.availableStock ?? 1, Number(event.target.value) || 1)))} type="number" value={quantity} />
              <button aria-label="Tambah jumlah" disabled={!selectedVariant || quantity >= selectedVariant.availableStock} onClick={() => setQuantity((value) => value + 1)} type="button"><Plus size={15} /></button>
            </div>
            <button className="button-primary add-cart-button" disabled={!selectedVariant || selectedVariant.availableStock === 0 || adding} onClick={handleAddToCart} type="button">
              <ShoppingBasket size={17} /> {adding ? 'Menambahkan...' : 'Tambah ke keranjang'}
            </button>
          </div>
          {cartMessage && <p className="cart-feedback" role="status">{cartMessage} <Link to="/cart">Lihat keranjang</Link></p>}
          {cartError && <p className="cart-feedback cart-feedback-error" role="alert">{cartError}</p>}
          <p className="detail-information">Berat bersih {selectedVariant?.weightGrams ?? 0} g. Harga dan stok ditampilkan untuk varian yang dipilih.</p>
        </div>
      </div>
    </article>
  )
}