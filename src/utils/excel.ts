import * as XLSX from 'xlsx';
import { Item, StockTransaction } from '../types';

export function exportItemsToExcel(items: Item[], filename = 'Data_Barang_Gudang_Repack.xlsx') {
  const data = items.map((item, idx) => ({
    'No': idx + 1,
    'Kode Barang': item.kode,
    'Nama Barang': item.nama,
    'Satuan': item.satuan,
    'Stok Saat Ini': item.stok,
    'Lokasi': item.lokasi,
    'Status': item.stok === 0 ? 'KOSONG' : item.stok < 10 ? 'MENIPIS' : 'AMAN'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Barang');
  XLSX.writeFile(workbook, filename);
}

export function exportTransactionsToExcel(transactions: StockTransaction[], filename = 'Riwayat_Stok_Gudang_Repack.xlsx') {
  const flattened: any[] = [];
  let no = 1;

  transactions.forEach((tx) => {
    tx.items.forEach((it) => {
      // Tanggal format dd-mm-yyyy
      const [year, month, day] = tx.tanggal.split('-');
      const formattedDate = `${day}-${month}-${year}`;

      flattened.push({
        'No': no++,
        'Tanggal': formattedDate,
        'No Dokumen': tx.noDokumen,
        'Jenis': tx.type === 'IN' ? 'BARANG MASUK' : 'BARANG KELUAR',
        'Kode Barang': it.kode,
        'Nama Barang': it.nama,
        'Satuan': it.satuan,
        'Lokasi': it.lokasi,
        'Qty': it.qty,
        'Stok Sebelum': it.stokSebelum,
        'Stok Sesudah': it.stokSesudah,
        'Keterangan': tx.keterangan || '-'
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(flattened);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Transaksi');
  XLSX.writeFile(workbook, filename);
}

export function exportKartuStokToExcel(
  item: Item,
  entries: Array<{
    tanggal: string;
    noDokumen: string;
    keterangan: string;
    masuk: number;
    keluar: number;
    stokSebelum?: number;
    stokSaatIni?: number;
    sisa?: number;
    jenis?: string;
  }>,
  filename?: string
) {
  const fname = filename || `Kartu_Stok_${item.kode || 'Item'}_${item.nama.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

  const metaData = [
    { 'KARTU STOK GUDANG REPACK': '' },
    { 'Kode Barang': item.kode, 'Nama Barang': item.nama },
    { 'Satuan': item.satuan, 'Lokasi': item.lokasi, 'Stok Terkini': item.stok },
    {}
  ];

  const tableData = entries.map((e, idx) => ({
    'No': idx + 1,
    'Tanggal (dd-mm-yyyy)': e.tanggal,
    'No Document': e.noDokumen,
    'Keterangan': e.keterangan || '-',
    'Masuk': e.masuk || 0,
    'Keluar': e.keluar || 0,
    'Stok Sebelum': e.stokSebelum !== undefined ? e.stokSebelum : '-',
    'Stok Saat Ini': e.stokSaatIni !== undefined ? e.stokSaatIni : (e.sisa ?? item.stok)
  }));

  const worksheet = XLSX.utils.json_to_sheet(tableData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kartu Stok');
  XLSX.writeFile(workbook, fname);
}

export function exportFullBackupExcel(items: Item[], transactions: StockTransaction[], filename = 'BACKUP_GUDANG_REPACK.xlsx') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Barang
  const itemsData = items.map((item, idx) => ({
    'ID': item.id,
    'No': idx + 1,
    'Kode': item.kode,
    'Nama Barang': item.nama,
    'Satuan': item.satuan,
    'Stok': item.stok,
    'Lokasi': item.lokasi
  }));
  const wsItems = XLSX.utils.json_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Data Barang');

  // Sheet 2: Transaksi
  const txData: any[] = [];
  transactions.forEach((tx) => {
    tx.items.forEach((it) => {
      txData.push({
        'ID Transaksi': tx.id,
        'Tanggal (YYYY-MM-DD)': tx.tanggal,
        'No Dokumen': tx.noDokumen,
        'Jenis': tx.type,
        'Item ID': it.itemId,
        'Kode': it.kode,
        'Nama': it.nama,
        'Satuan': it.satuan,
        'Lokasi': it.lokasi,
        'Qty': it.qty,
        'Stok Sebelum': it.stokSebelum,
        'Stok Sesudah': it.stokSesudah,
        'Keterangan': tx.keterangan,
        'Timestamp': tx.createdAt
      });
    });
  });
  const wsTx = XLSX.utils.json_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, wsTx, 'Riwayat Transaksi');

  XLSX.writeFile(wb, filename);
}

export async function parseExcelBackup(file: File): Promise<{ items?: Item[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Look for sheet named "Data Barang" or first sheet
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('barang')) || wb.SheetNames[0];
    if (!sheetName) {
      return { error: 'Format Excel tidak valid: Lembar kerja kosong.' };
    }

    const rawRows = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName]);
    if (!rawRows || rawRows.length === 0) {
      return { error: 'Lembar kerja barang tidak berisi data baris.' };
    }

    const items: Item[] = rawRows.map((row, idx) => {
      const kode = String(row['Kode'] || row['Kode Barang'] || row['kode'] || '').trim();
      const nama = String(row['Nama Barang'] || row['nama'] || row['Nama'] || 'Barang ' + idx).trim();
      const satuan = String(row['Satuan'] || row['satuan'] || 'PCS').trim();
      const lokasi = String(row['Lokasi'] || row['lokasi'] || 'Gudang Utama').trim();
      
      let rawStok = row['Stok'] ?? row['Stok Saat Ini'] ?? row['stok'] ?? 0;
      if (typeof rawStok === 'string') {
        rawStok = parseFloat(rawStok.replace(',', '.')) || 0;
      }

      const id = row['ID'] || `imported_${kode || 'item'}_${lokasi.replace(/\s+/g, '_')}_${idx}`;

      return {
        id: String(id),
        kode,
        nama,
        satuan,
        stok: Number(rawStok) || 0,
        lokasi
      };
    });

    return { items };
  } catch (err: any) {
    return { error: err.message || 'Gagal membaca file Excel.' };
  }
}
