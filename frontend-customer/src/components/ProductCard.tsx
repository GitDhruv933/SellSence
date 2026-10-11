import { Star, Leaf, Plus, Check } from 'lucide-react';
import type { Product } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { trackProductView } from '@/api/client';
import { getViewerKey } from '@/lib/viewerKey';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const cardRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  // Smart Pricing needs a "views" signal, and there's no dedicated product
  // detail page to track a visit to - so a card counts as "viewed" once it's
  // actually been scrolled into view, not just rendered in an off-screen
  // list. Fires at most once per card per mount; server-side dedup handles
  // the rest (one count per viewer per product per day).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !trackedRef.current) {
          trackedRef.current = true;
          trackProductView(product.id, getViewerKey());
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product.id]);

  const handleAdd = () => {
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const stockColor =
    product.stock <= 2
      ? 'bg-accent-50 text-accent-700 border-accent-200'
      : 'bg-primary-50 text-primary-700 border-primary-200';

  const stockLabel = product.stock <= 2 ? `Only ${product.stock} Left!` : 'In Stock';

  return (
    <div ref={cardRef} className="group bg-white rounded-2xl border border-gray-100 shadow-soft hover:shadow-card transition-all duration-300 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {discount > 0 && (
            <span className="bg-accent-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-soft">
              {discount}% OFF
            </span>
          )}
          {product.ecoFriendly && (
            <span className="flex items-center gap-0.5 bg-primary-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-soft">
              <Leaf className="w-3 h-3" />
              Eco
            </span>
          )}
        </div>
        <div className={`absolute top-2.5 right-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${stockColor}`}>
          {stockLabel}
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-display font-bold text-sm text-gray-900 leading-tight line-clamp-2">
            {product.name}
          </h3>
        </div>
        <p className="text-xs text-gray-400 font-medium mb-2">{product.vendorName}</p>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-2.5">
          {product.reviews > 0 ? (
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 fill-accent-400 text-accent-400" />
              <span className="text-xs font-bold text-gray-700">{product.rating}</span>
              <span className="text-[11px] text-gray-400">({product.reviews})</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 font-medium">No reviews yet</span>
          )}
        </div>

        {product.bestDeal && (
          <p className="text-[11px] font-semibold text-primary-600 mb-2 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
            Lowest price nearby
          </p>
        )}

        {/* Price + add */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-extrabold text-base text-gray-900">
              ₹{product.price}
            </span>
            {discount > 0 && (
              <span className="text-xs text-gray-400 line-through">₹{product.mrp}</span>
            )}
            <span className="text-[11px] text-gray-400 font-medium">/ {product.unit}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
              added
                ? 'bg-primary-500 text-white'
                : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white shadow-soft'
            } ${product.stock === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {added ? <Check className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
