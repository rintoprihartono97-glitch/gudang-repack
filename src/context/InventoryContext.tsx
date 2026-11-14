import React, { createContext, useContext, useState, useEffect } from 'react';
import { Item, StockTransaction, TransactionItem, ProductionRecord, ProductionItem } from '../types';
import { INITIAL_ITEMS, INITIAL_TRANSACTIONS } from '../data/initialItems';

const STORAGE_KEY_ITEMS = 'gudang_repack_items_v3';
const STORAGE_KEY_TXS = 'gudang_repack_transactions_v3';
const STORAGE_KEY_PRODUCTIONS = 'gudang_repack_productions_v1';

interface InventoryContextType {
  items: Item[];
  transactions: StockTransaction[];
  productions: ProductionRecord[];
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
  updateTransaction: (
    txId: string,
    data: {
      type: 'IN' | 'OUT';
      tanggal: string;
      noDokumen: string;
      keterangan: string;
      items: Array<{ itemId: string; qty: number }>;
    }
  ) => { success: boolean; error?: string };
  recordProduction: (data: {
    tanggal: string;
    noDokumen: string;
    keterangan: string;
    items: Array<{ itemId: string; keluar: number; masuk: number }>;
  }) => { success: boolean; error?: string };
  updateProduction: (
    prodId: string,
    data: {
      tanggal: string;
      noDokumen: string;
      keterangan: string;
      items: Array<{ itemId: string; keluar: number; masuk: number }>;
    }
  ) => { success: boolean; error?: string };
  getNextDocNumber: (type?: 'IN' | 'OUT') => string;
  getNextProductionDocNumber: () => string;
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

  const [productions, setProductions] = useState<ProductionRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRODUCTIONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading productions from localStorage', e);
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTIONS, JSON.stringify(productions));
    } catch (e) {
      console.error('Failed saving productions to localStorage', e);
    }
  }, [productions]);

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
      } else if (e.key === STORAGE_KEY_PRODUCTIONS && e.newValue) {
        try {
          setProductions(JSON.parse(e.newValue));
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

  const getNextProductionDocNumber = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();

    let maxSeq = 0;
    productions.forEach(p => {
      const match = (p.noDokumen || '').match(/PRD-(?:\d{4}-)?(\d+)/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    });

    try {
      const storedSeq = parseInt(localStorage.getItem('gudang_repack_prod_seq') || '0', 10);
      if (!isNaN(storedSeq) && storedSeq > maxSeq) {
        maxSeq = storedSeq;
      }
    } catch (e) {}

    const nextSeq = maxSeq + 1;
    return `PRD-${yyyy}-${String(nextSeq).padStart(6, '0')}`;
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

  const updateTransaction = (
    txId: string,
    data: {
      type: 'IN' | 'OUT';
      tanggal: string;
      noDokumen: string;
      keterangan: string;
      items: Array<{ itemId: string; qty: number }>;
    }
  ): { success: boolean; error?: string } => {
    const oldTx = transactions.find(t => t.id === txId);
    if (!oldTx) {
      return { success: false, error: 'Dokumen transaksi tidak ditemukan.' };
    }
    if (!data.noDokumen.trim()) {
      return { success: false, error: 'No Document wajib diisi.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Daftar barang tidak boleh kosong.' };
    }

    const oldDeltaByItem = new Map<string, number>();
    oldTx.items.forEach(entry => {
      const eff = oldTx.type === 'IN' ? entry.qty : -entry.qty;
      oldDeltaByItem.set(entry.itemId, (oldDeltaByItem.get(entry.itemId) || 0) + eff);
    });

    const newDeltaByItem = new Map<string, number>();
    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId);
      if (!item) {
        return { success: false, error: `Barang dengan ID ${req.itemId} tidak ditemukan.` };
      }
      if (!req.qty || req.qty <= 0) {
        return { success: false, error: `Qty untuk "${item.nama}" harus lebih dari 0.` };
      }
      const eff = data.type === 'IN' ? req.qty : -req.qty;
      newDeltaByItem.set(req.itemId, (newDeltaByItem.get(req.itemId) || 0) + eff);
    }

    const affectedIds = new Set<string>([
      ...Array.from(oldDeltaByItem.keys()),
      ...Array.from(newDeltaByItem.keys())
    ]);

    for (const itemId of affectedIds) {
      const item = items.find(i => i.id === itemId);
      if (!item) continue;
      const oldEff = oldDeltaByItem.get(itemId) || 0;
      const newEff = newDeltaByItem.get(itemId) || 0;
      const updatedStok = item.stok - oldEff + newEff;
      if (updatedStok < 0) {
        return {
          success: false,
          error: `Stok barang "${item.nama}" tidak mencukupi setelah perubahan! Stok tersedia: ${item.stok - oldEff} ${item.satuan}, kebutuhan baru: ${Math.abs(newEff)} ${item.satuan}.`
        };
      }
    }

    const runningStockMap = new Map<string, number>();
    affectedIds.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        const oldEff = oldDeltaByItem.get(itemId) || 0;
        runningStockMap.set(itemId, item.stok - oldEff);
      }
    });

    const updatedTxItems: TransactionItem[] = [];
    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId)!;
      const stokSebelum = runningStockMap.get(item.id) ?? item.stok;
      const stokSesudah = data.type === 'IN' ? stokSebelum + req.qty : stokSebelum - req.qty;
      runningStockMap.set(item.id, stokSesudah);

      updatedTxItems.push({
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        satuan: item.satuan,
        lokasi: item.lokasi,
        qty: req.qty,
        stokSebelum,
        stokSesudah
      });
    }

    setItems(prev => prev.map(item => {
      if (runningStockMap.has(item.id)) {
        return {
          ...item,
          stok: runningStockMap.get(item.id)!,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    }));

    setTransactions(prev => prev.map(tx => {
      if (tx.id === txId) {
        return {
          ...tx,
          type: data.type,
          tanggal: data.tanggal,
          noDokumen: data.noDokumen.trim(),
          keterangan: data.keterangan.trim() || '-',
          items: updatedTxItems
        };
      }
      return tx;
    }));

    return { success: true };
  };

  const recordProduction = (data: {
    tanggal: string;
    noDokumen: string;
    keterangan: string;
    items: Array<{ itemId: string; keluar: number; masuk: number }>;
  }): { success: boolean; error?: string } => {
    if (!data.noDokumen.trim()) {
      return { success: false, error: 'No Dokumen Produksi wajib diisi.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Daftar barang produksi tidak boleh kosong.' };
    }

    const simulatedStock = new Map<string, number>();
    items.forEach(it => simulatedStock.set(it.id, it.stok));

    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId);
      if (!item) {
        return { success: false, error: `Barang dengan ID ${req.itemId} tidak ditemukan.` };
      }
      const keluar = Number(req.keluar) || 0;
      const masuk = Number(req.masuk) || 0;
      if (keluar < 0 || masuk < 0) {
        return { success: false, error: `Nilai keluar/masuk untuk "${item.nama}" tidak boleh negatif.` };
      }
      if (keluar === 0 && masuk === 0) {
        return { success: false, error: `Barang "${item.nama}" harus memiliki nilai Keluar atau Masuk lebih dari 0.` };
      }
      const cur = simulatedStock.get(item.id) ?? 0;
      if (cur - keluar < 0) {
        return {
          success: false,
          error: `Stok barang "${item.nama}" tidak mencukupi untuk produksi keluar! Stok saat ini: ${cur} ${item.satuan}, keluar: ${keluar} ${item.satuan}.`
        };
      }
      simulatedStock.set(item.id, cur - keluar + masuk);
    }

    const prodId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();
    const runningStock = new Map<string, number>();
    items.forEach(it => runningStock.set(it.id, it.stok));

    const prodItems: ProductionItem[] = [];
    const outTxItems: TransactionItem[] = [];
    const inTxItems: TransactionItem[] = [];

    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId)!;
      const keluar = Number(req.keluar) || 0;
      const masuk = Number(req.masuk) || 0;
      const stokSebelum = runningStock.get(item.id) ?? item.stok;
      const afterOut = stokSebelum - keluar;
      const stokSesudah = afterOut + masuk;
      runningStock.set(item.id, stokSesudah);

      prodItems.push({
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        satuan: item.satuan,
        lokasi: item.lokasi,
        stokSebelum,
        keluar,
        masuk,
        stokSesudah
      });

      if (keluar > 0) {
        outTxItems.push({
          itemId: item.id,
          kode: item.kode,
          nama: item.nama,
          satuan: item.satuan,
          lokasi: item.lokasi,
          qty: keluar,
          stokSebelum,
          stokSesudah: afterOut
        });
      }

      if (masuk > 0) {
        inTxItems.push({
          itemId: item.id,
          kode: item.kode,
          nama: item.nama,
          satuan: item.satuan,
          lokasi: item.lokasi,
          qty: masuk,
          stokSebelum: afterOut,
          stokSesudah
        });
      }
    }

    const newProduction: ProductionRecord = {
      id: prodId,
      noDokumen: data.noDokumen.trim(),
      tanggal: data.tanggal,
      keterangan: data.keterangan.trim() || '-',
      items: prodItems,
      createdAt: nowIso
    };

    const generatedTxs: StockTransaction[] = [];
    const baseKet = data.keterangan.trim();
    if (outTxItems.length > 0) {
      generatedTxs.push({
        id: `${prodId}_out`,
        type: 'OUT',
        noDokumen: data.noDokumen.trim(),
        tanggal: data.tanggal,
        keterangan: baseKet ? `Produksi (Keluar): ${baseKet}` : 'Produksi (Keluar Bahan)',
        items: outTxItems,
        createdAt: nowIso
      });
    }
    if (inTxItems.length > 0) {
      generatedTxs.push({
        id: `${prodId}_in`,
        type: 'IN',
        noDokumen: data.noDokumen.trim(),
        tanggal: data.tanggal,
        keterangan: baseKet ? `Produksi (Masuk): ${baseKet}` : 'Produksi (Hasil Jadi)',
        items: inTxItems,
        createdAt: nowIso
      });
    }

    setItems(prev => prev.map(item => {
      const updated = runningStock.get(item.id);
      if (updated !== undefined && updated !== item.stok) {
        return {
          ...item,
          stok: updated,
          updatedAt: nowIso
        };
      }
      return item;
    }));

    setProductions(prev => [newProduction, ...prev]);
    if (generatedTxs.length > 0) {
      setTransactions(prev => [...generatedTxs, ...prev]);
    }

    const docMatch = data.noDokumen.match(/PRD-(?:\d{4}-)?(\d+)/i);
    if (docMatch && docMatch[1]) {
      const seqUsed = parseInt(docMatch[1], 10);
      try {
        const prevSeq = parseInt(localStorage.getItem('gudang_repack_prod_seq') || '0', 10);
        if (seqUsed >= prevSeq) {
          localStorage.setItem('gudang_repack_prod_seq', String(seqUsed));
        }
      } catch (e) {}
    }

    return { success: true };
  };

  const updateProduction = (
    prodId: string,
    data: {
      tanggal: string;
      noDokumen: string;
      keterangan: string;
      items: Array<{ itemId: string; keluar: number; masuk: number }>;
    }
  ): { success: boolean; error?: string } => {
    const oldProd = productions.find(p => p.id === prodId);
    if (!oldProd) {
      return { success: false, error: 'Dokumen produksi tidak ditemukan.' };
    }
    if (!data.noDokumen.trim()) {
      return { success: false, error: 'No Dokumen Produksi wajib diisi.' };
    }
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Daftar barang produksi tidak boleh kosong.' };
    }

    // Revert old production's net effect per item
    const oldDeltaByItem = new Map<string, number>();
    oldProd.items.forEach(entry => {
      const net = (Number(entry.masuk) || 0) - (Number(entry.keluar) || 0);
      oldDeltaByItem.set(entry.itemId, (oldDeltaByItem.get(entry.itemId) || 0) + net);
    });

    const baselineStock = new Map<string, number>();
    items.forEach(it => {
      const oldDelta = oldDeltaByItem.get(it.id) || 0;
      baselineStock.set(it.id, it.stok - oldDelta);
    });

    // Validate baseline >= 0 and simulate new rows sequentially
    const simulatedStock = new Map<string, number>(baselineStock);
    for (const [itemId, base] of baselineStock.entries()) {
      if (base < 0) {
        const item = items.find(i => i.id === itemId);
        return {
          success: false,
          error: `Stok "${item?.nama || itemId}" menjadi negatif (${base}) jika transaksi produksi lama dibatalkan.`
        };
      }
    }

    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId);
      if (!item) {
        return { success: false, error: `Barang dengan ID ${req.itemId} tidak ditemukan.` };
      }
      const keluar = Number(req.keluar) || 0;
      const masuk = Number(req.masuk) || 0;
      if (keluar < 0 || masuk < 0) {
        return { success: false, error: `Nilai keluar/masuk untuk "${item.nama}" tidak boleh negatif.` };
      }
      if (keluar === 0 && masuk === 0) {
        return { success: false, error: `Barang "${item.nama}" harus memiliki nilai Keluar atau Masuk lebih dari 0.` };
      }
      const cur = simulatedStock.get(item.id) ?? 0;
      if (cur - keluar < 0) {
        return {
          success: false,
          error: `Stok barang "${item.nama}" tidak mencukupi! Stok tersedia: ${cur} ${item.satuan}, permintaan keluar: ${keluar} ${item.satuan}.`
        };
      }
      simulatedStock.set(item.id, cur - keluar + masuk);
    }

    const nowIso = new Date().toISOString();
    const runningStock = new Map<string, number>(baselineStock);
    const updatedProdItems: ProductionItem[] = [];
    const outTxItems: TransactionItem[] = [];
    const inTxItems: TransactionItem[] = [];

    for (const req of data.items) {
      const item = items.find(i => i.id === req.itemId)!;
      const keluar = Number(req.keluar) || 0;
      const masuk = Number(req.masuk) || 0;
      const stokSebelum = runningStock.get(item.id) ?? item.stok;
      const afterOut = stokSebelum - keluar;
      const stokSesudah = afterOut + masuk;
      runningStock.set(item.id, stokSesudah);

      updatedProdItems.push({
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        satuan: item.satuan,
        lokasi: item.lokasi,
        stokSebelum,
        keluar,
        masuk,
        stokSesudah
      });

      if (keluar > 0) {
        outTxItems.push({
          itemId: item.id,
          kode: item.kode,
          nama: item.nama,
          satuan: item.satuan,
          lokasi: item.lokasi,
          qty: keluar,
          stokSebelum,
          stokSesudah: afterOut
        });
      }

      if (masuk > 0) {
        inTxItems.push({
          itemId: item.id,
          kode: item.kode,
          nama: item.nama,
          satuan: item.satuan,
          lokasi: item.lokasi,
          qty: masuk,
          stokSebelum: afterOut,
          stokSesudah
        });
      }
    }

    const affectedIds = new Set<string>([
      ...Array.from(oldDeltaByItem.keys()),
      ...data.items.map(r => r.itemId)
    ]);

    setItems(prev => prev.map(item => {
      if (affectedIds.has(item.id)) {
        return {
          ...item,
          stok: runningStock.get(item.id) ?? item.stok,
          updatedAt: nowIso
        };
      }
      return item;
    }));

    setProductions(prev => prev.map(p => {
      if (p.id === prodId) {
        return {
          ...p,
          noDokumen: data.noDokumen.trim(),
          tanggal: data.tanggal,
          keterangan: data.keterangan.trim() || '-',
          items: updatedProdItems,
          updatedAt: nowIso
        };
      }
      return p;
    }));

    const baseKet = data.keterangan.trim();
    const replacementTxs: StockTransaction[] = [];
    if (outTxItems.length > 0) {
      replacementTxs.push({
        id: `${prodId}_out`,
        type: 'OUT',
        noDokumen: data.noDokumen.trim(),
        tanggal: data.tanggal,
        keterangan: baseKet ? `Produksi (Keluar): ${baseKet}` : 'Produksi (Keluar Bahan)',
        items: outTxItems,
        createdAt: oldProd.createdAt
      });
    }
    if (inTxItems.length > 0) {
      replacementTxs.push({
        id: `${prodId}_in`,
        type: 'IN',
        noDokumen: data.noDokumen.trim(),
        tanggal: data.tanggal,
        keterangan: baseKet ? `Produksi (Masuk): ${baseKet}` : 'Produksi (Hasil Jadi)',
        items: inTxItems,
        createdAt: oldProd.createdAt
      });
    }

    setTransactions(prev => {
      const filtered = prev.filter(tx => tx.id !== `${prodId}_out` && tx.id !== `${prodId}_in`);
      return [...replacementTxs, ...filtered];
    });

    return { success: true };
  };

  const resetToDefault = () => {
    setItems(INITIAL_ITEMS);
    setTransactions([]);
    setProductions([]);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(INITIAL_ITEMS));
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PRODUCTIONS, JSON.stringify([]));
    localStorage.removeItem('gudang_repack_doc_seq');
    localStorage.removeItem('gudang_repack_prod_seq');
  };

  const clearTransactions = () => {
    setTransactions([]);
    setProductions([]);
    localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PRODUCTIONS, JSON.stringify([]));
    localStorage.removeItem('gudang_repack_doc_seq');
    localStorage.removeItem('gudang_repack_prod_seq');
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
        productions,
        addItem,
        updateItem,
        deleteItem,
        recordTransaction,
        updateTransaction,
        recordProduction,
        updateProduction,
        getNextDocNumber,
        getNextProductionDocNumber,
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
