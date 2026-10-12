import { Item, StockTransaction } from '../types';
import { formatToDDMMYYYY } from '../utils/date';

export interface SpreadsheetFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export const DEFAULT_SPREADSHEET_ID = '1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg/edit';

/**
 * Extracts Google Spreadsheet ID from raw ID or full Google Sheets URL
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return DEFAULT_SPREADSHEET_ID;
  const trimmed = input.trim();
  // Match /d/{spreadsheetId}/
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  // If it's directly the ID without slashes
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Ensure a specific sheet/tab exists in spreadsheet, create if missing
 */
export async function ensureSheetExists(token: string, spreadsheetId: string, sheetTitle: string): Promise<string> {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(err.error?.message || 'Gagal mengakses Google Spreadsheet.');
  }

  const meta = await metaRes.json();
  const sheets = meta.sheets || [];
  const found = sheets.find((s: any) => s.properties?.title === sheetTitle);

  if (!found) {
    // Add sheet via batchUpdate
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: { frozenRowCount: 1 }
              }
            }
          }
        ]
      })
    });

    if (!addRes.ok) {
      console.warn('Gagal menambahkan sheet baru, menggunakan sheet pertama:', sheetTitle);
      return sheets[0]?.properties?.title || 'Sheet1';
    }
  }

  return sheetTitle;
}

/**
 * Create a new Google Spreadsheet in Google Drive formatted for GUDANG REPACK
 */
export async function createWarehouseSpreadsheet(
  token: string,
  title: string,
  items: Item[],
  transactions: StockTransaction[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create spreadsheet resource with two sheets: DATA BARANG and RIWAYAT TRANSAKSI
  const body = {
    properties: {
      title: title || `GUDANG REPACK - Data Stok & Riwayat (${new Date().toISOString().slice(0, 10)})`
    },
    sheets: [
      {
        properties: {
          title: 'DATA BARANG',
          gridProperties: {
            frozenRowCount: 1
          }
        }
      },
      {
        properties: {
          title: 'RIWAYAT TRANSAKSI',
          gridProperties: {
            frozenRowCount: 1
          }
        }
      }
    ]
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'Gagal membuat Google Spreadsheet.');
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = createdData.spreadsheetUrl;

  // 2. Populate DATA BARANG
  const itemsHeader = ['No', 'Kode Barang', 'Nama Barang', 'Satuan', 'Lokasi', 'Stok Saat Ini', 'Status'];
  const itemsRows = items.map((it, idx) => [
    idx + 1,
    it.kode || '-',
    it.nama,
    it.satuan,
    it.lokasi,
    it.stok,
    it.stok === 0 ? 'HABIS' : it.stok <= 5 ? 'MENIPIS' : 'AMAN'
  ]);

  const itemsValues = [itemsHeader, ...itemsRows];

  // 3. Populate RIWAYAT TRANSAKSI
  const txHeader = ['No', 'Tanggal', 'No Dokumen', 'Tipe', 'Kode Barang', 'Nama Barang', 'Satuan', 'Qty Mutasi', 'Keterangan'];
  const txRows: any[][] = [];
  let txIdx = 1;

  transactions.forEach(tx => {
    tx.items.forEach(it => {
      txRows.push([
        txIdx++,
        formatToDDMMYYYY(tx.tanggal),
        tx.noDokumen,
        tx.type === 'IN' ? 'BARANG MASUK' : 'BARANG KELUAR',
        it.kode || '-',
        it.nama,
        it.satuan,
        it.qty,
        tx.keterangan || '-'
      ]);
    });
  });

  const txValues = [txHeader, ...txRows];

  // Batch update values to Google Sheets
  const updateData = [
    {
      range: 'DATA BARANG!A1',
      values: itemsValues
    },
    {
      range: 'RIWAYAT TRANSAKSI!A1',
      values: txValues
    }
  ];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updateData
      })
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json();
    console.warn('Gagal mengisi baris awal spreadsheet:', err);
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Sync current stock levels to existing spreadsheet
 */
export async function syncCurrentStockToSpreadsheet(
  token: string,
  spreadsheetId: string,
  items: Item[]
): Promise<void> {
  const targetSheetTitle = await ensureSheetExists(token, spreadsheetId, 'DATA BARANG');
  const itemsHeader = ['No', 'Kode Barang', 'Nama Barang', 'Satuan', 'Lokasi', 'Stok Saat Ini', 'Status'];
  const itemsRows = items.map((it, idx) => [
    idx + 1,
    it.kode || '-',
    it.nama,
    it.satuan,
    it.lokasi,
    it.stok,
    it.stok === 0 ? 'HABIS' : it.stok <= 5 ? 'MENIPIS' : 'AMAN'
  ]);

  const itemsValues = [itemsHeader, ...itemsRows];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetSheetTitle)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${targetSheetTitle}!A1`,
        values: itemsValues
      })
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gagal menyinkronkan stok ke Google Sheets.');
  }
}

/**
 * Append newly recorded transactions to existing Google Sheet
 */
export async function appendTransactionsToSpreadsheet(
  token: string,
  spreadsheetId: string,
  transactions: StockTransaction[]
): Promise<void> {
  if (transactions.length === 0) return;
  const targetSheetTitle = await ensureSheetExists(token, spreadsheetId, 'RIWAYAT TRANSAKSI');

  const txRows: any[][] = [];
  transactions.forEach((tx, idx) => {
    tx.items.forEach(it => {
      txRows.push([
        idx + 1,
        formatToDDMMYYYY(tx.tanggal),
        tx.noDokumen,
        tx.type === 'IN' ? 'BARANG MASUK' : 'BARANG KELUAR',
        it.kode || '-',
        it.nama,
        it.satuan,
        it.qty,
        tx.keterangan || '-'
      ]);
    });
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetSheetTitle)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `${targetSheetTitle}!A1`,
        values: txRows
      })
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gagal menambahkan riwayat ke Google Sheets.');
  }
}

/**
 * List Google Spreadsheets from user's Google Drive
 */
export async function listWarehouseSpreadsheets(token: string): Promise<SpreadsheetFileInfo[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=25&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gagal mengambil daftar spreadsheet dari Google Drive.');
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink,
    modifiedTime: f.modifiedTime
  }));
}

/**
 * Import items from a Google Spreadsheet (looks for DATA BARANG sheet or first sheet)
 */
export async function importItemsFromSpreadsheet(
  token: string,
  spreadsheetId: string
): Promise<Item[]> {
  // First get spreadsheet metadata to find sheet title
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(err.error?.message || 'Gagal membuka spreadsheet.');
  }

  const meta = await metaRes.json();
  const sheets = meta.sheets || [];
  if (sheets.length === 0) {
    throw new Error('Spreadsheet kosong atau tidak memiliki sheet.');
  }

  // Find sheet named 'DATA BARANG' or fallback to first sheet
  const targetSheet = sheets.find((s: any) => s.properties?.title === 'DATA BARANG') || sheets[0];
  const sheetTitle = targetSheet.properties?.title || 'DATA BARANG';

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:Z5000`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!valuesRes.ok) {
    const err = await valuesRes.json();
    throw new Error(err.error?.message || 'Gagal membaca isi data Google Sheets.');
  }

  const data = await valuesRes.json();
  const rows: any[][] = data.values || [];

  if (rows.length <= 1) {
    throw new Error('Spreadsheet tidak memiliki baris data barang.');
  }

  // Header inspection
  const header = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
  let idxKode = header.findIndex(h => h.includes('kode') || h.includes('sku') || h.includes('code'));
  let idxNama = header.findIndex(h => h.includes('nama') || h.includes('item') || h.includes('produk') || h.includes('barang') || h.includes('deskripsi') || h.includes('name'));
  let idxSatuan = header.findIndex(h => h.includes('satuan') || h.includes('unit') || h.includes('uom'));
  let idxLokasi = header.findIndex(h => h.includes('lokasi') || h.includes('gudang') || h.includes('location') || h.includes('rak'));
  let idxStok = header.findIndex(h => h.includes('stok') || h.includes('stock') || h.includes('qty') || h.includes('jumlah') || h.includes('saldo'));

  // Default fallback if headers weren't named standardly
  if (idxNama === -1 && rows[0].length >= 2) {
    idxKode = 0;
    idxNama = 1;
    idxSatuan = rows[0].length > 2 ? 2 : -1;
    idxLokasi = rows[0].length > 3 ? 3 : -1;
    idxStok = rows[0].length > 4 ? 4 : -1;
  }

  const parsedItems: Item[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const kode = idxKode >= 0 && row[idxKode] ? String(row[idxKode]).trim() : '';
    const nama = idxNama >= 0 && row[idxNama] ? String(row[idxNama]).trim() : '';
    const satuan = idxSatuan >= 0 && row[idxSatuan] ? String(row[idxSatuan]).trim() : 'PCS';
    const lokasi = idxLokasi >= 0 && row[idxLokasi] ? String(row[idxLokasi]).trim() : 'Stok Gdg PKL';
    const stokRaw = idxStok >= 0 && row[idxStok] ? row[idxStok] : 0;
    const stok = typeof stokRaw === 'number' ? stokRaw : parseFloat(String(stokRaw).replace(/,/g, '.')) || 0;

    if (!nama && !kode) continue;

    parsedItems.push({
      id: `imported_gs_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
      kode: kode || `KODE-${i}`,
      nama: nama || `Barang ${i}`,
      satuan: satuan || 'PCS',
      lokasi: lokasi || 'Stok Gdg PKL',
      stok: Math.max(0, stok)
    });
  }

  if (parsedItems.length === 0) {
    throw new Error('Tidak ada data barang yang valid ditemukan di Google Sheets.');
  }

  return parsedItems;
}
