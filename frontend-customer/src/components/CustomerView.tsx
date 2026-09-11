import { Search, MapPin, Navigation, ChevronLeft, Leaf, ShoppingBag, Loader2, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/types';
import type { Shop, BackendProduct } from '@/api/types';
import { api } from '@/api/client';
import { shopToVendor, backendProductToProduct } from '@/api/adapters';
import { useGeolocation } from '@/hooks/useGeolocation';
import ProductCard from './ProductCard';

interface CustomerViewProps {
  onAddToCart: (product: Product) => void;
}

export default function CustomerView({ onAddToCart }: CustomerViewProps) {
  const geo = useGeolocation();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [shopProducts, setShopProducts] = useState<BackendProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    if (geo.status !== 'ready' && geo.status !== 'denied' && geo.status !== 'unsupported') return;
    setShopsLoading(true);
    const params = new URLSearchParams();
    if (geo.latitude !== null) params.set('lat', String(geo.latitude));
    if (geo.longitude !== null) params.set('lng', String(geo.longitude));
    api
      .get<Shop[]>(`/shops?${params.toString()}`)
      .then(setShops)
      .catch(() => setShops([]))
      .finally(() => setShopsLoading(false));
  }, [geo.status, geo.latitude, geo.longitude]);

  const openShop = (shop: Shop) => {
    setActiveShop(shop);
    setProductsLoading(true);
    setSearch('');
    api
      .get<{ shop: Shop; products: BackendProduct[] }>(`/shops/${shop.id}`)
      .then((res) => setShopProducts(res.products))
      .catch(() => setShopProducts([]))
      .finally(() => setProductsLoading(false));
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return shopProducts;
    const q = search.toLowerCase();
    return shopProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
    );
  }, [shopProducts, search]);

  const totalItems = shops.reduce((sum, s) => sum + s.item_count, 0);

  // --- Shop detail (browsing a single vendor's catalog) ---
  if (activeShop) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => setActiveShop(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary-700 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            All shops
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-2xl text-gray-900">{activeShop.shop_name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {activeShop.shop_category && <span>{activeShop.shop_category}</span>}
                {activeShop.distance_km !== null && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3.5 h-3.5" /> {activeShop.distance_km} km away
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative max-w-lg mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search items at ${activeShop.shop_name}...`}
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white text-gray-800 placeholder-gray-400 shadow-card outline-none ring-2 ring-transparent focus:ring-primary-300 transition-all text-sm font-medium"
            />
          </div>

          {productsLoading ? (
            <div className="flex items-center justify-center py-24 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={backendProductToProduct(p, activeShop)}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">
                {shopProducts.length === 0 ? 'This shop has not listed any items yet.' : 'No items match your search.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Nearby shops list ---
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-20 w-80 h-80 rounded-full bg-accent-400 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-3 leading-tight">
              Your neighborhood shops,
              <br />
              <span className="text-primary-200">delivered in minutes.</span>
            </h2>
            <p className="text-primary-100 text-sm sm:text-base">
              Discover fresh groceries, snacks, and daily essentials from shops registered near you.
            </p>
          </div>

          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for a shop by name..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-gray-800 placeholder-gray-400 shadow-card outline-none ring-2 ring-transparent focus:ring-primary-300 transition-all text-sm font-medium"
              />
            </div>
            <button
              onClick={geo.refresh}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white text-gray-800 font-semibold text-sm shadow-card hover:bg-gray-50 transition-colors"
            >
              <Navigation className="w-4 h-4 text-primary-600" />
              <span>
                {geo.status === 'loading' ? 'Locating…' : geo.status === 'denied' ? 'Location off' : 'Use my location'}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 text-primary-100">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-medium">{shops.length} shops nearby</span>
            </div>
            <div className="w-px h-4 bg-primary-300/50" />
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-xs font-medium">{totalItems}+ products</span>
            </div>
            <div className="w-px h-4 bg-primary-300/50" />
            <div className="flex items-center gap-1.5">
              <Leaf className="w-4 h-4" />
              <span className="text-xs font-medium">Support local vendors</span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-gray-900">Shops Near You</h3>
          <span className="text-sm text-gray-400 font-medium">{shops.length} shops</span>
        </div>

        {shopsLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Store className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No shops have registered yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {shops
              .filter((s) => s.shop_name.toLowerCase().includes(search.toLowerCase()))
              .map((shop) => {
                const vendor = shopToVendor(shop);
                return (
                  <button
                    key={shop.id}
                    onClick={() => openShop(shop)}
                    className="text-left bg-white rounded-2xl border border-gray-100 shadow-soft hover:shadow-card transition-all duration-300 overflow-hidden group"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-gray-50">
                      <img
                        src={vendor.image}
                        alt={vendor.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3.5">
                      <h4 className="font-display font-bold text-sm text-gray-900 leading-tight mb-1.5">
                        {shop.shop_name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {shop.shop_category && (
                          <>
                            <span>{shop.shop_category}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                          </>
                        )}
                        <span className="flex items-center gap-0.5">
                          <ShoppingBag className="w-3 h-3 text-gray-400" />
                          {shop.item_count} items
                        </span>
                        {shop.distance_km !== null && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              {shop.distance_km} km
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
