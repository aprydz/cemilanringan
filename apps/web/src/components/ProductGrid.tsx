import type { ProductCardData } from '../features/products/types'
import ProductCard from './ProductCard'

type Props = {
  products: ProductCardData[]
  loading: boolean
  error: string | null
  emptyMessage?: string
  onRetry?: () => void
}

export default function ProductGrid({ products, loading, error, emptyMessage = 'Belum ada produk di bagian ini.', onRetry }: Props) {
  if (loading) return <div className="shelf-state" role="status"><p>Menyiapkan camilan pilihan...</p></div>

  if (error) {
    return (
      <div className="shelf-state" role="alert">
        <div><p>{error}</p>{onRetry && <button onClick={onRetry} type="button">Coba lagi</button>}</div>
      </div>
    )
  }

  if (products.length === 0) return <div className="shelf-state"><p>{emptyMessage}</p></div>

  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
}