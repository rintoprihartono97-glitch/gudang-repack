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
  getNextDocNumber: (type?: 'IN' | 'OUT') => string;
  createNewSheetDocNumber: () => string;
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

  const getNextDocNumber = (_type?: 'IN' | 'OUT'): string => {
    const now = new Date();
    const yyyy = now.getFullYear();

    let maxSeq = 0;
    // Scan existing transactions for RPK-YYYY-XXXXXX or RPK-XXXXXX
    transactions.forEach(t => {
      const match = (t.noDokumen || '').match(/RPK-(?:\d{4}-)?(\d+)/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    });

    try {
      const storedSeq = parseInt(localStorage.getItem('gudang_repack_doc_seq') || '0', 10);
      if (!isNaN(storedSeq) && storedSeq > maxSeq) {
        maxSeq = storedSeq;
      }
    } catch (e) {}

    const nextSeq = maxSeq + 1;
    return `RPK-${yyyy}-${String(nextSeq).padStart(6, '0')}`;
  };

  const createNewSheetDocNumber = (): string => {
    const nextDoc = getNextDocNumber();
    const match = nextDoc.match(/RPK-(?:\d{4}-)?(\d+)/i);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      try {
        localStorage.setItem('gudang_repack_doc_seq', String(seq));
      } catch (e) {}
    }
    return nextDoc;
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

    // Track used sequence number so next document automatically increments
    const docMatch = data.noDokumen.match(/RPK-(?:\d{4}-)?(\d+)/i);
    if (docMatch && docMatch[1]) {
      const seqUsed = parseInt(docMatch[1], 10);
      try {
        const prev = parseInt(localStorage.getItem('gudang_repack_doc_seq') || '0', 10);
        if (seqUsed >= prev) {
          localStorage.setItem('gudang_repack_doc_seq', String(seqUsed));
        }
      } catch (e) {}
    }

    return { success: true };
  };

  const resetToDefault = () => {
    setItems(INITIAL_ITEMS);
    setTransactions([]);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(INITIAL_ITEMS));
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
    localStorage.removeItem('gudang_repack_doc_seq');
  };

  const clearTransactions = () => {
    setTransactions([]);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
    localStorage.removeItem('gudang_repack_doc_seq');
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
        createNewSheetDocNumber,
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
