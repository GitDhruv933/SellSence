import type { Product, Vendor } from '@/types';
import type { BackendProduct, Shop } from './types';

// The backend doesn't store product photos or shop banners yet, so we render
// a consistent generated placeholder instead of pretending to have a real photo.
function placeholderImage(seed: string, bg: string) {
  return `https://ui-avatars.com/api/?background=${bg}&color=fff&size=256&bold=true&name=${encodeURIComponent(seed)}`;
}

export function shopToVendor(shop: Shop): Vendor {
  return {
    id: String(shop.id),
    name: shop.shop_name || shop.name,
    rating: 0,
    distanceKm: shop.distance_km ?? 0,
    image: placeholderImage(shop.shop_name || shop.name, '059669'),
    ecoFriendly: false,
    deliveryTime: `${shop.item_count} item${shop.item_count === 1 ? '' : 's'}`,
  };
}

export function backendProductToProduct(p: BackendProduct, shop: Shop): Product {
  return {
    id: String(p.id),
    name: p.name,
    vendorId: String(shop.id),
    vendorName: shop.shop_name,
    category: p.category || 'General',
    price: p.selling_price,
    mrp: p.selling_price,
    stock: p.quantity,
    unit: p.unit || 'pc',
    rating: p.avg_rating ?? 0,
    reviews: p.review_count ?? 0,
    distanceKm: shop.distance_km ?? 0,
    ecoFriendly: false,
    image: p.image_url && p.image_url.trim() ? p.image_url : placeholderImage(p.name, 'ea580c'),
  };
}
