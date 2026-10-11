import { Plus, Search, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { BackendProduct } from '@/api/types';

export interface ProductFormValues {
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  image_url: string;
}

interface InventoryTableProps {
  products: BackendProduct[];
  onAdd: (values: ProductFormValues) => Promise<void>;
  onUpdate: (id: number, values: Partial<ProductFormValues>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const emptyForm: ProductFormValues = {
  name: '',
  category: '',
  unit: 'pc',
  cost_price: 0,
  selling_price: 0,
  quantity: 0,
  reorder_level: 5,
  image_url: '',
};

export default function InventoryTable({ products, onAdd, onUpdate, onDelete }: InventoryTableProps) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ProductFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ selling_price: number; quantity: number }>({
    selling_price: 0,
    quantity: 0,
  });
  
  // Track failed image URLs to cleanly display fallback badges
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: BackendProduct) => {
    setEditingId(p.id);
    setEditValues({ selling_price: p.selling_price, quantity: p.quantity });
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      await onUpdate(id, editValues);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    // Normalize Image URL if missing http/https prefix
    let formattedImageUrl = form.image_url.trim();
    if (formattedImageUrl && !/^https?:\/\//i.test(formattedImageUrl)) {
      formattedImageUrl = `https://${formattedImageUrl}`;
    }

    try {
      await onAdd({ ...form, image_url: formattedImageUrl });
      setForm(emptyForm);
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleImageError = (id: number) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100">Inventory Manager</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">{filtered.length} products in catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
            />
          </div>
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-soft transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add New Item
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={submitAdd} className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 sm:col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            placeholder="Unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Cost ₹"
            value={form.cost_price || ''}
            onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Price ₹"
            value={form.selling_price || ''}
            onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            type="number"
            min={0}
            placeholder="Stock qty"
            value={form.quantity || ''}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            type="number"
            min={0}
            placeholder="Reorder level"
            value={form.reorder_level || ''}
            onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <input
            type="text"
            placeholder="Image URL (optional)"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className="col-span-2 sm:col-span-5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-200"
          />
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
              <th className="text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 py-3">Product Name</th>
              <th className="text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 py-3">Category</th>
              <th className="text-right text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 py-3">Price</th>
              <th className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 py-3">Stock</th>
              <th className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const lowStock = product.quantity <= product.reorder_level;
              const isEditing = editingId === product.id;
              const hasImageError = failedImages[product.id];

              return (
                <tr key={product.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        {product.image_url && !hasImageError ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(product.id)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                            {product.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{product.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                      {product.category || 'General'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.selling_price}
                        onChange={(e) => setEditValues({ ...editValues, selling_price: Number(e.target.value) })}
                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-right outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span className="font-display font-bold text-sm text-gray-900 dark:text-gray-100">₹{product.selling_price}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.quantity}
                        onChange={(e) => setEditValues({ ...editValues, quantity: Number(e.target.value) })}
                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-center outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          lowStock ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'bg-primary-50 text-primary-700'
                        }`}
                      >
                        {product.quantity} {lowStock && 'low!'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(product.id)}
                            disabled={saving}
                            className="w-8 h-8 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 flex items-center justify-center"
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(product)}
                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(product.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                  No products yet. Add your first item to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}