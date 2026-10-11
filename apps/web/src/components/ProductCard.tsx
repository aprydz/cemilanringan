import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ProductCardData } from '../features/products/types'

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export default function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link className="product-card" to={`/products/${encodeURIComponent(product.slug)}`}>
      <div className="product-photo">
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="product-photo-fallback" aria-label={`Foto ${product.name} belum tersedia`}>{product.name.slice(0, 1)}</div>}
      </div>
      <div className="product-card-body">
        <p className="product-category">{product.category.name}</p>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-card-bottom">
          <span className="product-price-wrap">
            {product.promotionDiscount > 0 && <span className="product-list-price">{rupiah.format(product.listPrice)}</span>}
            <span className="product-price">Mulai {rupiah.format(product.startingPrice)}</span>
          </span>
          <span className="flavor-note">{product.flavorCount} rasa <ArrowUpRight size={13} aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  )
}