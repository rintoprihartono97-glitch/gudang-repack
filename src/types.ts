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

export type AppRoute = 
  | 'dashboard'
  | 'barang-masuk'
  | 'barang-keluar'
  | 'barang-baru'
  | 'kelola-barang'
  | 'riwayat-stok'
  | 'kartu-stok'
  | 'backup-restore';
