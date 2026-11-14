export interface Item {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  lokasi: string;
  kategori?: string;
  updatedAt?: string;
}

export type TransactionType = 'IN' | 'OUT';

export interface TransactionItem {
  itemId: string;
  kode: string;
  nama: string;
  satuan: string;
  lokasi: string;
  qty: number;
  stokSebelum: number;
  stokSesudah: number;
}

export interface StockTransaction {
  id: string;
  type: TransactionType;
  noDokumen: string;
  tanggal: string; // ISO format YYYY-MM-DD
  keterangan: string;
  items: TransactionItem[];
  createdAt: string;
}

export interface ProductionItem {
  itemId: string;
  kode: string;
  nama: string;
  satuan: string;
  lokasi: string;
  stokSebelum: number;
  keluar: number;
  masuk: number;
  stokSesudah: number;
}

export interface ProductionRecord {
  id: string;
  noDokumen: string;
  tanggal: string; // ISO format YYYY-MM-DD
  keterangan: string;
  items: ProductionItem[];
  createdAt: string;
  updatedAt?: string;
}

export type AppRoute = 
  | 'dashboard'
  | 'barang-masuk'
  | 'barang-keluar'
  | 'produksi'
  | 'barang-baru'
  | 'kelola-barang'
  | 'riwayat-stok'
  | 'daftar-dokumen'
  | 'kartu-stok'
  | 'backup-restore';
