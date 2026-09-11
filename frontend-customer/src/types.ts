export interface Vendor {
  id: string;
  name: string;
  rating: number;
  distanceKm: number;
  image: string;
  ecoFriendly: boolean;
  deliveryTime: string;
}

export interface Product {
  id: string;
  name: string;
  vendorId: string;
  vendorName: string;
  category: string;
  price: number;
  mrp: number;
  stock: number;
  unit: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  ecoFriendly: boolean;
  image: string;
  trending?: boolean;
  bestDeal?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SalesDataPoint {
  month: string;
  sales: number;
  predicted: number;
}
