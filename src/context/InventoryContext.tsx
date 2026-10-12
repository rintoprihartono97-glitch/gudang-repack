import React, { createContext, useContext, useState, useEffect } from 'react';
import { Item, StockTransaction, TransactionItem } from '../types';
import { INITIAL_ITEMS, INITIAL_TRANSACTIONS } from '../data/initialItems';

const STORAGE_KEY_ITEMS = 'gudang_repack_items_v3';
const STORAGE_KEY_TXS = 'gudang_repack_transactions_v3';

interface InventoryContextType {
  items: Item[];
  transactions: StockTransaction[];
  addItem: (item: Omit<Item, 'id'>) => Item;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  recordTransaction: (data: {
    type: 'IN' | 'OUT';
    tanggal: string;
    noDokumen: string;
    keterangan: string;
    items: Array<{ itemId: string; qty: number }>;
  }) => { success: boolean; error?: string };
  getNextDocNumber: (type: 'IN' | 'OUT') => string;
  resetToDefault: () => void;
  clearTransactions: () => void;
  importItems: (newItems: Item[]) => void;
  importFullData: (items: Item[], txs: StockTransaction[]) => void;
  locations: string[];
  units: string[];
  getItemById: (id: string) => Item | undefined;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      // Clean up previous test storage if exists
      localStorage.removeItem('gudang_repack_transactions_master_clean');
      localStorage.removeItem('gudang_repack_transactions_v2');
      localStorage.removeItem('gudang_repack_items_v2');

      const stored = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading items from localStorage', e);
    }
    return INITIAL_ITEMS;
  });

  const [transactions, setTransactions] = useState<StockTransaction[]>(() => {
    try {
      // Clean up old storage containing transactions
      localStorage.removeItem('gudang_repack_transactions_master_clean');
      const stored = localStorage.getItem(STORAGE_KEY_TXS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading txs from localStorage', e);
    }
    return [];
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed saving items to localStorage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed saving transactions to localStorage', e);
    }
  }, [transactions]);

  // Sync across tabs via window storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_ITEMS && e.newValue) {
        try {
          setItems(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      } else if (e.key === STORAGE_KEY_TXS && e.newValue) {
        try {
          setTransactions(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const locations = Array.from(new Set(items.map(i => i.lokasi).filter(Boolean))).sort();
  const units = Array.from(new Set(items.map(i => i.satuan).filter(Boolean))).sort();

  const getItemById = (id: string) => {
    return items.find(i => i.id === id);
  };

  const getNextDocNumber = (type: 'IN' | 'OUT'): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;
    const prefix = type === 'IN' ? `BM-${datePrefix}-` : `BK-${datePrefix}-`;

    const countForToday = transactions.filter(t => t.type === type && t.noDokumen.startsWith(prefix)).length + 1;
    return `${prefix}${String(countForToday).padStart(3, '0')}`;
  };

  const addItem = (data: Omit<Item, 'id'>): Item => {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newItem: Item = {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };
    setItems(prev => [newItem, ...prev]);
    return newItem;
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    }));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const recordTransaction = (data: {
    type: 'IN' | 'OUT';
    tanggal: string;
    noDokumen: string;
    keterangan: string;
    items: Array<{ itemId: string; qty: number }>;
  }): { success: boolean; error?: string } => {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Daftar barang tidak boleh kosong.' };
    }

    // Verify stock availability if OUT
    if (data.type === 'OUT') {
      for (const req of data.items) {
        const item = items.find(i => i.id === req.itemId);
        if (!item) {
          return { success: false, error: `Barang dengan ID ${req.itemId} tidak ditemukan.` };
        }
        if (req.qty <= 0) {
          return { success: false, error: `Jumlah qty untuk ${item.nama} harus lebih dari 0.` };
        }
        if (item.stok < req.qty) {
          return {
            success: false,
            error: `Stok barang "${item.nama}" tidak mencukupi! Stok saat ini: ${item.stok} ${item.satuan}, permintaan: ${req.qty} ${item.satuan}.`
          };
        }
      }
    }

    const txItems: TransactionItem[] = [];
    const itemStockUpdates = new Map<string, number>();

    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId);
      if (!item) continue;
      const stokSebelum = item.stok;
      const stokSesudah = data.type === 'IN' ? stokSebelum + req.qty : stokSebelum - req.qty;

      txItems.push({
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        satuan: item.satuan,
        lokasi: item.lokasi,
        qty: req.qty,
        stokSebelum,
        stokSesudah
      });

      itemStockUpdates.set(item.id, stokSesudah);
    }

    const newTransaction: StockTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: data.type,
      noDokumen: data.noDokumen,
      tanggal: data.tanggal,
      keterangan: data.keterangan || '-',
      items: txItems,
      createdAt: new Date().toISOString()
    };

    // Update items stock
    setItems(prev => prev.map(item => {
      if (itemStockUpdates.has(item.id)) {
        return {
          ...item,
          stok: itemStockUpdates.get(item.id)!,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    }));

    // Add transaction to history
    setTransactions(prev => [newTransaction, ...prev]);

    return { success: true };
  };

  const resetToDefault = () => {
    setItems(INITIAL_ITEMS);
    setTransactions([]);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(INITIAL_ITEMS));
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
  };

  const clearTransactions = () => {
    setTransactions([]);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
  };

  const importItems = (newItems: Item[]) => {
    setItems(newItems);
  };

  const importFullData = (newItems: Item[], newTxs: StockTransaction[]) => {
    setItems(newItems);
    setTransactions(newTxs);
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        transactions,
        addItem,
        updateItem,
        deleteItem,
        recordTransaction,
        getNextDocNumber,
        resetToDefault,
        clearTransactions,
        importItems,
        importFullData,
        locations,
        units,
        getItemById
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
