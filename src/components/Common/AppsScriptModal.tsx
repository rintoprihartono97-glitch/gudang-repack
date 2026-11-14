import React, { useState } from 'react';
import { X, Copy, Check, FileCode, ExternalLink, BookOpen, Download, Sparkles } from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'codegs' | 'indexhtml' | 'panduan'>('codegs');
  const [copiedCodeGs, setCopiedCodeGs] = useState(false);
  const [copiedIndexHtml, setCopiedIndexHtml] = useState(false);
  const [fetchedCodeGs, setFetchedCodeGs] = useState<string>('');
  const [fetchedIndexHtml, setFetchedIndexHtml] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      fetch('/gas/Code.gs')
        .then(res => res.text())
        .then(text => setFetchedCodeGs(text))
        .catch(err => console.error(err));

      fetch('/gas/Index.html')
        .then(res => res.text())
        .then(text => setFetchedIndexHtml(text))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const codeGsContent = `/**
 * ==========================================================================
 * SISTEM GUDANG REPACK - BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ==========================================================================
 * Terhubung otomatis ke Google Spreadsheet.
 * Menggunakan teknik Batch Read & Batch Write untuk kecepatan maksimal (ANTI DELAY).
 * ==========================================================================
 */

var SPREADSHEET_ID = "1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg";
var SHEET_BARANG = "DATA BARANG";
var SHEET_RIWAYAT = "RIWAYAT TRANSAKSI";

function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  throw new Error("Spreadsheet tidak ditemukan.");
}

function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  try {
    var initialData = getInitialDataDirect();
    template.initialDataJson = JSON.stringify(initialData);
  } catch (err) {
    template.initialDataJson = JSON.stringify({
      items: getSampleItems(),
      transactions: [],
      nextDocNumber: "RPK-2026-000001",
      error: err.toString()
    });
  }

  return template.evaluate()
    .setTitle("Gudang Repack - Sistem Manajemen Stok")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialDataDirect() {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);

  var items = getItemsFromSheet(ss);
  var transactions = getTransactionsFromSheet(ss);
  var nextDoc = generateNextDocNumber(transactions);

  return {
    items: items,
    transactions: transactions,
    nextDocNumber: nextDoc
  };
}

function apiGetInitialData() {
  return getInitialDataDirect();
}

function ensureSheetsSetup(ss) {
  var sheetBarang = ss.getSheetByName(SHEET_BARANG);
  if (!sheetBarang) {
    sheetBarang = ss.insertSheet(SHEET_BARANG);
    var headersBarang = [
      ["No", "Kode Barang", "Nama Barang", "Satuan", "Lokasi", "Stok Saat Ini", "Status"]
    ];
    sheetBarang.getRange(1, 1, 1, headersBarang[0].length).setValues(headersBarang);
    sheetBarang.getRange("A1:G1").setBackground("#065f46").setFontColor("#ffffff").setFontWeight("bold");
    sheetBarang.setFrozenRows(1);
  }

  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);
  if (!sheetRiwayat) {
    sheetRiwayat = ss.insertSheet(SHEET_RIWAYAT);
    var headersRiwayat = [
      ["No", "Tanggal", "No Document", "Keterangan", "Masuk", "Keluar", "Stok Sebelum", "Stok Saat Ini", "Kode Barang", "Nama Barang", "Satuan", "Tipe"]
    ];
    sheetRiwayat.getRange(1, 1, 1, headersRiwayat[0].length).setValues(headersRiwayat);
    sheetRiwayat.getRange("A1:L1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    sheetRiwayat.setFrozenRows(1);
  }
}

function getItemsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_BARANG);
  if (!sheet) return getSampleItems();

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var items = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var kode = String(row[1] || "").trim();
    var nama = String(row[2] || "").trim();
    if (!nama) continue;

    var stok = parseFloat(row[5]) || 0;
    items.push({
      id: "item_" + (i + 1) + "_" + (kode || "it"),
      kode: kode || "-",
      nama: nama,
      satuan: String(row[3] || "Pcs").trim(),
      lokasi: String(row[4] || "Gudang").trim(),
      stok: stok,
      status: stok === 0 ? "HABIS" : (stok <= 5 ? "MENIPIS" : "AMAN")
    });
  }

  return items;
}

function getTransactionsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_RIWAYAT);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var txMap = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var tgl = row[1];
    var noDoc = String(row[2] || "").trim();
    var ket = String(row[3] || "").trim();
    var masuk = parseFloat(row[4]) || 0;
    var keluar = parseFloat(row[5]) || 0;
    var stokSebelum = parseFloat(row[6]) || 0;
    var stokSesudah = parseFloat(row[7]) || 0;
    var kode = String(row[8] || "").trim();
    var nama = String(row[9] || "").trim();
    var satuan = String(row[10] || "").trim();
    var tipe = String(row[11] || "").trim();

    var dateStr = "";
    if (tgl instanceof Date) {
      dateStr = Utilities.formatDate(tgl, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
    } else {
      dateStr = String(tgl || "");
    }

    var isMasuk = masuk > 0 || tipe === "IN" || tipe === "BARANG MASUK";
    var txKey = noDoc || ("tx_" + i);

    if (!txMap[txKey]) {
      txMap[txKey] = {
        id: txKey,
        type: isMasuk ? "IN" : "OUT",
        noDokumen: noDoc || "RPK-2026-000001",
        tanggal: dateStr,
        keterangan: ket,
        createdAt: dateStr,
        items: []
      };
      result.push(txMap[txKey]);
    }

    txMap[txKey].items.push({
      itemId: "it_" + kode,
      kode: kode,
      nama: nama,
      satuan: satuan,
      lokasi: "",
      qty: isMasuk ? masuk : keluar,
      stokSebelum: stokSebelum,
      stokSesudah: stokSesudah
    });
  }

  return result.reverse();
}

function generateNextDocNumber(transactions) {
  var year = new Date().getFullYear();
  var maxSeq = 0;

  if (transactions && transactions.length > 0) {
    for (var i = 0; i < transactions.length; i++) {
      var doc = transactions[i].noDokumen || "";
      var match = doc.match(/RPK-(?:\\d{4}-)?(\\d+)/i);
      if (match && match[1]) {
        var seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  var nextSeq = maxSeq + 1;
  var padded = ("000000" + nextSeq).slice(-6);
  return "RPK-" + year + "-" + padded;
}

function saveTransactionBatch(payload) {
  try {
    var ss = getSpreadsheet();
    ensureSheetsSetup(ss);

    var sheetBarang = ss.getSheetByName(SHEET_BARANG);
    var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);

    var type = payload.type;
    var noDokumen = payload.noDokumen;
    var tanggal = payload.tanggal;
    var keterangan = payload.keterangan || "-";
    var items = payload.items || [];

    if (items.length === 0) {
      return { success: false, message: "Tidak ada barang." };
    }

    var lastRowBarang = sheetBarang.getLastRow();
    var barangRows = lastRowBarang > 1 ? sheetBarang.getRange(2, 1, lastRowBarang - 1, 7).getValues() : [];

    var rowIdxMap = {};
    for (var b = 0; b < barangRows.length; b++) {
      var k = String(barangRows[b][1] || "").trim().toUpperCase();
      var n = String(barangRows[b][2] || "").trim().toUpperCase();
      if (k) rowIdxMap["KODE:" + k] = b;
      if (n) rowIdxMap["NAMA:" + n] = b;
    }

    var historyRowsToAdd = [];
    var currentRiwayatCount = Math.max(0, sheetRiwayat.getLastRow() - 1);

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var qty = parseFloat(item.qty) || 0;
      if (qty <= 0) continue;

      var searchKeyKode = "KODE:" + String(item.kode || "").trim().toUpperCase();
      var searchKeyNama = "NAMA:" + String(item.nama || "").trim().toUpperCase();

      var foundIdx = -1;
      if (rowIdxMap[searchKeyKode] !== undefined) {
        foundIdx = rowIdxMap[searchKeyKode];
      } else if (rowIdxMap[searchKeyNama] !== undefined) {
        foundIdx = rowIdxMap[searchKeyNama];
      }

      var stokSebelum = 0;
      var stokSesudah = 0;

      if (foundIdx >= 0) {
        stokSebelum = parseFloat(barangRows[foundIdx][5]) || 0;
        stokSesudah = type === "IN" ? (stokSebelum + qty) : Math.max(0, stokSebelum - qty);
        barangRows[foundIdx][5] = stokSesudah;
        barangRows[foundIdx][6] = stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN");
      } else {
        stokSebelum = 0;
        stokSesudah = type === "IN" ? qty : 0;
        var newRow = [
          barangRows.length + 1,
          item.kode || ("RPK-" + ("000" + (barangRows.length + 1)).slice(-3)),
          item.nama,
          item.satuan || "Pcs",
          item.lokasi || "Gudang Repack",
          stokSesudah,
          stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN")
        ];
        barangRows.push(newRow);
        foundIdx = barangRows.length - 1;
        rowIdxMap["KODE:" + String(newRow[1]).toUpperCase()] = foundIdx;
        rowIdxMap["NAMA:" + String(newRow[2]).toUpperCase()] = foundIdx;
      }

      var masukVal = type === "IN" ? qty : 0;
      var keluarVal = type === "OUT" ? qty : 0;

      currentRiwayatCount++;
      historyRowsToAdd.push([
        currentRiwayatCount,
        tanggal,
        noDokumen,
        keterangan,
        masukVal > 0 ? masukVal : "",
        keluarVal > 0 ? keluarVal : "",
        stokSebelum,
        stokSesudah,
        item.kode || "-",
        item.nama,
        item.satuan || "Pcs",
        type === "IN" ? "BARANG MASUK" : "BARANG KELUAR"
      ]);
    }

    if (barangRows.length > 0) {
      sheetBarang.getRange(2, 1, barangRows.length, 7).setValues(barangRows);
    }

    if (historyRowsToAdd.length > 0) {
      var nextRow = sheetRiwayat.getLastRow() + 1;
      sheetRiwayat.getRange(nextRow, 1, historyRowsToAdd.length, 12).setValues(historyRowsToAdd);
    }

    return {
      success: true,
      message: "Transaksi " + noDokumen + " berhasil disimpan!"
    };
  } catch (err) {
    return {
      success: false,
      message: "Gagal menyimpan: " + err.toString()
    };
  }
}

function saveMasterItem(item) {
  try {
    var ss = getSpreadsheet();
    ensureSheetsSetup(ss);
    var sheet = ss.getSheetByName(SHEET_BARANG);
    var lastRow = sheet.getLastRow();
    var rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 7).getValues() : [];

    var existingIdx = -1;
    var targetKode = String(item.kode || "").trim().toUpperCase();
    var targetNama = String(item.nama || "").trim().toUpperCase();

    for (var i = 0; i < rows.length; i++) {
      var rowKode = String(rows[i][1] || "").trim().toUpperCase();
      var rowNama = String(rows[i][2] || "").trim().toUpperCase();
      if ((targetKode && rowKode === targetKode) || (rowNama === targetNama)) {
        existingIdx = i;
        break;
      }
    }

    var stok = parseFloat(item.stok) || 0;
    var status = stok === 0 ? "HABIS" : (stok <= 5 ? "MENIPIS" : "AMAN");

    if (existingIdx >= 0) {
      rows[existingIdx][1] = item.kode || rows[existingIdx][1];
      rows[existingIdx][2] = item.nama || rows[existingIdx][2];
      rows[existingIdx][3] = item.satuan || rows[existingIdx][3];
      rows[existingIdx][4] = item.lokasi || rows[existingIdx][4];
      rows[existingIdx][5] = stok;
      rows[existingIdx][6] = status;
      sheet.getRange(existingIdx + 2, 1, 1, 7).setValues([[
        rows[existingIdx][0], rows[existingIdx][1], rows[existingIdx][2], rows[existingIdx][3], rows[existingIdx][4], rows[existingIdx][5], rows[existingIdx][6]
      ]]);
    } else {
      var newNo = rows.length + 1;
      var newKode = item.kode || ("RPK-" + ("000" + newNo).slice(-3));
      sheet.appendRow([newNo, newKode, item.nama, item.satuan, item.lokasi, stok, status]);
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function getSampleItems() {
  return [];
}`;

  const copyToClipboard = async (text: string, type: 'codegs' | 'indexhtml') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'codegs') {
        setCopiedCodeGs(true);
        setTimeout(() => setCopiedCodeGs(false), 2500);
      } else {
        setCopiedIndexHtml(true);
        setTimeout(() => setCopiedIndexHtml(false), 2500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between border-b border-emerald-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-xl border border-emerald-600">
              <FileCode className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base flex items-center gap-2">
                Versi Google Apps Script (Web App)
                <span className="text-[10px] bg-emerald-600 px-2 py-0.5 rounded-full font-mono uppercase">Anti-Delay</span>
              </div>
              <div className="text-xs text-emerald-200">
                Tersambung langsung ke Google Spreadsheet tanpa delay!
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-gray-200 px-5 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={() => setActiveTab('codegs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'codegs' 
                  ? 'bg-emerald-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              1. Code.gs
            </button>
            <button
              onClick={() => setActiveTab('indexhtml')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'indexhtml' 
                  ? 'bg-emerald-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              2. Index.html
            </button>
            <button
              onClick={() => setActiveTab('panduan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'panduan' 
                  ? 'bg-emerald-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              3. Panduan Pasang (Langkah-langkah)
            </button>
          </div>

          <a 
            href="https://docs.google.com/spreadsheets/d/1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg/edit" 
            target="_blank" 
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            <span>Buka Spreadsheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-gray-700">
          
          {/* TAB 1: Code.gs */}
          {activeTab === 'codegs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <div>
                  <div className="font-bold text-emerald-900">Backend Server (Code.gs)</div>
                  <div className="text-[11px] text-emerald-700">
                    Otomatis membaca &amp; menulis ke sheet <b>DATA BARANG</b>, <b>RIWAYAT TRANSAKSI</b>, dan <b>RIWAYAT PRODUKSI</b> menggunakan batch operations (anti freeze/delay), termasuk fitur edit dokumen &amp; produksi.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(fetchedCodeGs || codeGsContent, 'codegs')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
                  >
                    {copiedCodeGs ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeGs ? 'Tersalin!' : 'Salin Code.gs'}</span>
                  </button>
                  <button
                    onClick={() => handleDownloadFile('Code.gs', fetchedCodeGs || codeGsContent)}
                    title="Unduh file Code.gs"
                    className="p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-[460px] border border-slate-800 leading-relaxed">
                  {fetchedCodeGs || codeGsContent}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Index.html */}
          {activeTab === 'indexhtml' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <div>
                  <div className="font-bold text-emerald-900">Frontend Web App (Index.html)</div>
                  <div className="text-[11px] text-emerald-700">
                    File antarmuka lengkap: Dashboard, Input Masuk, Input Keluar, Menu Produksi, Daftar Document (klik untuk detail &amp; edit), Riwayat Stok, Kartu Stok, Master Barang, auto no document <code>RPK-2026-000001</code> &amp; <code>PRD-2026-000001</code>.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const text = fetchedIndexHtml || await (await fetch('/gas/Index.html')).text();
                        copyToClipboard(text, 'indexhtml');
                      } catch (e) {
                        console.error('Gagal fetch Index.html:', e);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
                  >
                    {copiedIndexHtml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndexHtml ? 'Tersalin!' : 'Salin Index.html'}</span>
                  </button>
                  <button
                    onClick={async () => {
                      const text = fetchedIndexHtml || await (await fetch('/gas/Index.html')).text();
                      handleDownloadFile('Index.html', text);
                    }}
                    title="Unduh file Index.html"
                    className="p-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-gray-200 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Fitur-Fitur Index.html Siap Pakai:
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs">
                  <li><b>Zero Latency Load:</b> Data awal disuntikkan langsung oleh <code>doGet</code> ke dalam template HTML tanpa spinner tunggu.</li>
                  <li><b>Optimistic Save:</b> Saat klik Simpan, nomor dokumen langsung bertambah, stok lokal terupdate instan, dan background sync mengirimkan ke Google Sheet di latar belakang.</li>
                  <li><b>Menu Produksi (Kemas Ulang):</b> Input barang keluar &amp; hasil jadi dalam satu dokumen <code>PRD-YYYY-000001</code>, tabel daftar dokumen produksi, jendela detail &amp; tombol Edit, serta ekspor Excel.</li>
                  <li><b>Daftar Document &amp; Edit Transaksi:</b> Klik baris dokumen untuk membuka jendela hasil input dan melakukan revisi/edit transaksi beserta penyesuaian stok otomatis.</li>
                  <li><b>Keterangan Dropdown:</b> Input Keluar (Untuk Toko, Repack Ulang, Kiriman Custumer, isi sendiri) &amp; Input Masuk (Repack KSB, Repack PKL, Repack Ulang, isi sendiri).</li>
                  <li><b>Urutan Kolom Riwayat Stok:</b> Tanggal - No Document - Keterangan - Masuk (Hijau) - Keluar (Merah) - Stok Sebelum - Stok Saat Ini.</li>
                </ul>
                <div className="pt-2">
                  <p className="text-gray-500 text-[11px]">
                    *Klik tombol <b>"Salin Index.html"</b> di atas, lalu tempelkan ke file <code>Index.html</code> di editor Google Apps Script. File ini juga telah tersimpan di repositori pada folder <code>gas/Index.html</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Panduan Pasang */}
          {activeTab === 'panduan' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <div className="font-bold text-emerald-900 mb-1">Panduan Praktis Pasang di Google Sheets (4 Langkah):</div>
                <div className="text-emerald-800 text-[11px]">
                  Cukup salin 2 file (Code.gs dan Index.html) ke Google Spreadsheet Anda:
                  <a href="https://docs.google.com/spreadsheets/d/1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg/edit" target="_blank" rel="noreferrer" className="underline font-bold ml-1">
                    Buka Spreadsheet Disini ↗
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs">1</span>
                    Buka Apps Script di Google Sheet
                  </div>
                  <p className="text-gray-600 text-xs">
                    Di Google Spreadsheet Anda, klik menu <b>Ekstensi</b> (Extensions) &rarr; pilih <b>Apps Script</b>. Editor script akan terbuka di tab baru.
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs">2</span>
                    Tempel Kode ke Code.gs
                  </div>
                  <p className="text-gray-600 text-xs">
                    Klik file <code>Code.gs</code> di sebelah kiri, hapus isinya, lalu <b>Salin & Tempel</b> seluruh kode dari Tab <b>Code.gs</b> di modal ini. Tekan Simpan (Ctrl+S).
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs">3</span>
                    Buat File Index.html
                  </div>
                  <p className="text-gray-600 text-xs">
                    Klik tombol <b>+ (Tambah File)</b> &rarr; pilih <b>HTML</b> &rarr; beri nama <code>Index</code>. Hapus isinya lalu <b>Salin & Tempel</b> dari Tab <b>Index.html</b>. Tekan Simpan (Ctrl+S).
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs">4</span>
                    Terapkan (Deploy) Sebagai Web App
                  </div>
                  <p className="text-gray-600 text-xs">
                    Klik tombol biru <b>Terapkan</b> (Deploy) &rarr; <b>Penerapan baru</b> &rarr; pilih jenis <b>Aplikasi Web</b>. Atur Jalankan sebagai: <i>Saya</i>, Akses: <i>Siapa saja</i> &rarr; klik Terapkan. Salin URL aplikasi web yang didapatkan!
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-xs">
                <b>Catatan Kecepatan (Anti-Delay):</b> Saat Anda membuka Web App hasil deploy tersebut, data barang dan stok akan langsung muncul seketika tanpa perlu menunggu loading lama, karena data awal disajikan bersamaan saat HTML dimuat.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Target Spreadsheet: <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800">1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
