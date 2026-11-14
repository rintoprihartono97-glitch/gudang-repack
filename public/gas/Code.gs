/**
 * ==========================================================================
 * SISTEM GUDANG REPACK - BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ==========================================================================
 * Terhubung langsung ke Google Spreadsheet secara otomatis.
 * Menggunakan teknik Batch Read & Batch Write untuk kecepatan maksimal (ANTI DELAY).
 * ==========================================================================
 */

var SPREADSHEET_ID = "1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg";
var SHEET_BARANG = "DATA BARANG";
var SHEET_RIWAYAT = "RIWAYAT TRANSAKSI";
var SHEET_PRODUKSI = "RIWAYAT PRODUKSI";

function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  throw new Error("Spreadsheet tidak ditemukan. Pastikan script ini dibuat di Google Spreadsheet atau isi SPREADSHEET_ID.");
}

function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  try {
    var initialData = getInitialDataDirect();
    template.initialDataJson = JSON.stringify(initialData);
  } catch (err) {
    template.initialDataJson = JSON.stringify({
      items: getInitialCatalogItems(),
      transactions: [],
      productions: [],
      nextDocNumber: "RPK-" + new Date().getFullYear() + "-000001",
      nextProdDocNumber: "PRD-" + new Date().getFullYear() + "-000001",
      error: err.toString()
    });
  }
  return template.evaluate()
    .setTitle("Gudang Repack - Sistem Manajemen Pergudangan & Stok")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialDataDirect() {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var items = getItemsFromSheet(ss);
  var transactions = getTransactionsFromSheet(ss);
  var productions = getProductionsFromSheet(ss);
  var nextDoc = generateNextDocNumber(transactions);
  var nextProdDoc = generateNextProdDocNumber(productions);
  return {
    items: items,
    transactions: transactions,
    productions: productions,
    nextDocNumber: nextDoc,
    nextProdDocNumber: nextProdDoc
  };
}

function apiGetInitialData() {
  return getInitialDataDirect();
}

function formatSheetDate(tgl) {
  if (tgl instanceof Date) {
    try {
      return Utilities.formatDate(tgl, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
    } catch (e) {
      var y = tgl.getFullYear();
      var m = String(tgl.getMonth() + 1);
      if (m.length < 2) m = "0" + m;
      var d = String(tgl.getDate());
      if (d.length < 2) d = "0" + d;
      return y + "-" + m + "-" + d;
    }
  }
  return String(tgl || "").trim();
}

function padSixDigits(n) {
  var s = String(n);
  while (s.length < 6) s = "0" + s;
  return s;
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

    // Masukkan data barang katalog asli gudang
    var catalogRows = getInitialCatalogRaw();
    if (catalogRows && catalogRows.length > 0) {
      sheetBarang.getRange(2, 1, catalogRows.length, catalogRows[0].length).setValues(catalogRows);
    }
  } else {
    if (sheetBarang.getLastRow() <= 1) {
      var catalogRows = getInitialCatalogRaw();
      if (catalogRows && catalogRows.length > 0) {
        sheetBarang.getRange(2, 1, catalogRows.length, catalogRows[0].length).setValues(catalogRows);
      }
    }
  }

  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);
  if (!sheetRiwayat) {
    sheetRiwayat = ss.insertSheet(SHEET_RIWAYAT);
    var headersRiwayat = [
      ["No", "Tanggal", "No Document", "Keterangan", "Masuk", "Keluar", "Stok Sebelum", "Stok Saat Ini", "Kode Barang", "Nama Barang", "Satuan", "Lokasi", "Tipe"]
    ];
    sheetRiwayat.getRange(1, 1, 1, headersRiwayat[0].length).setValues(headersRiwayat);
    sheetRiwayat.getRange("A1:M1").setBackground("#064e3b").setFontColor("#ffffff").setFontWeight("bold");
    sheetRiwayat.setFrozenRows(1);
  }

  var sheetProduksi = ss.getSheetByName(SHEET_PRODUKSI);
  if (!sheetProduksi) {
    sheetProduksi = ss.insertSheet(SHEET_PRODUKSI);
    var headersProduksi = [
      ["No", "Tanggal", "No Document", "Keterangan", "Kode Barang", "Nama Barang", "Satuan", "Lokasi", "Stok Terkini", "Keluar", "Masuk", "Stok Akhir", "Prod ID"]
    ];
    sheetProduksi.getRange(1, 1, 1, headersProduksi[0].length).setValues(headersProduksi);
    sheetProduksi.getRange("A1:M1").setBackground("#065f46").setFontColor("#ffffff").setFontWeight("bold");
    sheetProduksi.setFrozenRows(1);
  }
}

function getItemsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_BARANG);
  if (!sheet) return getInitialCatalogItems();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return getInitialCatalogItems();

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
  return items.length > 0 ? items : getInitialCatalogItems();
}

function getTransactionsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_RIWAYAT);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var txMap = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var formattedDate = formatSheetDate(row[1]);
    var noDoc = String(row[2] || "").trim();
    var ket = String(row[3] || "").trim();
    var masuk = parseFloat(row[4]) || 0;
    var keluar = parseFloat(row[5]) || 0;
    var sblm = parseFloat(row[6]) || 0;
    var stlh = parseFloat(row[7]) || 0;
    var kd = String(row[8] || "").trim();
    var nm = String(row[9] || "").trim();
    var st = String(row[10] || "").trim();
    var lk = String(row[11] || "").trim();
    var tp = String(row[12] || (masuk > 0 ? "IN" : "OUT")).trim().toUpperCase();
    tp = tp === "IN" ? "IN" : "OUT";

    if (!noDoc) continue;

    var txKey = noDoc + "__" + tp;
    if (!txMap[txKey]) {
      txMap[txKey] = {
        id: "tx_" + txKey,
        type: tp,
        tanggal: formattedDate,
        noDokumen: noDoc,
        keterangan: ket || "-",
        createdAt: formattedDate + "T00:00:00.000Z",
        items: []
      };
      result.push(txMap[txKey]);
    }

    var qtyVal = tp === "IN" ? masuk : keluar;
    txMap[txKey].items.push({
      itemId: "item_" + (kd || nm),
      kode: kd,
      nama: nm,
      satuan: st,
      lokasi: lk,
      qty: qtyVal,
      stokSebelum: sblm,
      stokSesudah: stlh
    });
  }

  return result;
}

function getProductionsFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_PRODUKSI);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var prodMap = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var formattedDate = formatSheetDate(row[1]);
    var noDoc = String(row[2] || "").trim();
    var ket = String(row[3] || "").trim();
    var kd = String(row[4] || "").trim();
    var nm = String(row[5] || "").trim();
    var st = String(row[6] || "").trim();
    var lk = String(row[7] || "").trim();
    var stokTerkini = parseFloat(row[8]) || 0;
    var keluar = parseFloat(row[9]) || 0;
    var masuk = parseFloat(row[10]) || 0;
    var stokAkhir = parseFloat(row[11]) || 0;
    var prodId = String(row[12] || "").trim();

    if (!noDoc) continue;
    var key = prodId || ("prod_" + noDoc);

    if (!prodMap[key]) {
      prodMap[key] = {
        id: key,
        noDokumen: noDoc,
        tanggal: formattedDate,
        keterangan: ket || "-",
        createdAt: formattedDate + "T00:00:00.000Z",
        items: []
      };
      result.push(prodMap[key]);
    }

    prodMap[key].items.push({
      itemId: "item_" + (kd || nm),
      kode: kd,
      nama: nm,
      satuan: st,
      lokasi: lk,
      stokSebelum: stokTerkini,
      keluar: keluar,
      masuk: masuk,
      stokSesudah: stokAkhir
    });
  }

  return result;
}

function generateNextDocNumber(transactions) {
  var yyyy = new Date().getFullYear();
  var maxSeq = 0;
  if (transactions && transactions.length > 0) {
    for (var i = 0; i < transactions.length; i++) {
      var doc = transactions[i].noDokumen || "";
      var m = doc.match(/RPK-(?:\d{4}-)?(\d+)/i);
      if (m && m[1]) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
    }
  }
  return "RPK-" + yyyy + "-" + padSixDigits(maxSeq + 1);
}

function generateNextProdDocNumber(productions) {
  var yyyy = new Date().getFullYear();
  var maxSeq = 0;
  if (productions && productions.length > 0) {
    for (var i = 0; i < productions.length; i++) {
      var doc = productions[i].noDokumen || "";
      var m = doc.match(/PRD-(?:\d{4}-)?(\d+)/i);
      if (m && m[1]) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
    }
  }
  return "PRD-" + yyyy + "-" + padSixDigits(maxSeq + 1);
}

function buildBarangIndex(barangValues) {
  var map = {
    byId: {},
    byFull: {},
    byKdNm: {},
    byKd: {},
    byNm: {}
  };
  for (var r = 0; r < barangValues.length; r++) {
    var kdRaw = String(barangValues[r][1] || "").trim();
    var nmRaw = String(barangValues[r][2] || "").trim();
    var stRaw = String(barangValues[r][3] || "").trim();
    var lkRaw = String(barangValues[r][4] || "").trim();

    var rowId = "item_" + (r + 1) + "_" + (kdRaw || "it");
    var kd = kdRaw.toLowerCase();
    var nm = nmRaw.toLowerCase();
    var st = stRaw.toLowerCase();
    var lk = lkRaw.toLowerCase();

    map.byId[rowId] = r;
    if (kd && nm && map.byFull[kd + "|" + nm + "|" + st + "|" + lk] === undefined) {
      map.byFull[kd + "|" + nm + "|" + st + "|" + lk] = r;
    }
    if (kd && nm && map.byKdNm[kd + "|" + nm] === undefined) {
      map.byKdNm[kd + "|" + nm] = r;
    }
    if (kd && map.byKd[kd] === undefined) map.byKd[kd] = r;
    if (nm && map.byNm[nm] === undefined) map.byNm[nm] = r;
  }
  return map;
}

function findBarangRowIndex(itemMap, entry) {
  var id = String(entry.itemId || "").trim();
  var kd = String(entry.kode || "").trim().toLowerCase();
  var nm = String(entry.nama || "").trim().toLowerCase();
  var st = String(entry.satuan || "").trim().toLowerCase();
  var lk = String(entry.lokasi || "").trim().toLowerCase();

  if (id && itemMap.byId[id] !== undefined) return itemMap.byId[id];
  if (kd && nm && itemMap.byFull[kd + "|" + nm + "|" + st + "|" + lk] !== undefined) {
    return itemMap.byFull[kd + "|" + nm + "|" + st + "|" + lk];
  }
  if (kd && nm && itemMap.byKdNm[kd + "|" + nm] !== undefined) {
    return itemMap.byKdNm[kd + "|" + nm];
  }
  if (kd && kd !== "-" && itemMap.byKd[kd] !== undefined) return itemMap.byKd[kd];
  if (nm && itemMap.byNm[nm] !== undefined) return itemMap.byNm[nm];
  return -1;
}

function writeRiwayatAllRows(sheetRiwayat, allRows) {
  var oldLastRow = sheetRiwayat.getLastRow();
  for (var i = 0; i < allRows.length; i++) {
    allRows[i][0] = i + 1;
  }
  if (allRows.length > 0) {
    sheetRiwayat.getRange(2, 1, allRows.length, 13).setValues(allRows);
  }
  var extraRows = oldLastRow - (allRows.length + 1);
  if (extraRows > 0) {
    sheetRiwayat.getRange(allRows.length + 2, 1, extraRows, 13).clearContent();
  }
}

function writeProduksiAllRows(sheetProduksi, allRows) {
  var oldLastRow = sheetProduksi.getLastRow();
  for (var i = 0; i < allRows.length; i++) {
    allRows[i][0] = i + 1;
  }
  if (allRows.length > 0) {
    sheetProduksi.getRange(2, 1, allRows.length, 13).setValues(allRows);
  }
  var extraRows = oldLastRow - (allRows.length + 1);
  if (extraRows > 0) {
    sheetProduksi.getRange(allRows.length + 2, 1, extraRows, 13).clearContent();
  }
}

function apiRecordTransaction(payload) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheetBarang = ss.getSheetByName(SHEET_BARANG);
  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);

  var lastRowBarang = sheetBarang.getLastRow();
  if (lastRowBarang <= 1) {
    throw new Error("Data master barang kosong di spreadsheet.");
  }

  var barangRange = sheetBarang.getRange(2, 1, lastRowBarang - 1, 7);
  var barangValues = barangRange.getValues();
  var itemMap = buildBarangIndex(barangValues);

  var newHistoryRows = [];
  var nextHistoryNo = sheetRiwayat.getLastRow();
  var txType = payload.type === "IN" ? "IN" : "OUT";
  var tanggal = payload.tanggal || formatSheetDate(new Date());
  var noDokumen = String(payload.noDokumen || "").trim();
  var keterangan = String(payload.keterangan || "-").trim() || "-";

  for (var i = 0; i < payload.items.length; i++) {
    var entry = payload.items[i];
    var rowIndex = findBarangRowIndex(itemMap, entry);

    if (rowIndex === -1) {
      throw new Error("Barang tidak ditemukan di katalog: " + (entry.nama || entry.kode));
    }

    var currentStok = parseFloat(barangValues[rowIndex][5]) || 0;
    var delta = parseFloat(entry.qty) || 0;
    if (delta <= 0) continue;

    var stokSebelum = currentStok;
    var stokSesudah = currentStok;
    var masukQty = 0;
    var keluarQty = 0;

    if (txType === "IN") {
      masukQty = delta;
      stokSesudah = currentStok + delta;
    } else {
      keluarQty = delta;
      if (currentStok < delta) {
        throw new Error("Stok tidak mencukupi untuk " + barangValues[rowIndex][2] + ". Stok: " + currentStok + ", Permintaan: " + delta);
      }
      stokSesudah = currentStok - delta;
    }

    barangValues[rowIndex][5] = stokSesudah;
    barangValues[rowIndex][6] = stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN");

    newHistoryRows.push([
      nextHistoryNo++,
      tanggal,
      noDokumen,
      keterangan,
      masukQty,
      keluarQty,
      stokSebelum,
      stokSesudah,
      barangValues[rowIndex][1],
      barangValues[rowIndex][2],
      barangValues[rowIndex][3],
      barangValues[rowIndex][4],
      txType
    ]);
  }

  barangRange.setValues(barangValues);

  if (newHistoryRows.length > 0) {
    var insertStart = sheetRiwayat.getLastRow() + 1;
    sheetRiwayat.getRange(insertStart, 1, newHistoryRows.length, newHistoryRows[0].length).setValues(newHistoryRows);
  }

  return getInitialDataDirect();
}

function apiUpdateTransaction(payload) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheetBarang = ss.getSheetByName(SHEET_BARANG);
  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);

  var lastRowBarang = sheetBarang.getLastRow();
  if (lastRowBarang <= 1) {
    throw new Error("Data master barang kosong di spreadsheet.");
  }

  var barangRange = sheetBarang.getRange(2, 1, lastRowBarang - 1, 7);
  var barangValues = barangRange.getValues();
  var itemMap = buildBarangIndex(barangValues);

  var oldNoDoc = String(payload.oldNoDokumen || payload.noDokumen || "").trim();
  var oldType = String(payload.oldType || payload.type || "IN").trim().toUpperCase();
  var newType = payload.type === "IN" ? "IN" : "OUT";
  var tanggal = payload.tanggal || formatSheetDate(new Date());
  var noDokumen = String(payload.noDokumen || "").trim();
  var keterangan = String(payload.keterangan || "-").trim() || "-";

  if (!noDokumen) throw new Error("No Document wajib diisi.");
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Daftar barang tidak boleh kosong.");
  }

  var lastRowRiwayat = sheetRiwayat.getLastRow();
  var riwayatValues = lastRowRiwayat > 1 ? sheetRiwayat.getRange(2, 1, lastRowRiwayat - 1, 13).getValues() : [];

  var remainingRiwayatRows = [];
  var oldDeltaByRow = {};

  for (var i = 0; i < riwayatValues.length; i++) {
    var r = riwayatValues[i];
    var rDoc = String(r[2] || "").trim();
    var rMasuk = parseFloat(r[4]) || 0;
    var rKeluar = parseFloat(r[5]) || 0;
    var rTp = String(r[12] || (rMasuk > 0 ? "IN" : "OUT")).trim().toUpperCase();
    rTp = rTp === "IN" ? "IN" : "OUT";

    if (rDoc === oldNoDoc && rTp === oldType) {
      var idx = findBarangRowIndex(itemMap, {
        kode: r[8],
        nama: r[9],
        satuan: r[10],
        lokasi: r[11]
      });
      if (idx !== -1) {
        var eff = rTp === "IN" ? rMasuk : -rKeluar;
        oldDeltaByRow[idx] = (oldDeltaByRow[idx] || 0) + eff;
      }
    } else {
      remainingRiwayatRows.push(r);
    }
  }

  var runningStock = {};
  for (var rIdx = 0; rIdx < barangValues.length; rIdx++) {
    var cur = parseFloat(barangValues[rIdx][5]) || 0;
    var oldEff = oldDeltaByRow[rIdx] || 0;
    runningStock[rIdx] = cur - oldEff;
  }

  var newHistoryRows = [];
  for (var j = 0; j < payload.items.length; j++) {
    var entry = payload.items[j];
    var rowIndex = findBarangRowIndex(itemMap, entry);
    if (rowIndex === -1) {
      throw new Error("Barang tidak ditemukan di katalog: " + (entry.nama || entry.kode));
    }

    var qty = parseFloat(entry.qty) || 0;
    if (qty <= 0) {
      throw new Error("Qty untuk " + barangValues[rowIndex][2] + " harus lebih dari 0.");
    }

    var stokSebelum = runningStock[rowIndex];
    var stokSesudah = newType === "IN" ? (stokSebelum + qty) : (stokSebelum - qty);
    if (stokSesudah < 0) {
      throw new Error("Stok barang \"" + barangValues[rowIndex][2] + "\" tidak mencukupi! Tersedia: " + stokSebelum + ", Permintaan: " + qty);
    }

    runningStock[rowIndex] = stokSesudah;
    barangValues[rowIndex][5] = stokSesudah;
    barangValues[rowIndex][6] = stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN");

    newHistoryRows.push([
      0,
      tanggal,
      noDokumen,
      keterangan,
      newType === "IN" ? qty : 0,
      newType === "OUT" ? qty : 0,
      stokSebelum,
      stokSesudah,
      barangValues[rowIndex][1],
      barangValues[rowIndex][2],
      barangValues[rowIndex][3],
      barangValues[rowIndex][4],
      newType
    ]);
  }

  // Also apply baseline revert for items that were removed from this document
  for (var oldKey in oldDeltaByRow) {
    if (oldDeltaByRow.hasOwnProperty(oldKey)) {
      var kIdx = parseInt(oldKey, 10);
      var finalStok = runningStock[kIdx];
      if (finalStok < 0) {
        throw new Error("Stok barang \"" + barangValues[kIdx][2] + "\" menjadi negatif setelah revisi.");
      }
      barangValues[kIdx][5] = finalStok;
      barangValues[kIdx][6] = finalStok === 0 ? "HABIS" : (finalStok <= 5 ? "MENIPIS" : "AMAN");
    }
  }

  barangRange.setValues(barangValues);
  writeRiwayatAllRows(sheetRiwayat, remainingRiwayatRows.concat(newHistoryRows));

  return getInitialDataDirect();
}

function apiRecordProduction(payload) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheetBarang = ss.getSheetByName(SHEET_BARANG);
  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);
  var sheetProduksi = ss.getSheetByName(SHEET_PRODUKSI);

  var lastRowBarang = sheetBarang.getLastRow();
  if (lastRowBarang <= 1) {
    throw new Error("Data master barang kosong di spreadsheet.");
  }

  var barangRange = sheetBarang.getRange(2, 1, lastRowBarang - 1, 7);
  var barangValues = barangRange.getValues();
  var itemMap = buildBarangIndex(barangValues);

  var tanggal = payload.tanggal || formatSheetDate(new Date());
  var noDokumen = String(payload.noDokumen || "").trim();
  var keteranganRaw = String(payload.keterangan || "").trim();
  var keterangan = keteranganRaw || "-";
  var prodId = String(payload.prodId || ("prod_" + new Date().getTime())).trim();
  var items = payload.items || [];

  if (!noDokumen) throw new Error("No Document Produksi wajib diisi.");
  if (items.length === 0) throw new Error("Daftar barang produksi tidak boleh kosong.");

  var runningStock = {};
  for (var r = 0; r < barangValues.length; r++) {
    runningStock[r] = parseFloat(barangValues[r][5]) || 0;
  }

  var newProdRows = [];
  var newRiwayatRows = [];
  var nextProdNo = sheetProduksi.getLastRow();
  var nextRiwayatNo = sheetRiwayat.getLastRow();

  for (var i = 0; i < items.length; i++) {
    var entry = items[i];
    var rowIndex = findBarangRowIndex(itemMap, entry);
    if (rowIndex === -1) {
      throw new Error("Barang tidak ditemukan di katalog: " + (entry.nama || entry.kode));
    }

    var keluar = parseFloat(entry.keluar) || 0;
    var masuk = parseFloat(entry.masuk) || 0;
    if (keluar < 0 || masuk < 0) {
      throw new Error("Nilai keluar/masuk untuk " + barangValues[rowIndex][2] + " tidak boleh negatif.");
    }
    if (keluar === 0 && masuk === 0) {
      throw new Error("Isi nilai Keluar atau Masuk lebih dari 0 untuk " + barangValues[rowIndex][2]);
    }

    var stokSebelum = runningStock[rowIndex];
    var afterOut = stokSebelum - keluar;
    if (afterOut < 0) {
      throw new Error("Stok barang \"" + barangValues[rowIndex][2] + "\" tidak mencukupi untuk produksi keluar! Stok: " + stokSebelum + ", Keluar: " + keluar);
    }
    var stokSesudah = afterOut + masuk;
    runningStock[rowIndex] = stokSesudah;

    barangValues[rowIndex][5] = stokSesudah;
    barangValues[rowIndex][6] = stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN");

    newProdRows.push([
      nextProdNo++,
      tanggal,
      noDokumen,
      keterangan,
      barangValues[rowIndex][1],
      barangValues[rowIndex][2],
      barangValues[rowIndex][3],
      barangValues[rowIndex][4],
      stokSebelum,
      keluar,
      masuk,
      stokSesudah,
      prodId
    ]);

    if (keluar > 0) {
      newRiwayatRows.push([
        nextRiwayatNo++,
        tanggal,
        noDokumen,
        keteranganRaw ? ("Produksi (Keluar): " + keteranganRaw) : "Produksi (Keluar Bahan)",
        0,
        keluar,
        stokSebelum,
        afterOut,
        barangValues[rowIndex][1],
        barangValues[rowIndex][2],
        barangValues[rowIndex][3],
        barangValues[rowIndex][4],
        "OUT"
      ]);
    }

    if (masuk > 0) {
      newRiwayatRows.push([
        nextRiwayatNo++,
        tanggal,
        noDokumen,
        keteranganRaw ? ("Produksi (Masuk): " + keteranganRaw) : "Produksi (Hasil Jadi)",
        masuk,
        0,
        afterOut,
        stokSesudah,
        barangValues[rowIndex][1],
        barangValues[rowIndex][2],
        barangValues[rowIndex][3],
        barangValues[rowIndex][4],
        "IN"
      ]);
    }
  }

  barangRange.setValues(barangValues);

  if (newProdRows.length > 0) {
    var startProd = sheetProduksi.getLastRow() + 1;
    sheetProduksi.getRange(startProd, 1, newProdRows.length, 13).setValues(newProdRows);
  }
  if (newRiwayatRows.length > 0) {
    var startRiw = sheetRiwayat.getLastRow() + 1;
    sheetRiwayat.getRange(startRiw, 1, newRiwayatRows.length, 13).setValues(newRiwayatRows);
  }

  return getInitialDataDirect();
}

function apiUpdateProduction(payload) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheetBarang = ss.getSheetByName(SHEET_BARANG);
  var sheetRiwayat = ss.getSheetByName(SHEET_RIWAYAT);
  var sheetProduksi = ss.getSheetByName(SHEET_PRODUKSI);

  var lastRowBarang = sheetBarang.getLastRow();
  if (lastRowBarang <= 1) {
    throw new Error("Data master barang kosong di spreadsheet.");
  }

  var barangRange = sheetBarang.getRange(2, 1, lastRowBarang - 1, 7);
  var barangValues = barangRange.getValues();
  var itemMap = buildBarangIndex(barangValues);

  var prodId = String(payload.prodId || "").trim();
  var oldNoDoc = String(payload.oldNoDokumen || payload.noDokumen || "").trim();
  var tanggal = payload.tanggal || formatSheetDate(new Date());
  var noDokumen = String(payload.noDokumen || "").trim();
  var keteranganRaw = String(payload.keterangan || "").trim();
  var keterangan = keteranganRaw || "-";
  var items = payload.items || [];

  if (!noDokumen) throw new Error("No Document Produksi wajib diisi.");
  if (items.length === 0) throw new Error("Daftar barang produksi tidak boleh kosong.");

  var lastRowProd = sheetProduksi.getLastRow();
  var prodValues = lastRowProd > 1 ? sheetProduksi.getRange(2, 1, lastRowProd - 1, 13).getValues() : [];
  var remainingProdRows = [];
  var oldDeltaByRow = {};

  for (var i = 0; i < prodValues.length; i++) {
    var p = prodValues[i];
    var pDoc = String(p[2] || "").trim();
    var pId = String(p[12] || "").trim();
    var isTarget = (prodId && pId === prodId) || (oldNoDoc && pDoc === oldNoDoc);

    if (isTarget) {
      var idx = findBarangRowIndex(itemMap, {
        kode: p[4],
        nama: p[5],
        satuan: p[6],
        lokasi: p[7]
      });
      if (idx !== -1) {
        var oldKeluar = parseFloat(p[9]) || 0;
        var oldMasuk = parseFloat(p[10]) || 0;
        oldDeltaByRow[idx] = (oldDeltaByRow[idx] || 0) + (oldMasuk - oldKeluar);
      }
    } else {
      remainingProdRows.push(p);
    }
  }

  var runningStock = {};
  for (var r = 0; r < barangValues.length; r++) {
    var cur = parseFloat(barangValues[r][5]) || 0;
    var oldNet = oldDeltaByRow[r] || 0;
    runningStock[r] = cur - oldNet;
    if (runningStock[r] < 0) {
      throw new Error("Stok barang \"" + barangValues[r][2] + "\" menjadi negatif (" + runningStock[r] + ") jika transaksi produksi lama dibatalkan.");
    }
  }

  var newProdRows = [];
  var newRiwayatRows = [];
  var finalProdId = prodId || ("prod_" + new Date().getTime());

  for (var j = 0; j < items.length; j++) {
    var entry = items[j];
    var rowIndex = findBarangRowIndex(itemMap, entry);
    if (rowIndex === -1) {
      throw new Error("Barang tidak ditemukan di katalog: " + (entry.nama || entry.kode));
    }

    var keluar = parseFloat(entry.keluar) || 0;
    var masuk = parseFloat(entry.masuk) || 0;
    if (keluar < 0 || masuk < 0) {
      throw new Error("Nilai keluar/masuk untuk " + barangValues[rowIndex][2] + " tidak boleh negatif.");
    }
    if (keluar === 0 && masuk === 0) {
      throw new Error("Isi nilai Keluar atau Masuk lebih dari 0 untuk " + barangValues[rowIndex][2]);
    }

    var stokSebelum = runningStock[rowIndex];
    var afterOut = stokSebelum - keluar;
    if (afterOut < 0) {
      throw new Error("Stok barang \"" + barangValues[rowIndex][2] + "\" tidak mencukupi! Tersedia: " + stokSebelum + ", Permintaan keluar: " + keluar);
    }
    var stokSesudah = afterOut + masuk;
    runningStock[rowIndex] = stokSesudah;

    barangValues[rowIndex][5] = stokSesudah;
    barangValues[rowIndex][6] = stokSesudah === 0 ? "HABIS" : (stokSesudah <= 5 ? "MENIPIS" : "AMAN");

    newProdRows.push([
      0,
      tanggal,
      noDokumen,
      keterangan,
      barangValues[rowIndex][1],
      barangValues[rowIndex][2],
      barangValues[rowIndex][3],
      barangValues[rowIndex][4],
      stokSebelum,
      keluar,
      masuk,
      stokSesudah,
      finalProdId
    ]);

    if (keluar > 0) {
      newRiwayatRows.push([
        0,
        tanggal,
        noDokumen,
        keteranganRaw ? ("Produksi (Keluar): " + keteranganRaw) : "Produksi (Keluar Bahan)",
        0,
        keluar,
        stokSebelum,
        afterOut,
        barangValues[rowIndex][1],
        barangValues[rowIndex][2],
        barangValues[rowIndex][3],
        barangValues[rowIndex][4],
        "OUT"
      ]);
    }

    if (masuk > 0) {
      newRiwayatRows.push([
        0,
        tanggal,
        noDokumen,
        keteranganRaw ? ("Produksi (Masuk): " + keteranganRaw) : "Produksi (Hasil Jadi)",
        masuk,
        0,
        afterOut,
        stokSesudah,
        barangValues[rowIndex][1],
        barangValues[rowIndex][2],
        barangValues[rowIndex][3],
        barangValues[rowIndex][4],
        "IN"
      ]);
    }
  }

  for (var oldKey in oldDeltaByRow) {
    if (oldDeltaByRow.hasOwnProperty(oldKey)) {
      var kIdx = parseInt(oldKey, 10);
      var finalStok = runningStock[kIdx];
      barangValues[kIdx][5] = finalStok;
      barangValues[kIdx][6] = finalStok === 0 ? "HABIS" : (finalStok <= 5 ? "MENIPIS" : "AMAN");
    }
  }

  // Filter out old synced production rows in RIWAYAT TRANSAKSI
  var lastRowRiwayat = sheetRiwayat.getLastRow();
  var riwayatValues = lastRowRiwayat > 1 ? sheetRiwayat.getRange(2, 1, lastRowRiwayat - 1, 13).getValues() : [];
  var remainingRiwayatRows = [];
  for (var k = 0; k < riwayatValues.length; k++) {
    var rw = riwayatValues[k];
    var rwDoc = String(rw[2] || "").trim();
    var rwKet = String(rw[3] || "").trim();
    if (rwDoc === oldNoDoc && rwKet.indexOf("Produksi (") === 0) {
      continue;
    }
    remainingRiwayatRows.push(rw);
  }

  barangRange.setValues(barangValues);
  writeProduksiAllRows(sheetProduksi, remainingProdRows.concat(newProdRows));
  writeRiwayatAllRows(sheetRiwayat, remainingRiwayatRows.concat(newRiwayatRows));

  return getInitialDataDirect();
}

function apiAddItem(item) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheet = ss.getSheetByName(SHEET_BARANG);
  var lastRow = sheet.getLastRow();
  var no = lastRow;
  var stok = parseFloat(item.stok) || 0;
  var status = stok === 0 ? "HABIS" : (stok <= 5 ? "MENIPIS" : "AMAN");
  sheet.appendRow([no, item.kode || "-", item.nama, item.satuan || "Pcs", item.lokasi || "Gudang", stok, status]);
  return getInitialDataDirect();
}

function apiUpdateItem(item) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheet = ss.getSheetByName(SHEET_BARANG);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("Data barang kosong.");
  var range = sheet.getRange(2, 1, lastRow - 1, 7);
  var values = range.getValues();
  var updated = false;
  for (var i = 0; i < values.length; i++) {
    var kd = String(values[i][1] || "").trim();
    var nm = String(values[i][2] || "").trim();
    var rowId = "item_" + (i + 1) + "_" + (kd || "it");
    if ((item.id && rowId === item.id) || (item.kode && kd === item.kode && nm.toLowerCase() === item.nama.toLowerCase()) || nm.toLowerCase() === item.nama.toLowerCase()) {
      values[i][1] = item.kode || values[i][1];
      values[i][2] = item.nama || values[i][2];
      values[i][3] = item.satuan || values[i][3];
      values[i][4] = item.lokasi || values[i][4];
      var st = parseFloat(item.stok);
      if (!isNaN(st)) {
        values[i][5] = st;
        values[i][6] = st === 0 ? "HABIS" : (st <= 5 ? "MENIPIS" : "AMAN");
      }
      updated = true;
      break;
    }
  }
  if (updated) {
    range.setValues(values);
  }
  return getInitialDataDirect();
}

function apiDeleteItem(itemIdentifier) {
  var ss = getSpreadsheet();
  ensureSheetsSetup(ss);
  var sheet = ss.getSheetByName(SHEET_BARANG);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return getInitialDataDirect();
  var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < values.length; i++) {
    var kd = String(values[i][1] || "").trim();
    var nm = String(values[i][2] || "").trim();
    if (kd === itemIdentifier || nm === itemIdentifier || ("item_" + (i + 1) + "_" + (kd || "it")) === itemIdentifier) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
  return getInitialDataDirect();
}

function getInitialCatalogRaw() {
  return [[1,"0200161","AMONIA KUE RRC 1KG CRH","KG","Stok Gdg PKL",0,"HABIS"],[2,"02001611","AMONIA KUE RRC 500GR CRH","PCS","Stok Gdg PKL",49,"AMAN"],[3,"1500463","ATHENA BAKING POWDER 10KG","BAG","Stok Gdg PKL",2,"MENIPIS"],[4,"01089412","ATHENA BAKING POWDER 250GR CRH","PCS","Stok Gdg PKL",77,"AMAN"],[5,"01089411","ATHENA BAKING POWDER CRH 500GR","PCS","Stok Gdg PKL",19,"AMAN"],[6,"0902692","BAKERS` PRIDE BUTTER CRM 250GR","PCS","Stok Gdg PKL",0,"HABIS"],[7,"01024242","BENDICO CO PWD ND 250GR CRH","PCS","Stok Gdg PKL",42,"AMAN"],[8,"01078133","BENDICO CO PWD XD 100GR CRH","PCS","Stok Gdg PKL",53,"AMAN"],[9,"01078132","BENDICO CO PWD XD 250GR CRH","PCS","Stok Gdg PKL",20,"AMAN"],[10,"01078131","BENDICO CO PWD XD 500GR CRH","PCS","Stok Gdg PKL",11,"AMAN"],[11,"01078134","BENDICO CO PWD XD 50GR CRH","PCS","Stok Gdg PKL",99,"AMAN"],[12,"01082523","BENDICO CO PWD XXD 100GR CRH","PCS","Stok Gdg PKL",62,"AMAN"],[13,"01082522","BENDICO CO PWD XXD 250GR CRH","PCS","Stok Gdg PKL",48,"AMAN"],[14,"01082521","BENDICO CO PWD XXD 500GR CRH","PCS","Stok Gdg PKL",12,"AMAN"],[15,"01082524","BENDICO CO PWD XXD 50GR CRH","PCS","Stok Gdg PKL",124,"AMAN"],[16,"01009042","BLUE BAND MARGARINE 250GR CRH","PCS","Stok Gdg PKL",119,"AMAN"],[17,"02003962","CALCIUM NIACET 250GR CRH","PCS","Stok Gdg PKL",103,"AMAN"],[18,"02003961","CALCIUM NIACET 500GR CRH","PCS","Stok Gdg PKL",52,"AMAN"],[19,"0200102","CMC 1KG CRH","PCS","Stok Gdg PKL",51,"AMAN"],[20,"02001021","CMC 500GR CRH","PCS","Stok Gdg PKL",51,"AMAN"],[21,"01006331","COCOA POWDER PW 500GR CRH","PCS","Stok Gdg PKL",50,"AMAN"],[22,"0901662","COLATTA CHIPS CMP 250GR CRH","PCS","Stok Gdg PKL",20,"AMAN"],[23,"01047271","COLATTA CHOCO FILLING 500GR CRH","PCS","Stok Gdg PKL",40,"AMAN"],[24,"0903622","COLATTA GLAZE DARK 250GR CRH","PCS","Stok Gdg PKL",80,"AMAN"],[25,"0903652","COLATTA GLAZE TIRAMISU 250GR CRH","PCS","Stok Gdg PKL",80,"AMAN"],[26,"0903632","COLATTA GLAZE WHITE 250GR CRH","PCS","Stok Gdg PKL",80,"AMAN"],[27,"0903241","COLATTA MINI CHIP 500GR CRH","PCS","Stok Gdg PKL",20,"AMAN"],[28,"01070411","D`CORE CHOCO FILLING 500GR CRH","PCS","Stok Gdg PKL",40,"AMAN"],[29,"01027501","FILMA GOOD FRY (M PADAT) 500GR CRH","PCS","Stok Gdg PKL",0,"HABIS"],[30,"01077722","FILMA PUFF PASTRY 250GR CRH","PCS","Stok Gdg PKL",97,"AMAN"],[31,"00221/2KG","GOLD BULLION 500GR GRAND BUTTER BLEND","PCS","Stok Gdg PKL",60,"AMAN"],[32,"0105075","GOLD BULLION BOS 1KG CRH","PCS","Stok Gdg PKL",120,"AMAN"],[33,"01050751","GOLD BULLION BOS 500GR CRH","PCS","Stok Gdg PKL",0,"HABIS"],[34,"090323","GOLD BULLION MERRY WHIP","KG","Stok Gdg PKL",0,"HABIS"],[35,"03001031","GULA PASIR","1/2kg","Stok Gdg PKL",100,"AMAN"],[36,"03001082","GUNUNG AGUNG TAPIOKA 250GR CRH","PCS","Stok Gdg PKL",102,"AMAN"],[37,"03001081","GUNUNG AGUNG TAPIOKA CRH 500GR","PCS","Stok Gdg PKL",102,"AMAN"],[38,"0300111","HAAN DONUT DUSTING 1KG CRH","PCS","Stok Gdg PKL",91,"AMAN"],[39,"03001112","HAAN DONUT DUSTING 250GR CRH","PCS","Stok Gdg PKL",81,"AMAN"],[40,"03001111","HAAN DONUT DUSTING 500GR CRH","PCS","Stok Gdg PKL",61,"AMAN"],[41,"0300154","HAAN PALM SUGAR 1KG CRH","PCS","Stok Gdg PKL",55,"AMAN"],[42,"03001541","HAAN PALM SUGAR 500GR CRH","PCS","Stok Gdg PKL",41,"AMAN"],[43,"03001542","HAAN PALM SUGAR CRH 250GR","PCS","Stok Gdg PKL",308,"AMAN"],[44,"00091KG","HOLLMAN BUTTER CURAH","KG","Stok Gdg PKL",0,"HABIS"],[45,"0300015","HUNKWEE 1KG CRH","PCS","Stok Gdg PKL",50,"AMAN"],[46,"03000152","HUNKWEE 250GR CRH","PCS","Stok Gdg PKL",198,"AMAN"],[47,"0901622","L`AGIE RAINBOW CHIPS 250GR CRH","PCS","Stok Gdg PKL",146,"AMAN"],[48,"0901621","L`AGIE RAINBOW CHIPS 500GR CRH","PCS","Stok Gdg PKL",72,"AMAN"],[49,"01039781","MAJESTY NASTAR NANAS 500GR CRH","PCS","Stok Gdg PKL",49,"AMAN"],[50,"00141/2KG","MENARA BAKER`S FAT CLASSIC CURAH","1/2kg","Stok Gdg PKL",30,"AMAN"],[51,"01088881","MENARA MARGARIN KRIM 500GR CRH","PCS","Stok Gdg PKL",30,"AMAN"],[52,"01094840","MESES SIERRA COKLAT 12.5KG","CTN","Stok Gdg PKL",1,"MENIPIS"],[53,"0109917","MESES SIERRA COKLAT PREMIUM 1KG","PCS","Stok Gdg PKL",37,"AMAN"],[54,"0110226","MESES SIERRA P L COKLAT 12.5KG","CTN","Stok Gdg PKL",1,"MENIPIS"],[55,"01094832","MESES SIERRA WARNA 250GR","PCS","Stok Gdg PKL",4,"MENIPIS"],[56,"01094832","MESES SIERRA WARNA 250GR","PCS","Stok Gdg PKL",48,"AMAN"],[57,"01094822","MESES SIERRA WARNA T C 250GR","PCS","Stok Gdg PKL",102,"AMAN"],[58,"01094821","MESES SIERRA WARNA T C 500GR","PCS","Stok Gdg PKL",26,"AMAN"],[59,"0100157","MESES SPUTNIK 1KG CRH","PCS","Stok Gdg PKL",0,"HABIS"],[60,"01001571","MESES SPUTNIK 500GR CRH","PCS","Stok Gdg PKL",50,"AMAN"],[61,"0017KG","MOREMADE SAFFIRE BUTTER BLEND","KG","Stok Gdg PKL",16,"AMAN"],[62,"0100543","OPAQUE WHITE 1KG CRH","PCS","Stok Gdg PKL",25,"AMAN"],[63,"01023211","OPAQUE WHITE USP 500GR CRH","PCS","Stok Gdg PKL",51,"AMAN"],[64,"03004122","PAK TANI G TAPIOKA 250GR CRH","PCS","Stok Gdg PKL",100,"AMAN"],[65,"03004121","PAK TANI G TAPIOKA CRH 500GR","PCS","Stok Gdg PKL",100,"AMAN"],[66,"090148","PALETTA EXCE BLUEBERRY 1KG CRH","PCS","Stok Gdg PKL",25,"AMAN"],[67,"0901482","PALETTA EXCE BLUEBERRY 250GR CRH","PCS","Stok Gdg PKL",98,"AMAN"],[68,"0107532","PALMBOOM CAKE MARG 1KG CRH","PCS","Stok Gdg PKL",15,"AMAN"],[69,"01075322","PALMBOOM CAKE MARG 250GR CRH","PCS","Stok Gdg PKL",238,"AMAN"],[70,"01075321","PALMBOOM CAKE MARG 500GR CRH","PCS","Stok Gdg PKL",149,"AMAN"],[71,"01013482","PALMIA MARGARINE 250GR CRH","PCS","Stok Gdg PKL",60,"AMAN"],[72,"01009742","PALMIA MENTEGA PTH 250GR CRH","PCS","Stok Gdg PKL",60,"AMAN"],[73,"0106354","PALMVITA B O S 1KG CRH","PCS","Stok Gdg PKL",131,"AMAN"],[74,"01063541","PALMVITA B O S 500GR CRH","PCS","Stok Gdg PKL",90,"AMAN"],[75,"01080042","PALMVITA D FRYING FAT 250GR CRH","PCS","Stok Gdg PKL",63,"AMAN"],[76,"01080041","PALMVITA D FRYING FAT 500GR CRH","PCS","Stok Gdg PKL",30,"AMAN"],[77,"02000952","PENGENYAL MIE 250GR CRH","PCS","Stok Gdg PKL",103,"AMAN"],[78,"02000951","PENGENYAL MIE 500GR CRH","PCS","Stok Gdg PKL",102,"AMAN"],[79,"02001062","POTASIUM SORBATE 250GR CRH","PCS","Stok Gdg PKL",100,"AMAN"],[80,"01101802","PREMIX D25 250GR CRH","PCS","Stok Gdg PKL",103,"AMAN"],[81,"01101801","PREMIX D25 500GR CRH","PCS","Stok Gdg PKL",101,"AMAN"],[82,"0200132","PURON AG 1KG CRH","PCS","Stok Gdg PKL",25,"AMAN"],[83,"0100916","PUSAKA MENTEGA PTH 1KG CRH","PCS","Stok Gdg PKL",0,"HABIS"],[84,"01009161","PUSAKA MENTEGA PTH 500GR CRH","PCS","Stok Gdg PKL",30,"AMAN"],[85,"01050312","ROOMBUTTER RBS 250GR CRH","PCS","Stok Gdg PKL",78,"AMAN"],[86,"01092832","ROSE BRAND MARG 250GR CRH","PCS","Stok Gdg PKL",60,"AMAN"],[87,"02001642","S METABSF/NATRON 250GR CRH","PCS","Stok Gdg PKL",0,"HABIS"],[88,"02001641","S METABSF/NATRON 500GR CRH","PCS","Stok Gdg PKL",0,"HABIS"],[89,"0300043","SAGU TANI CRH 1KG","PCS","Stok Gdg PKL",50,"AMAN"],[90,"03000432","SAGU TANI CRH 250GR","PCS","Stok Gdg PKL",200,"AMAN"],[91,"03000431","SAGU TANI CRH 500GR","PCS","Stok Gdg PKL",101,"AMAN"],[92,"01075613","SERENA BLACK COOKIES CRUMB 100GR CRH","PCS","Stok Gdg PKL",53,"AMAN"],[93,"01075612","SERENA BLACK COOKIES CRUMB 250GR CRH","PCS","Stok Gdg PKL",43,"AMAN"],[94,"01075611","SERENA BLACK COOKIES CRUMB 500GR CRH","PCS","Stok Gdg PKL",21,"AMAN"],[95,"0902982","SIMBA CHOCO CRUNCH 250GR CRH","PCS","Stok Gdg PKL",80,"AMAN"],[96,"0902981","SIMBA CHOCO CRUNCH 500GR CRH","PCS","Stok Gdg PKL",20,"AMAN"],[97,"02004741","SODA ASH FOODGRADE 500GR CRH","PCS","Stok Gdg PKL",82,"AMAN"],[98,"02003831","SODA KUE ASAHI 500GR CRH","PCS","Stok Gdg PKL",0,"HABIS"],[99,"01099861","SODIUM BENZOAT PRILL","1/2kg","Stok Gdg PKL",100,"AMAN"],[100,"01099862","SODIUM BENZOAT PRILL","1/4kg","Stok Gdg PKL",101,"AMAN"],[101,"02000151","SODIUM BENZOAT RRC 500GR","PCS","Stok Gdg PKL",50,"AMAN"],[102,"02001222","SODIUM SUPER 250GR CRH","PCS","Stok Gdg PKL",101,"AMAN"],[103,"02001221","SODIUM SUPER 500GR CRH","PCS","Stok Gdg PKL",51,"AMAN"],[104,"01103122","SP PLAZA 28 250GR CURAH","PCS","Stok Gdg PKL",81,"AMAN"],[105,"01103121","SP PLAZA 28 500GR CURAH","PCS","Stok Gdg PKL",40,"AMAN"],[106,"01006283","TULIP BORDEAUX 100GR CRH","PCS","Stok Gdg PKL",53,"AMAN"],[107,"0100628","TULIP BORDEAUX 1KG CRH","PCS","Stok Gdg PKL",20,"AMAN"],[108,"01006282","TULIP BORDEAUX 250GR CRH","PCS","Stok Gdg PKL",41,"AMAN"],[109,"01006281","TULIP BORDEAUX 500GR CRH","PCS","Stok Gdg PKL",33,"AMAN"],[110,"01006284","TULIP BORDEAUX 50GR CRH","PCS","Stok Gdg PKL",100,"AMAN"],[111,"0106659","TULIP NOIR BLACK 1KG CRH","PCS","Stok Gdg PKL",5,"MENIPIS"],[112,"0106608","TULIP NOIR BLACK 2,5KG","BAG","Stok Gdg PKL",14,"AMAN"],[113,"01066592","TULIP NOIR BLACK 250GR CRH","PCS","Stok Gdg PKL",21,"AMAN"],[114,"01066591","TULIP NOIR BLACK 500GR CRH","PCS","Stok Gdg PKL",10,"AMAN"],[115,"01000022","VANILI LOKAL 250GR CRH","PCS","Stok Gdg PKL",102,"AMAN"],[116,"01000021","VANILI LOKAL 500GR CRH","PCS","Stok Gdg PKL",155,"AMAN"],[117,"011015910","GO CORN FLAKES","1/4kg","Stok Toko (PKL)",0,"HABIS"],[118,"02002982","PENYAKREK 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[119,"02001361","BAKING POWDER 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[120,"02004422","MIWON `L` 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[121,"02004421","MIWON `L` 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[122,"0200442","MIWON `L` 1KG CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[123,"0200440","MIWON `M` 1KG CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[124,"01099682","GARAM HIMALAYAN","1/2kg","Stok Toko (PKL)",0,"HABIS"],[125,"02002172","RnB TEPUNG CRISPY 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[126,"02004402","MIWON `M` 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[127,"090141","CENGKEH","KG","Stok Toko (PKL)",0,"HABIS"],[128,"090620","ELMER CHOCO STONE BSR WARNA","KG","Stok Toko (PKL)",0,"HABIS"],[129,"090514","ELMER CRISPY BALL LEMON","KG","Stok Toko (PKL)",0,"HABIS"],[130,"090272","YUTAKACHI JAHE BUBUK","KG","Stok Toko (PKL)",0,"HABIS"],[131,"0107205","YUTAKACHI KAYU MANIS BBK","KG","Stok Toko (PKL)",0,"HABIS"],[132,"090617","YUTAKACHI LADA HITAM BUTIR","KG","Stok Toko (PKL)",0,"HABIS"],[133,"8990007432329","YUTAKACHI LADA PUTIH BUBUK","KG","Stok Toko (PKL)",0,"HABIS"],[134,"090409","YUTAKACHI PALA BUBUK","KG","Stok Toko (PKL)",0,"HABIS"],[135,"01013432","GOLD BULLION FLAKE PASTRY 250GR","PCS","Stok Toko (PKL)",0,"HABIS"],[136,"01013431","GOLD BULLION FLAKE PASTRY 500GR","PCS","Stok Toko (PKL)",0,"HABIS"],[137,"01009072","PALMBOOM MARGARIN 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[138,"01009071","PALMBOOM MARGARIN 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[139,"01009101","SIMAS MARGARIN (P) 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[140,"01075321","PALMBOOM CAKE MARG 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[141,"0106121","PALMVITA MARGARINE 1KG CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[142,"01075322","PALMBOOM CAKE MARG 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[143,"01061211","PALMVITA MARGARINE 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[144,"01013482","PALMIA MARGARINE 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[145,"01009102","SIMAS MARGARIN (P) 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[146,"0101343","GOLD BULLION FLAKE PASTRY 1KG","PCS","Stok Toko (PKL)",0,"HABIS"],[147,"01016591","GYP CIOKO FOODGRADE","1/2kg","Stok Toko (PKL)",0,"HABIS"],[148,"0200167","BHT","KG","Stok Toko (PKL)",0,"HABIS"],[149,"01024242","BENDICO CO PWD ND 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[150,"01013432","GOLD BULLION FLAKE PASTRY 250GR","PCS","Stok Toko (PKL)",0,"HABIS"],[151,"01001571","MESES SPUTNIK 500GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[152,"01001572","MESES SPUTNIK 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[153,"0200306","RH OREGANO VNT3","KG","Stok Toko (PKL)",0.1,"MENIPIS"],[154,"0110279","LA KREIVA PINEAPPLE CRUMB CURAH","KG","Stok Toko (PKL)",0.5,"MENIPIS"],[155,"02001291","SODA KUE RRC 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[156,"01014562","ALMOND SLICED CRH","1/4kg","Stok Toko (PKL)",1,"MENIPIS"],[157,"01059642","ANCHOR TINNED BUTTER 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[158,"0101556","AROMA RASA 1KG STRAW","PCS","Stok Toko (PKL)",1,"MENIPIS"],[159,"01089412","ATHENA BAKING POWDER 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[160,"090259","BASO SAPI SEAS ESEMA 1KG","KG","Stok Toko (PKL)",1,"MENIPIS"],[161,"01024242","BENDICO CO PWD ND 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[162,"01024241","BENDICO CO PWD ND 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[163,"01078133","BENDICO CO PWD XD 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[164,"01078132","BENDICO CO PWD XD 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[165,"01078131","BENDICO CO PWD XD 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[166,"01007863","BENSDORP COKLAT BBK 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[167,"01007861","BENSDORP COKLAT BBK 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[168,"01082111","BRILL BLUE LIGHT 2129 500GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[169,"0108211","BRILL BLUE LIGHT 2129 PCH 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[170,"0300449","BROWN SUGAR","KG","Stok Toko (PKL)",1,"MENIPIS"],[171,"00031KG","COLATTA COLORED RICE","KG","Stok Toko (PKL)",1,"MENIPIS"],[172,"0906252","COLATTA GLAZE BANANA MILK 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[173,"01039701","COLATTA VERMICELLI SIGN 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[174,"03000203","CREAM OF TARTAR CRH 100GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[175,"01070372","CREAMER 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[176,"0026KG","ELMER CHOCO CHIP COLOURED HR","KG","Stok Toko (PKL)",1,"MENIPIS"],[177,"01066492","FC 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[178,"01066491","FC 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[179,"0101496","FERMIPAN 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[180,"01081551","FILMA MARG TF 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[181,"01077721","FILMA PUFF PASTRY 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[182,"01017672","GOLD BULL MENTEGA PUTIH 250GR SUPER","PCS","Stok Toko (PKL)",1,"MENIPIS"],[183,"02002161","HAAN EMULPLEX 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[184,"01068192","IREKS BROWN B CONCENTRT CURAH","1/4kg","Stok Toko (PKL)",1,"MENIPIS"],[185,"0300036","JAGUNG POP CORN 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[186,"03000362","JAGUNG POP CORN 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[187,"JNT-250","Jinten putih bubuk yuta 250gr","pcs","Stok Toko (PKL)",1,"MENIPIS"],[188,"0300080","KACANG IJO KUPAS","KG","Stok Toko (PKL)",1,"MENIPIS"],[189,"03000352","KETAN HITAM 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[190,"8997004831940","KIS KACANG CINCANG 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[191,"0901622","L`AGIE RAINBOW CHIPS 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[192,"LK-MARIE-250","LA KREIVA MARIE BISC FINE 250GR CRH","pcs","Stok Toko (PKL)",1,"MENIPIS"],[193,"01101442","LA KREIVA MARIE BISC FINE 500GR CRH CRUM","PCS","Stok Toko (PKL)",1,"MENIPIS"],[194,"0200126","MAEZENA 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[195,"01009131","MENARA MARGARIN 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[196,"01030862","MESES OSCAR 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[197,"0109481","MESES SIERRA HIJAU 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[198,"01094812","MESES SIERRA HIJAU 250GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[199,"01094781","MESES SIERRA MERAH MUDA 500GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[200,"0109482","MESES SIERRA WARNA T C 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[201,"01094821","MESES SIERRA WARNA T C 500GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[202,"0100157","MESES SPUTNIK 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[203,"02004401","MIWON `M` 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[204,"0102914","MORIN STRAWBERRY JAM","2Kg","Stok Toko (PKL)",1,"MENIPIS"],[205,"0101422","MOTHER`S CHOICE MARG 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[206,"01014222","MOTHER`S CHOICE MARG 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[207,"OPQ-500","OPAQUE WHITE 500GR CRH","pcs","Stok Toko (PKL)",1,"MENIPIS"],[208,"ORG-RED-1KG","Orange red 1kg","pcs","Stok Toko (PKL)",1,"MENIPIS"],[209,"ORG-RED-500","Orange red 500gr","pcs","Stok Toko (PKL)",1,"MENIPIS"],[210,"01097083","ORCHID BUTTER 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[211,"02002031","OVALET SPC TBM 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[212,"01080042","PALMVITA D FRYING FAT 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[213,"01061212","PALMVITA MARGARINE 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[214,"0110241","PLAZA FILLING PASTE C4 5KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[215,"01101801","PREMIX D25 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[216,"02004772","PRIMERA BREAD CRUMB BLEND 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[217,"02004771","PRIMERA BREAD CRUMB BLEND 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[218,"02004572","PRIMERA BREAD CRUMB PTH 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[219,"02004571","PRIMERA BREAD CRUMB PTH 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[220,"090455","PURATOS CREMFIL VANILLA","KG","Stok Toko (PKL)",1,"MENIPIS"],[221,"0101331","PWN CHERRY RED 1KG","CTN-10","Stok Toko (PKL)",1,"MENIPIS"],[222,"01013391","PWN DARK CHOCOLATE HITAM 500GR 2088","PCS","Stok Toko (PKL)",1,"MENIPIS"],[223,"0101327","PWN EGG YELLOW 2115 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[224,"01012653","PWN ORANGE RED 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[225,"01012652","PWN ORANGE RED 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[226,"0101335","PWN RED SCARLET 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[227,"01013351","PWN RED SCARLET 500GR","PCS","Stok Toko (PKL)",1,"MENIPIS"],[228,"02000281","QUICK 75 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[229,"0200220","RnB PENGEMPUK DAGING 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[230,"02002202","RnB PENGEMPUK DAGING 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[231,"02002201","RnB PENGEMPUK DAGING 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[232,"02002171","RnB TEPUNG CRISPY 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[233,"0300043","SAGU TANI CRH 1KG","PCS","Stok Toko (PKL)",1,"MENIPIS"],[234,"01062662","SASA MSG 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[235,"0108749","SELMA BROWN FLAX SEEDS","1ons","Stok Toko (PKL)",1,"MENIPIS"],[236,"0107035","SKIM POWDER 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[237,"01070352","SKIM POWDER 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[238,"02000161","SODIUM BENZOAT HOLLAND 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[239,"01103111","SP 68 500GR CURAH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[240,"01009401","SP RYOTO 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[241,"0300047","TEPUNG PANIER 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[242,"03004151","TEPUNG UBI COKLAT","1/2kg","Stok Toko (PKL)",1,"MENIPIS"],[243,"03004141","TEPUNG UBI VIOLET","1/2kg","Stok Toko (PKL)",1,"MENIPIS"],[244,"00211/4KG","TFM 08-SP 789 250GR CURAH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[245,"0200279","TIXOSIL 38 ANTI BATU","KG","Stok Toko (PKL)",1,"MENIPIS"],[246,"01006282","TULIP BORDEAUX 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[247,"0101419","TULIP CHOC FILLING 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[248,"01066591","TULIP NOIR BLACK 500GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[249,"01000481","WIJEN","1/2kg","Stok Toko (PKL)",1,"MENIPIS"],[250,"01000482","WIJEN","1/4kg","Stok Toko (PKL)",1,"MENIPIS"],[251,"02003993","WYSMAN BUTTER 100GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[252,"0903742","YUTAKACHI BAY LEAVES","1ons","Stok Toko (PKL)",1,"MENIPIS"],[253,"8990007432329","YUTAKACHI LADA PUTIH BUBUK","1/2kg","Stok Toko (PKL)",1,"MENIPIS"],[254,"090497","YUTAKACHI LADA PUTIH BUTIR","KG","Stok Toko (PKL)",1,"MENIPIS"],[255,"0200477","PRIMERA BREAD CRUMB BLEND 1KG CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[256,"0300449","BROWN SUGAR","KG","Stok Toko (PKL)",1.5,"MENIPIS"],[257,"0018KG","ELMER CHOCO CHIP DARK HR","KG","Stok Toko (PKL)",1.75,"MENIPIS"],[258,"01086552","ACE SULFAME","KG","Stok Toko (PKL)",2,"MENIPIS"],[259,"00081ONS","AMPEC FULL CREAM","ONS","Stok Toko (PKL)",2,"MENIPIS"],[260,"0200236","ANCHOR BAKER`S MIX 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[261,"01082523","BENDICO CO PWD XXD 100GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[262,"8997004831360","CHEFMATE DARK CHOC PASTE","BAG5kg","Stok Toko (PKL)",2,"MENIPIS"],[263,"0901662","COLATTA CHIPS CMP 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[264,"0104727","COLATTA CHOCO FILLING 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[265,"01047271","COLATTA CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[266,"01014102","CORMAN PATISY 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[267,"01070371","CREAMER 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[268,"01070412","D`CORE CHOCO FILLING 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[269,"01070411","D`CORE CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[270,"03001492","DEXTROSE 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[271,"090522","ELMER CRISPY BALL DARK","KG","Stok Toko (PKL)",2,"MENIPIS"],[272,"090513","ELMER CRISPY BALL GRAPE","KG","Stok Toko (PKL)",2,"MENIPIS"],[273,"090524","ELMER CRISPY BALL WHITE","KG","Stok Toko (PKL)",2,"MENIPIS"],[274,"090596","ELMER DIP GLAZE LEMON CRH","KG","Stok Toko (PKL)",2,"MENIPIS"],[275,"01081541","FILMA PRESTIGE MARG 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[276,"0100581","GELATINE","KG","Stok Toko (PKL)",2,"MENIPIS"],[277,"01010231","GLYCINE/PENYEDAP 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[278,"02001131","GMS 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[279,"0106804","JAVA CHOCO FILLING 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[280,"01095563","LA KREIVA BLACK FINE 250GR CRH CRUMBLE","PCS","Stok Toko (PKL)",2,"MENIPIS"],[281,"0107944","MAMON CAKE MIX CURAH 500GR","PCS","Stok Toko (PKL)",2,"MENIPIS"],[282,"01009192","MENARA MENTEGA PTH 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[283,"0109917","MESES SIERRA COKLAT PREMIUM 1KG","PCS","Stok Toko (PKL)",2,"MENIPIS"],[284,"01094782","MESES SIERRA MERAH MUDA 250GR","PCS","Stok Toko (PKL)",2,"MENIPIS"],[285,"090701","MORIN FILLOLES BLUEBERRY","KG","Stok Toko (PKL)",2,"MENIPIS"],[286,"0109815","MORIN NASTAR NANAS","KG","Stok Toko (PKL)",2,"MENIPIS"],[287,"0102915","MORIN PEANUT BUTTER CREAMY","2Kg","Stok Toko (PKL)",2,"MENIPIS"],[288,"01014221","MOTHER`S CHOICE MARG 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[289,"02002062","OVALET 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[290,"0200203","OVALET SPC TBM 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[291,"01098952","POTATO STARCH CURAH","1/4kg","Stok Toko (PKL)",2,"MENIPIS"],[292,"0200475","PRIMERA BREAD CRUMB ORG 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[293,"03004371","PRIMSFOOD ORANGE 500GR DONUT DUSTING","PCS","Stok Toko (PKL)",2,"MENIPIS"],[294,"090527","PURATOS CREMFIL MANGO","KG","Stok Toko (PKL)",2,"MENIPIS"],[295,"01013313","PWN CHERRY RED 100GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[296,"01013393","PWN DARK CHOCOLATE 100GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[297,"01072221","PWN EGG YELLOW 2115 TYPE M 500GR","PCS","Stok Toko (PKL)",2,"MENIPIS"],[298,"01082043","PWN SUNSEA BLACK 3774 100GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[299,"01082041","PWN SUNSEA BLACK 3774 500GR","CTN-10","Stok Toko (PKL)",2,"MENIPIS"],[300,"02003832","SODA KUE ASAHI 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[301,"01009401","SP RYOTO 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[302,"01006281","TULIP BORDEAUX 500GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[303,"0101866","VANILI ETHIL","1/4kg","Stok Toko (PKL)",2,"MENIPIS"],[304,"0105276","WIJEN HITAM 1KG","PCS","Stok Toko (PKL)",2,"MENIPIS"],[305,"01052762","WIJEN HITAM 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[306,"02003992","WYSMAN BUTTER 250GR CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[307,"02004545","YUTAKACHI ROSEMARY","1/2ons","Stok Toko (PKL)",2,"MENIPIS"],[308,"02004545","YUTAKACHI ROSEMARY","10Gr","Stok Toko (PKL)",2,"MENIPIS"],[309,"03004142","TEPUNG UBI VIOLET","1/4kg","Stok Toko (PKL)",2,"MENIPIS"],[310,"0200279","TIXOSIL 38 ANTI BATU","1/2kg","Stok Toko (PKL)",2,"MENIPIS"],[311,"0300103","GULA PASIR","KG","Stok Toko (PKL)",2,"MENIPIS"],[312,"0107971","SP SUPER 40GR","PCS","Stok Toko (PKL)",2,"MENIPIS"],[313,"03001622","JELLY POWDER 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[314,"02002173","RnB TEPUNG CRISPY 100GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[315,"01059641","ANCHOR TINNED BUTTER 500GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[316,"0300099","COCONUT FLAV POWDER 1KG CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[317,"03000201","CREAM OF TARTAR CRH 500GR","PCS","Stok Toko (PKL)",3,"MENIPIS"],[318,"0200147","DOBRIM 30/100 1KG CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[319,"0100170","DONAN 1KG CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[320,"090595","ELMER DIP GLAZE HAZELNUT CRH","KG","Stok Toko (PKL)",3,"MENIPIS"],[321,"01005812","GELATINE","1/4kg","Stok Toko (PKL)",3,"MENIPIS"],[322,"00091KG","HOLLMAN BUTTER CURAH","KG","Stok Toko (PKL)",3,"MENIPIS"],[323,"0901612","L`AGIE CHOCO CHIPS BULAT 250GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[324,"02001262","MAEZENA 250GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[325,"01039781","MAJESTY NASTAR NANAS 500GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[326,"0109478","MESES SIERRA MERAH MUDA 1KG","PCS","Stok Toko (PKL)",3,"MENIPIS"],[327,"01063541","PALMVITA B O S 500GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[328,"01098072","PALMVITA BAKER`S FAT 250GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[329,"01098951","POTATO STARCH CURAH","1/2kg","Stok Toko (PKL)",3,"MENIPIS"],[330,"0109895","POTATO STARCH CURAH","KG","Stok Toko (PKL)",3,"MENIPIS"],[331,"01013231","PWN APPLE GREEN 500GR","PCS","Stok Toko (PKL)",3,"MENIPIS"],[332,"01013271","PWN EGG YELLOW 2115 500GR","PCS","Stok Toko (PKL)",3,"MENIPIS"],[333,"8992628650151","ROYAL PALMIA MARGARIN 200GR","PCS","Stok Toko (PKL)",3,"MENIPIS"],[334,"02004721","SAPP EX THAILAND 500GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[335,"01062661","SASA MSG 500GR CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[336,"01000482","WIJEN","1/4kg","Stok Toko (PKL)",3,"MENIPIS"],[337,"0109055","YUTAKACHI BAWANG PUTIH BBK","ONS","Stok Toko (PKL)",3,"MENIPIS"],[338,"0903742","YUTAKACHI BAY LEAVES","1/2ons","Stok Toko (PKL)",3,"MENIPIS"],[339,"0200383","SODA KUE ASAHI 1KG CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[340,"01086552","ACE SULFAME","1/4kg","Stok Toko (PKL)",4,"MENIPIS"],[341,"01007862","BENSDORP COKLAT BBK 250GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[342,"0300449","BROWN SUGAR","1/4kg","Stok Toko (PKL)",4,"MENIPIS"],[343,"0100170","DONAN 1KG CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[344,"0107832","ELMER CRISPY BALL GRAPE","CUP","Stok Toko (PKL)",4,"MENIPIS"],[345,"0300108","GUNUNG AGUNG TAPIOKA 1KG CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[346,"0300154","HAAN PALM SUGAR 1KG CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[347,"01068041","JAVA CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[348,"0109724","PALMVITA BAKER`S FAT 15KG","CTN","Stok Toko (PKL)",4,"MENIPIS"],[349,"0108004","PALMVITA D FRYING FAT 1KG CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[350,"01013273","PWN EGG YELLOW 2115 100GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[351,"01012532","PWN SARSAPARILA 250GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[352,"02000152","SODIUM BENZOAT RRC 250GR","PCS","Stok Toko (PKL)",4,"MENIPIS"],[353,"01009402","SP RYOTO 250GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[354,"01052763","WIJEN HITAM 100GR CRH","PCS","Stok Toko (PKL)",4,"MENIPIS"],[355,"02000982","STPP PENGENYAL BASO 250GR CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[356,"00081/2KG","AMPEC FULL CREAM","1/2kg","Stok Toko (PKL)",5,"MENIPIS"],[357,"01103071","CHEF DANIEL POTATO FLAKE 500GR","PCS","Stok Toko (PKL)",5,"MENIPIS"],[358,"090512","ELMER CRISPY BALL PINK","KG","Stok Toko (PKL)",5,"MENIPIS"],[359,"01081541","FILMA PRESTIGE MARG 500GR CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[360,"01077682","GUARGUM EX INDIA","1/4kg","Stok Toko (PKL)",5,"MENIPIS"],[361,"01101444","LA KREIVA MARIE BISC FINE 100GR CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[362,"01076382","MESES ALPHA WTC CRH","1/4kg","Stok Toko (PKL)",5,"MENIPIS"],[363,"00171/2KG","MOREMADE SAFFIRE BUTTER BLEND","1/2kg","Stok Toko (PKL)",5,"MENIPIS"],[364,"090148","PALETTA EXCE BLUEBERRY 1KG CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[365,"0200457","PRIMERA BREAD CRUMB PTH 1KG CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[366,"01013232","PWN APPLE GREEN 250GR CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[367,"01013311","PWN CHERRY RED 500GR","PCS","Stok Toko (PKL)",5,"MENIPIS"],[368,"0107222","PWN EGG YELLOW 2115 TYPE M 1KG","PCS","Stok Toko (PKL)",5,"MENIPIS"],[369,"01009222","REF MENTEGA PTH 250GR CRH","PCS","Stok Toko (PKL)",5,"MENIPIS"],[370,"SPK-100","Spikel curah 100gr","pcs","Stok Toko (PKL)",0,"HABIS"],[371,"0200322","YUTAKACHI BASIL","10Gr","Stok Toko (PKL)",5,"MENIPIS"],[372,"0200268","BACOM A100 1KG CRH","PCS","Stok Toko (PKL)",3,"MENIPIS"],[373,"01025361","AGAR POWDER KW1 500GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[374,"00081/4KG","AMPEC FULL CREAM","1/4kg","Stok Toko (PKL)",6,"AMAN"],[375,"03000991","COCONUT FLAV POWDER 500GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[376,"011004612","ELMER DIP GLAZE RED VELVET 250GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[377,"03000351","KETAN HITAM 500GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[378,"01039782","MAJESTY NASTAR NANAS 250GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[379,"03001881","PRIMSFOOD ANGGUR 500GR DONUT DUSTING","PCS","Stok Toko (PKL)",6,"AMAN"],[380,"01070351","SKIM POWDER 500GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[381,"0110311","SP 68 1KG CURAH","PCS","Stok Toko (PKL)",6,"AMAN"],[382,"01036892","TRIJAYA DESICCATED COCONUT","1/2kg","Stok Toko (PKL)",5,"MENIPIS"],[383,"01036892","TRIJAYA DESICCATED COCONUT","KG","Stok Toko (PKL)",6,"AMAN"],[384,"01009132","MENARA MARGARIN 250GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[385,"02001641","S METABSF/NATRON 500GR CRH","PCS","Stok Toko (PKL)",36,"AMAN"],[386,"00081KG","AMPEC FULL CREAM","KG","Stok Toko (PKL)",7,"AMAN"],[387,"02001672","BHT","1/4kg","Stok Toko (PKL)",7,"AMAN"],[388,"01014101","CORMAN PATISY 500GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[389,"01070362","DAIRYVILLE MILK PWD 250GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[390,"01001701","DONAN 500GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[391,"03000362","JAGUNG POP CORN 250GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[392,"0104047","MORIN DCD PEANUT 5KG","PCS","Stok Toko (PKL)",7,"AMAN"],[393,"090150","PALETTA EXCE STRAWBERRY CRH","KG","Stok Toko (PKL)",7,"AMAN"],[394,"01063542","PALMVITA B O S 250GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[395,"0106793","PONDAN CLASSIC 1KG CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[396,"0200102","CMC 1KG CRH","PCS","Stok Toko (PKL)",28,"AMAN"],[397,"02001671","BHT","1/2kg","Stok Toko (PKL)",8,"AMAN"],[398,"01070413","D`CORE CHOCO FILLING 5KG","BAG","Stok Toko (PKL)",8,"AMAN"],[399,"0300477","FUJI KOMACHI WHEAT FLOUR","KG","Stok Toko (PKL)",8,"AMAN"],[400,"02001132","GMS 250GR CRH","PCS","Stok Toko (PKL)",8,"AMAN"],[401,"02001261","MAEZENA 500GR CRH","PCS","Stok Toko (PKL)",7,"AMAN"],[402,"0109917","MESES SIERRA COKLAT PREMIUM 1KG","PCS","Stok Toko (PKL)",8,"AMAN"],[403,"0200206","OVALET 1KG CRH","PCS","Stok Toko (PKL)",8,"AMAN"],[404,"03001871","PRIMSFOOD STRAW 500GR DONUT DUSTING CRH","PCS","Stok Toko (PKL)",8,"AMAN"],[405,"0101327","PWN EGG YELLOW 2115 1KG","PCS","Stok Toko (PKL)",8,"AMAN"],[406,"02000282","QUICK 75 250GR CRH","PCS","Stok Toko (PKL)",8,"AMAN"],[407,"01036892","TRIJAYA DESICCATED COCONUT","1/4kg","Stok Toko (PKL)",8,"AMAN"],[408,"8990007432329","YUTAKACHI LADA PUTIH BUBUK","1/4kg","Stok Toko (PKL)",8,"AMAN"],[409,"0100543","OPAQUE WHITE 1KG CRH","PCS","Stok Toko (PKL)",23,"AMAN"],[410,"01024241","BENDICO CO PWD ND 500GR CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[411,"0903241","COLATTA MINI CHIP 500GR CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[412,"0107041","D`CORE CHOCO FILLING 1KG CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[413,"02003592","DOBRIM 30/50 250GR CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[414,"0107833","ELMER CRISPY BALL LEMON","CUP","Stok Toko (PKL)",9,"AMAN"],[415,"01077681","GUARGUM EX INDIA","1/2kg","Stok Toko (PKL)",9,"AMAN"],[416,"01095562","LA KREIVA BLACK FINE 500GR CRH CRUMBLE","PCS","Stok Toko (PKL)",9,"AMAN"],[417,"0109484","MESES SIERRA COKLAT 1KG","PCS","Stok Toko (PKL)",9,"AMAN"],[418,"0200203","OVALET SPC TBM 1KG CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[419,"03004351","PRIMSFOOD MELON 500GR DONUT DUSTING CRH","PCS","Stok Toko (PKL)",9,"AMAN"],[420,"0300091","TERIGU KUNCI CRH","KG","Stok Toko (PKL)",9,"AMAN"],[421,"01000483","WIJEN","1ons","Stok Toko (PKL)",9,"AMAN"],[422,"0100628","TULIP BORDEAUX 1KG CRH","PCS","Stok Toko (PKL)",10,"AMAN"],[423,"01103072","CHEF DANIEL POTATO FLAKE 250GR","PCS","Stok Toko (PKL)",10,"AMAN"],[424,"090594","ELMER DIP GLAZE TARO CRH","KG","Stok Toko (PKL)",10,"AMAN"],[425,"01094752","MESES SIERRA BIRU 250GR","PCS","Stok Toko (PKL)",10,"AMAN"],[426,"03000471","TEPUNG PANIER 500GR CRH","PCS","Stok Toko (PKL)",10,"AMAN"],[427,"0200279","TIXOSIL 38 ANTI BATU","1/4kg","Stok Toko (PKL)",10,"AMAN"],[428,"0102536","AGAR POWDER KW1 1KG CRH","PCS","Stok Toko (PKL)",11,"AMAN"],[429,"01005813","GELATINE","ONS","Stok Toko (PKL)",11,"AMAN"],[430,"0107768","GUARGUM EX INDIA","KG","Stok Toko (PKL)",11,"AMAN"],[431,"0109479","MESES SIERRA MERAH 1KG","PCS","Stok Toko (PKL)",11,"AMAN"],[432,"01094782","MESES SIERRA MERAH MUDA 250GR","PCS","Stok Toko (PKL)",11,"AMAN"],[433,"0200475","PRIMERA BREAD CRUMB ORG 1KG CRH","PCS","Stok Toko (PKL)",11,"AMAN"],[434,"01070352","SKIM POWDER 250GR CRH","PCS","Stok Toko (PKL)",11,"AMAN"],[435,"0300026","KIRANDU LOKAL 1KG CRH","KG","Stok Toko (PKL)",30,"AMAN"],[436,"01039702","COLATTA VERMICELLI SIGN 250GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[437,"0107041","D`CORE CHOCO FILLING 1KG CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[438,"01001702","DONAN 250GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[439,"01081552","FILMA MARG TF 250GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[440,"01098572","LA KREIVA CHOC FINE 500GR CRH CRUMBLE","PCS","Stok Toko (PKL)",12,"AMAN"],[441,"0109481","MESES SIERRA HIJAU 1KG","PCS","Stok Toko (PKL)",12,"AMAN"],[442,"00171/4KG","MOREMADE SAFFIRE BUTTER BLEND","1/4kg","Stok Toko (PKL)",12,"AMAN"],[443,"01067931","PONDAN CLASSIC 500GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[444,"01013233","PWN APPLE GREEN 100GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[445,"0200136","BAKING POWDER 1KG CRH","PCS","Stok Toko (PKL)",40,"AMAN"],[446,"01059643","ANCHOR TINNED BUTTER 100GR CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[447,"03000992","COCONUT FLAV POWDER 250GR CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[448,"0101023","GLYCINE/PENYEDAP 1KG CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[449,"00091/2KG","HOLLMAN BUTTER CURAH","1/2kg","Stok Toko (PKL)",13,"AMAN"],[450,"0106804","JAVA CHOCO FILLING 1KG CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[451,"01098574","LA KREIVA CHOC FINE 100GR CRH CRUMBLE","PCS","Stok Toko (PKL)",13,"AMAN"],[452,"01062841","M.A PELLET STICK POTATO P10 500GR CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[453,"01099171","MESES SIERRA COKLAT PREMIUM 500GR","PCS","Stok Toko (PKL)",13,"AMAN"],[454,"0200477","PRIMERA BREAD CRUMB BLEND 1KG CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[455,"01000483","WIJEN","1ons","Stok Toko (PKL)",13,"AMAN"],[456,"0100002","VANILI LOKAL 1KG CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[457,"02003591","DOBRIM 30/50 500GR CRH","PCS","Stok Toko (PKL)",14,"AMAN"],[458,"01095564","LA KREIVA BLACK FINE 100GR CRH CRUMBLE","PCS","Stok Toko (PKL)",14,"AMAN"],[459,"0017KG","MOREMADE SAFFIRE BUTTER BLEND","KG","Stok Toko (PKL)",14,"AMAN"],[460,"01066633","PWN SUNSET YELLOW 100GR CRH","PCS","Stok Toko (PKL)",14,"AMAN"],[461,"00251/4KG","ANGEL SP CAKE IMPROVER 250GR CURAH","PCS","Stok Toko (PKL)",15,"AMAN"],[462,"01081542","FILMA PRESTIGE MARG 250GR CRH","PCS","Stok Toko (PKL)",15,"AMAN"],[463,"00221KG","GOLD BULLION 1KG GRAND BUTTER BLEND","PCS","Stok Toko (PKL)",15,"AMAN"],[464,"01023211","OPAQUE WHITE USP 500GR CRH","PCS","Stok Toko (PKL)",12,"AMAN"],[465,"03004352","PRIMSFOOD MELON 250GR DONUT DUSTING CRH","PCS","Stok Toko (PKL)",15,"AMAN"],[466,"03004372","PRIMSFOOD ORANGE 250GR DONUT DUSTING","PCS","Stok Toko (PKL)",15,"AMAN"],[467,"0300075","TERIGU CAKRA CRH","KG","Stok Toko (PKL)",15,"AMAN"],[468,"02002681","BACOM A100 500GR CRH","PCS","Stok Toko (PKL)",16,"AMAN"],[469,"01025362","AGAR POWDER KW1 250GR CRH","PCS","Stok Toko (PKL)",16,"AMAN"],[470,"01001701","DONAN 500GR CRH","PCS","Stok Toko (PKL)",16,"AMAN"],[471,"01010232","GLYCINE/PENYEDAP 250GR CRH","PCS","Stok Toko (PKL)",16,"AMAN"],[472,"00091/4KG","HOLLMAN BUTTER CURAH","1/4kg","Stok Toko (PKL)",16,"AMAN"],[473,"03004152","TEPUNG UBI COKLAT","1/4kg","Stok Toko (PKL)",16,"AMAN"],[474,"0100633","COCOA POWDER PW 1KG CRH","PCS","Stok Toko (PKL)",2,"MENIPIS"],[475,"02001101","CITRUN GAJAH 500GR CRH","PCS","Stok Toko (PKL)",13,"AMAN"],[476,"01007864","BENSDORP COKLAT BBK 50GR CRH","PCS","Stok Toko (PKL)",17,"AMAN"],[477,"01094831","MESES SIERRA WARNA 500GR","PCS","Stok Toko (PKL)",17,"AMAN"],[478,"090706","MORIN FILLOLES STRAWBERRY","KG","Stok Toko (PKL)",17,"AMAN"],[479,"0200095","PENGENYAL MIE 1KG CRH","PCS","Stok Toko (PKL)",26,"AMAN"],[480,"02001611","AMONIA KUE RRC 500GR CRH","PCS","Stok Toko (PKL)",18,"AMAN"],[481,"02002032","OVALET SPC TBM 250GR CRH","PCS","Stok Toko (PKL)",18,"AMAN"],[482,"0109807","PALMVITA BAKER`S FAT 1KG CRH","PCS","Stok Toko (PKL)",18,"AMAN"],[483,"03001882","PRIMSFOOD ANGGUR 250GR DONUT DUSTING","PCS","Stok Toko (PKL)",18,"AMAN"],[484,"0200016","SODIUM BENZOAT HOLLAND 1KG CRH","PCS","Stok Toko (PKL)",49,"AMAN"],[485,"0200106","POTASIUM SORBATE 1KG CRH","PCS","Stok Toko (PKL)",28,"AMAN"],[486,"0200164","S METABSF/NATRON 1KG CRH","PCS","Stok Toko (PKL)",52,"AMAN"],[487,"03001623","JELLY POWDER 100GR CRH","PCS","Stok Toko (PKL)",19,"AMAN"],[488,"01012613","PWN ORANGE AG 100GR CRH","PCS","Stok Toko (PKL)",19,"AMAN"],[489,"0105031","ROOMBUTTER RBS 1KG CRH","PCS","Stok Toko (PKL)",11,"AMAN"],[490,"02000151","SODIUM BENZOAT RRC 500GR","PCS","Stok Toko (PKL)",14,"AMAN"],[491,"0200129","SODA KUE RRC 1KG CRH","PCS","Stok Toko (PKL)",55,"AMAN"],[492,"01089411","ATHENA BAKING POWDER CRH 500GR","PCS","Stok Toko (PKL)",20,"AMAN"],[493,"01070303","FILMA B O S 100GR CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[494,"0107030","FILMA B O S 1KG CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[495,"01027502","FILMA GOOD FRY (M PADAT) 250GR CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[496,"01081542","FILMA PRESTIGE MARG 250GR CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[497,"0200126","MAEZENA 1KG CRH","PCS","Stok Toko (PKL)",15,"AMAN"],[498,"02002982","PENYAKREK 250GR CRH","PCS","Stok Toko (PKL)",20,"AMAN"],[499,"0903242","COLATTA MINI CHIP 250GR CRH","PCS","Stok Toko (PKL)",21,"AMAN"],[500,"0107802","FILMA BAKER`S C FAT 1KG CRH","PCS","Stok Toko (PKL)",21,"AMAN"],[501,"01094752","MESES SIERRA BIRU 250GR","PCS","Stok Toko (PKL)",21,"AMAN"],[502,"0200306","RH OREGANO VNT3","1/4kg","Stok Toko (PKL)",21,"AMAN"],[503,"0200306","RH OREGANO VNT3","1/2kg","Stok Toko (PKL)",21,"AMAN"],[504,"0200472","SAPP EX THAILAND 1KG CRH","PCS","Stok Toko (PKL)",21,"AMAN"],[505,"0106266","SASA MSG CRH 1KG","PCS","Stok Toko (PKL)",21,"AMAN"],[506,"01075612","SERENA BLACK COOKIES CRUMB 250GR CRH","PCS","Stok Toko (PKL)",21,"AMAN"],[507,"00081ONS","AMPEC FULL CREAM","ONS","Stok Toko (PKL)",22,"AMAN"],[508,"01070303","FILMA B O S 100GR CRH","PCS","Stok Toko (PKL)",22,"AMAN"],[509,"02002031","OVALET SPC TBM 500GR CRH","PCS","Stok Toko (PKL)",22,"AMAN"],[510,"0300075","TERIGU CAKRA CRH","KG","Stok Toko (PKL)",22,"AMAN"],[511,"0300473","TERIGU CAKRA KEMBAR MAS CRH","KG","Stok Toko (PKL)",22,"AMAN"],[512,"01006281","TULIP BORDEAUX 500GR CRH","PCS","Stok Toko (PKL)",23,"AMAN"],[513,"0109482","MESES SIERRA WARNA T C 1KG","PCS","Stok Toko (PKL)",23,"AMAN"],[514,"03004371","PRIMSFOOD ORANGE 500GR DONUT DUSTING","PCS","Stok Toko (PKL)",23,"AMAN"],[515,"0200132","PURON AG 1KG CRH","PCS","Stok Toko (PKL)",17,"AMAN"],[516,"02002981","PENYAKREK 500GR CRH","PCS","Stok Toko (PKL)",57,"AMAN"],[517,"0103978","MAJESTY NASTAR NANAS 1KG CRH","PCS","Stok Toko (PKL)",24,"AMAN"],[518,"01025363","AGAR POWDER KW1 100GR CRH","PCS","Stok Toko (PKL)",25,"AMAN"],[519,"0017ONS","MOREMADE SAFFIRE BUTTER BLEND","ONS","Stok Toko (PKL)",25,"AMAN"],[520,"01097081","ORCHID BUTTER 500GR CRH","PCS","Stok Toko (PKL)",25,"AMAN"],[521,"0200122","SODIUM SUPER 1KG CRH","PCS","Stok Toko (PKL)",19,"AMAN"],[522,"0109986","SODIUM BENZOAT PRILL","KG","Stok Toko (PKL)",39,"AMAN"],[523,"01082521","BENDICO CO PWD XXD 500GR CRH","PCS","Stok Toko (PKL)",26,"AMAN"],[524,"090232","CORN FLAKES","KG","Stok Toko (PKL)",26,"AMAN"],[525,"01094802","MESES SIERRA UNGU 250GR","PCS","Stok Toko (PKL)",26,"AMAN"],[526,"0300063","TERIGU SEGITIGA CRH","KG","Stok Toko (PKL)",26,"AMAN"],[527,"0106659","TULIP NOIR BLACK 1KG CRH","PCS","Stok Toko (PKL)",26,"AMAN"],[528,"02002682","BACOM A100 250GR CRH","PCS","Stok Toko (PKL)",27,"AMAN"],[529,"01078132","BENDICO CO PWD XD 250GR CRH","PCS","Stok Toko (PKL)",27,"AMAN"],[530,"01099171","MESES SIERRA COKLAT PREMIUM 500GR","PCS","Stok Toko (PKL)",27,"AMAN"],[531,"0100922","REF MENTEGA PTH 1KG CRH","PCS","Stok Toko (PKL)",27,"AMAN"],[532,"01009402","SP RYOTO 250GR CRH","PCS","Stok Toko (PKL)",27,"AMAN"],[533,"02001612","AMONIA KUE RRC 250GR CRH","PCS","Stok Toko (PKL)",6,"AMAN"],[534,"0200169","S HYDROSULPHITE RRC 1KG CRH","PCS","Stok Toko (PKL)",35,"AMAN"],[535,"01097631","COLATTA VERMICELLI ND 500GR CRH","PCS","Stok Toko (PKL)",28,"AMAN"],[536,"090003","IFF CHICKEN D-3197","KG","Stok Toko (PKL)",28,"AMAN"],[537,"0200161","AMONIA KUE RRC 1KG CRH","KG","Stok Toko (PKL)",24,"AMAN"],[538,"0300412","PAK TANI G TAPIOKA 1KG CRH","PCS","Stok Toko (PKL)",29,"AMAN"],[539,"01103111","SP 68 500GR CURAH","PCS","Stok Toko (PKL)",29,"AMAN"],[540,"03004151","TEPUNG UBI COKLAT","1/2kg","Stok Toko (PKL)",29,"AMAN"],[541,"02000981","STPP PENGENYAL BASO 500GR CRH","PCS","Stok Toko (PKL)",25,"AMAN"],[542,"01001702","DONAN 250GR CRH","PCS","Stok Toko (PKL)",30,"AMAN"],[543,"01099172","MESES SIERRA COKLAT PREMIUM 250GR","PCS","Stok Toko (PKL)",30,"AMAN"],[544,"01067932","PONDAN CLASSIC 250GR CRH","PCS","Stok Toko (PKL)",30,"AMAN"],[545,"01075642","PWN LEMON EGG YELLOW 250GR CRH","PCS","Stok Toko (PKL)",30,"AMAN"],[546,"090001","IFF GARLIC S-1657","KG","Stok Toko (PKL)",31,"AMAN"],[547,"01094841","MESES SIERRA COKLAT 500GR","PCS","Stok Toko (PKL)",31,"AMAN"],[548,"0106779","PALMVITA WHITE FAT 1KG CRH","PCS","Stok Toko (PKL)",31,"AMAN"],[549,"01101801","PREMIX D25 500GR CRH","PCS","Stok Toko (PKL)",31,"AMAN"],[550,"0102321","OPAQUE WHITE USP 1KG CRH","PCS","Stok Toko (PKL)",27,"AMAN"],[551,"01047271","COLATTA CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",32,"AMAN"],[552,"01027501","FILMA GOOD FRY (M PADAT) 500GR CRH","PCS","Stok Toko (PKL)",32,"AMAN"],[553,"01070301","FILMA B O S 500GR CRH","PCS","Stok Toko (PKL)",33,"AMAN"],[554,"01000022","VANILI LOKAL 250GR CRH","PCS","Stok Toko (PKL)",31,"AMAN"],[555,"02003831","SODA KUE ASAHI 500GR CRH","PCS","Stok Toko (PKL)",16,"AMAN"],[556,"02001022","CMC 250GR CRH","PCS","Stok Toko (PKL)",32,"AMAN"],[557,"01078131","BENDICO CO PWD XD 500GR CRH","PCS","Stok Toko (PKL)",34,"AMAN"],[558,"01050313","ROOMBUTTER RBS 100GR CRH","PCS","Stok Toko (PKL)",35,"AMAN"],[559,"0200396","CALCIUM NIACET 1KG CRH","PCS","Stok Toko (PKL)",17,"AMAN"],[560,"01094772","MESES SIERRA KUNING 250GR","PCS","Stok Toko (PKL)",36,"AMAN"],[561,"02001062","POTASIUM SORBATE 250GR CRH","PCS","Stok Toko (PKL)",36,"AMAN"],[562,"01094831","MESES SIERRA WARNA 500GR","PCS","Stok Toko (PKL)",37,"AMAN"],[563,"0200110","CITRUN GAJAH 1KG CRH","PCS","Stok Toko (PKL)",43,"AMAN"],[564,"0902692","BAKERS` PRIDE BUTTER CRM 250GR","PCS","Stok Toko (PKL)",39,"AMAN"],[565,"02003961","CALCIUM NIACET 500GR CRH","PCS","Stok Toko (PKL)",39,"AMAN"],[566,"01089412","ATHENA BAKING POWDER 250GR CRH","PCS","Stok Toko (PKL)",40,"AMAN"],[567,"0300015","HUNKWEE 1KG CRH","PCS","Stok Toko (PKL)",37,"AMAN"],[568,"01078133","BENDICO CO PWD XD 100GR CRH","PCS","Stok Toko (PKL)",41,"AMAN"],[569,"01030862","MESES OSCAR 250GR CRH","PCS","Stok Toko (PKL)",0,"HABIS"],[570,"01013312","PWN CHERRY RED 250GR CRH","PCS","Stok Toko (PKL)",42,"AMAN"],[571,"01006332","COCOA POWDER PW 250GR CRH","PCS","Stok Toko (PKL)",1,"MENIPIS"],[572,"0902981","SIMBA CHOCO CRUNCH 500GR CRH","PCS","Stok Toko (PKL)",43,"AMAN"],[573,"01024243","BENDICO CO PWD ND 100GR CRH","PCS","Stok Toko (PKL)",43,"AMAN"],[574,"01006283","TULIP BORDEAUX 100GR CRH","PCS","Stok Toko (PKL)",43,"AMAN"],[575,"0101659","GYP CIOKO FOODGRADE","KG","Stok Toko (PKL)",80,"AMAN"],[576,"000ONS","HOLLMAN BUTTER CURAH","ONS","Stok Toko (PKL)",45,"AMAN"],[577,"0902322","CORN FLAKES","1/4kg","Stok Toko (PKL)",45,"AMAN"],[578,"0200015","SODIUM BENZOAT RRC 1KG","PCS","Stok Toko (PKL)",49,"AMAN"],[579,"01094842","MESES SIERRA COKLAT 250GR","PCS","Stok Toko (PKL)",46,"AMAN"],[580,"01101802","PREMIX D25 250GR CRH","PCS","Stok Toko (PKL)",47,"AMAN"],[581,"01066591","TULIP NOIR BLACK 500GR CRH","PCS","Stok Toko (PKL)",42,"AMAN"],[582,"03001081","GUNUNG AGUNG TAPIOKA CRH 500GR","PCS","Stok Toko (PKL)",48,"AMAN"],[583,"01099172","MESES SIERRA COKLAT PREMIUM 250GR","PCS","Stok Toko (PKL)",48,"AMAN"],[584,"0200474","SODA ASH FOODGRADE 1KG CRH","PCS","Stok Toko (PKL)",65,"AMAN"],[585,"02002362","ANCHOR BAKER`S MIX 250GR CRH","PCS","Stok Toko (PKL)",49,"AMAN"],[586,"01066592","TULIP NOIR BLACK 250GR CRH","PCS","Stok Toko (PKL)",32,"AMAN"],[587,"02000162","SODIUM BENZOAT HOLLAND 250GR CRH","PCS","Stok Toko (PKL)",31,"AMAN"],[588,"0200298","PENYAKREK 1KG CRH","PCS","Stok Toko (PKL)",34,"AMAN"],[589,"01094822","MESES SIERRA WARNA T C 250GR","PCS","Stok Toko (PKL)",52,"AMAN"],[590,"01082522","BENDICO CO PWD XXD 250GR CRH","PCS","Stok Toko (PKL)",53,"AMAN"],[591,"01075613","SERENA BLACK COOKIES CRUMB 100GR CRH","PCS","Stok Toko (PKL)",53,"AMAN"],[592,"01024244","BENDICO CO PWD ND 50GR CRH","PCS","Stok Toko (PKL)",54,"AMAN"],[593,"01050751","GOLD BULLION BOS 500GR CRH","PCS","Stok Toko (PKL)",54,"AMAN"],[594,"01067791","PALMVITA WHITE FAT 500GR CRH","PCS","Stok Toko (PKL)",54,"AMAN"],[595,"01050311","ROOMBUTTER RBS 500GR CRH","PCS","Stok Toko (PKL)",26,"AMAN"],[596,"01000021","VANILI LOKAL 500GR CRH","PCS","Stok Toko (PKL)",55,"AMAN"],[597,"0026KG","ELMER CHOCO CHIP COLOURED HR","1/2kg","Stok Toko (PKL)",56,"AMAN"],[598,"02001061","POTASIUM SORBATE 500GR CRH","PCS","Stok Toko (PKL)",42,"AMAN"],[599,"0300111","HAAN DONUT DUSTING 1KG CRH","PCS","Stok Toko (PKL)",57,"AMAN"],[600,"02001021","CMC 500GR CRH","PCS","Stok Toko (PKL)",54,"AMAN"],[601,"0100730","OVALET 40GR","PCS","Stok Toko (PKL)",58,"AMAN"],[602,"01050312","ROOMBUTTER RBS 250GR CRH","PCS","Stok Toko (PKL)",58,"AMAN"],[603,"02001292","SODA KUE RRC 250GR CRH","PCS","Stok Toko (PKL)",46,"AMAN"],[604,"02002061","OVALET 500GR CRH","PCS","Stok Toko (PKL)",59,"AMAN"],[605,"0300091","TERIGU KUNCI CRH","KG","Stok Toko (PKL)",59,"AMAN"],[606,"0200098","STPP PENGENYAL BASO 1KG CRH","PCS","Stok Toko (PKL)",76,"AMAN"],[607,"0108219","L`AGIE PLANET CHOC PEANUT /TB","PCS","Stok Toko (PKL)",60,"AMAN"],[608,"0107971","SP SUPER 40GR","PCS","Stok Toko (PKL)",60,"AMAN"],[609,"02000951","PENGENYAL MIE 500GR CRH","PCS","Stok Toko (PKL)",54,"AMAN"],[610,"02001221","SODIUM SUPER 500GR CRH","PCS","Stok Toko (PKL)",58,"AMAN"],[611,"02001362","BAKING POWDER 250GR CRH","PCS","Stok Toko (PKL)",56,"AMAN"],[612,"01094832","MESES SIERRA WARNA 250GR","PCS","Stok Toko (PKL)",63,"AMAN"],[613,"01082523","BENDICO CO PWD XXD 100GR CRH","PCS","Stok Toko (PKL)",65,"AMAN"],[614,"01099861","SODIUM BENZOAT PRILL","1/2kg","Stok Toko (PKL)",65,"AMAN"],[615,"0110180","PREMIX D25 1KG CRH","PCS","Stok Toko (PKL)",60,"AMAN"],[616,"01094822","MESES SIERRA WARNA T C 250GR","PCS","Stok Toko (PKL)",66,"AMAN"],[617,"01070302","FILMA B O S 250GR CRH","PCS","Stok Toko (PKL)",67,"AMAN"],[618,"01094832","MESES SIERRA WARNA 250GR","PCS","Stok Toko (PKL)",68,"AMAN"],[619,"01067792","PALMVITA WHITE FAT 250GR CRH","PCS","Stok Toko (PKL)",68,"AMAN"],[620,"01078134","BENDICO CO PWD XD 50GR CRH","PCS","Stok Toko (PKL)",73,"AMAN"],[621,"02001642","S METABSF/NATRON 250GR CRH","PCS","Stok Toko (PKL)",50,"AMAN"],[622,"03000151","HUNKWEE 500GR CRH","PCS","Stok Toko (PKL)",63,"AMAN"],[623,"01068042","JAVA CHOCO FILLING 250GR CRH","PCS","Stok Toko (PKL)",75,"AMAN"],[624,"0017KG","MOREMADE SAFFIRE BUTTER BLEND","KG","Stok Toko (PKL)",75,"AMAN"],[625,"01068041","JAVA CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",78,"AMAN"],[626,"0905802","COLATTA GLAZE GREEN TEA 250GR CRH","PCS","Stok Toko (PKL)",79,"AMAN"],[627,"02001023","CMC 100GR CRH","PCS","Stok Toko (PKL)",80,"AMAN"],[628,"0903632","COLATTA GLAZE WHITE 250GR CRH","PCS","Stok Toko (PKL)",82,"AMAN"],[629,"01070411","D`CORE CHOCO FILLING 500GR CRH","PCS","Stok Toko (PKL)",82,"AMAN"],[630,"02002062","OVALET 250GR CRH","PCS","Stok Toko (PKL)",82,"AMAN"],[631,"0901482","PALETTA EXCE BLUEBERRY 250GR CRH","PCS","Stok Toko (PKL)",82,"AMAN"],[632,"0300043","SAGU TANI CRH 1KG","PCS","Stok Toko (PKL)",82,"AMAN"],[633,"0108141","CRISPY CHICKEN ALA TAIWAN","PAK","Stok Toko (PKL)",78,"AMAN"],[634,"01006331","COCOA POWDER PW 500GR CRH","PCS","Stok Toko (PKL)",60,"AMAN"],[635,"01006282","TULIP BORDEAUX 250GR CRH","PCS","Stok Toko (PKL)",85,"AMAN"],[636,"01097632","COLATTA VERMICELLI ND 250GR CRH","PCS","Stok Toko (PKL)",86,"AMAN"],[637,"0901621","L`AGIE RAINBOW CHIPS 500GR CRH","PCS","Stok Toko (PKL)",86,"AMAN"],[638,"01075643","PWN LEMON EGG YELLOW 100GR CRH","PCS","Stok Toko (PKL)",87,"AMAN"],[639,"02004741","SODA ASH FOODGRADE 500GR CRH","PCS","Stok Toko (PKL)",85,"AMAN"],[640,"03001111","HAAN DONUT DUSTING 500GR CRH","PCS","Stok Toko (PKL)",91,"AMAN"],[641,"03000472","TEPUNG PANIER 250GR CRH","PCS","Stok Toko (PKL)",93,"AMAN"],[642,"02001321","PURON AG 500GR CRH","PCS","Stok Toko (PKL)",96,"AMAN"],[643,"01014103","CORMAN PATISY 100GR CRH","PCS","Stok Toko (PKL)",97,"AMAN"],[644,"01070412","D`CORE CHOCO FILLING 250GR CRH","PCS","Stok Toko (PKL)",97,"AMAN"],[645,"01094812","MESES SIERRA HIJAU 250GR","PCS","Stok Toko (PKL)",97,"AMAN"],[646,"0903672","COLATTA GLAZE STRAW 250GR CRH","PCS","Stok Toko (PKL)",98,"AMAN"],[647,"01050752","GOLD BULLION BOS 250GR CRH","PCS","Stok Toko (PKL)",98,"AMAN"],[648,"03001031","GULA PASIR","1/2kg","Stok Toko (PKL)",99,"AMAN"],[649,"02001322","PURON AG 250GR CRH","PCS","Stok Toko (PKL)",99,"AMAN"],[650,"01094792","MESES SIERRA MERAH 250GR","PCS","Stok Toko (PKL)",101,"AMAN"],[651,"02000952","PENGENYAL MIE 250GR CRH","PCS","Stok Toko (PKL)",101,"AMAN"],[652,"01101182","COLATTA GLAZE UBEE 250GR CRH","PCS","Stok Toko (PKL)",102,"AMAN"],[653,"03001082","GUNUNG AGUNG TAPIOKA 250GR CRH","PCS","Stok Toko (PKL)",102,"AMAN"],[654,"0108014","L`AGIE GOLDEN LEAF CHOC STICK TB","PCS","Stok Toko (PKL)",103,"AMAN"],[655,"0100730","OVALET 40GR","PAK","Stok Toko (PKL)",105,"AMAN"],[656,"01066593","TULIP NOIR BLACK 100GR CRH","PCS","Stok Toko (PKL)",57,"AMAN"],[657,"01047272","COLATTA CHOCO FILLING 250GR CRH","PCS","Stok Toko (PKL)",113,"AMAN"],[658,"0026KG","ELMER CHOCO CHIP COLOURED HR","1/4kg","Stok Toko (PKL)",118,"AMAN"],[659,"01063661","L`AGIE FEBBY PEANUT WARNA /TB","PCS","Stok Toko (PKL)",119,"AMAN"],[660,"0200306","RH OREGANO VNT3","1ons","Stok Toko (PKL)",119,"AMAN"],[661,"00171/4KG","MOREMADE SAFFIRE BUTTER BLEND","1/4kg","Stok Toko (PKL)",121,"AMAN"],[662,"01094842","MESES SIERRA COKLAT 250GR","PCS","Stok Toko (PKL)",123,"AMAN"],[663,"0106354","PALMVITA B O S 1KG CRH","PCS","Stok Toko (PKL)",111,"AMAN"],[664,"0903642","COLATTA GLAZE CAPPUCINO 250GR CRH","PCS","Stok Toko (PKL)",127,"AMAN"],[665,"0903622","COLATTA GLAZE DARK 250GR CRH","PCS","Stok Toko (PKL)",134,"AMAN"],[666,"01047272","COLATTA CHOCO FILLING 250GR CRH","PCS","Stok Toko (PKL)",138,"AMAN"],[667,"0105075","GOLD BULLION BOS 1KG CRH","PCS","Stok Toko (PKL)",125,"AMAN"],[668,"01099862","SODIUM BENZOAT PRILL","1/4kg","Stok Toko (PKL)",140,"AMAN"],[669,"02003962","CALCIUM NIACET 250GR CRH","PCS","Stok Toko (PKL)",142,"AMAN"],[670,"02001222","SODIUM SUPER 250GR CRH","PCS","Stok Toko (PKL)",142,"AMAN"],[671,"03000152","HUNKWEE 250GR CRH","PCS","Stok Toko (PKL)",145,"AMAN"],[672,"0903652","COLATTA GLAZE TIRAMISU 250GR CRH","PCS","Stok Toko (PKL)",146,"AMAN"],[673,"03001541","HAAN PALM SUGAR 500GR CRH","PCS","Stok Toko (PKL)",143,"AMAN"],[674,"03000432","SAGU TANI CRH 250GR","PCS","Stok Toko (PKL)",151,"AMAN"],[675,"03001542","HAAN PALM SUGAR CRH 250GR","PCS","Stok Toko (PKL)",134,"AMAN"],[676,"SPK-500","Spikel curah 500gr","pcs","Stok Toko (PKL)",154,"AMAN"],[677,"01012533","PWN SARSAPARILA 100GR CRH","PCS","Stok Toko (PKL)",158,"AMAN"],[678,"0100731","TBM 40GR (B)","PCS","Stok Toko (PKL)",160,"AMAN"],[679,"03000431","SAGU TANI CRH 500GR","PCS","Stok Toko (PKL)",159,"AMAN"],[680,"03001112","HAAN DONUT DUSTING 250GR CRH","PCS","Stok Toko (PKL)",183,"AMAN"],[681,"00171/2KG","MOREMADE SAFFIRE BUTTER BLEND","1/2kg","Stok Toko (PKL)",185,"AMAN"],[682,"01023212","OPAQUE WHITE USP 250GR CRH","PCS","Stok Toko (PKL)",187,"AMAN"],[683,"090019","SPIKEL CURAH","KG","Stok Toko (PKL)",190,"AMAN"],[684,"03004122","PAK TANI G TAPIOKA 250GR CRH","PCS","Stok Toko (PKL)",193,"AMAN"],[685,"SPK-250","Spikel curah 250gr","pcs","Stok Toko (PKL)",184,"AMAN"],[686,"01006284","TULIP BORDEAUX 50GR CRH","PCS","Stok Toko (PKL)",204,"AMAN"],[687,"0200306","RH OREGANO VNT3","1/2ons","Stok Toko (PKL)",259,"AMAN"],[688,"0108015","L`AGIE GOLDEN CITY CHOC BALL /TB","PCS","Stok Toko (PKL)",280,"AMAN"],[689,"0108219","L`AGIE PLANET CHOC PEANUT /TB","PCS","Stok Toko (PKL)",301,"AMAN"],[690,"01082524","BENDICO CO PWD XXD 50GR CRH","PCS","Stok Toko (PKL)",336,"AMAN"],[691,"0901622","L`AGIE RAINBOW CHIPS 250GR CRH","PCS","Stok Toko (PKL)",351,"AMAN"],[692,"0105063","QUICK 75 40GR","PCS","Stok Toko (PKL)",372,"AMAN"],[693,"0108013","L`AGIE GOLDEN CHOC COIN CUP 100GR","PCS","Stok Toko (PKL)",415,"AMAN"],[694,"SPK-50","Spikel curah 50gr","pcs","Stok Toko (PKL)",566,"AMAN"],[695,"01050753","GOLD BULLION BOS 100GR CRH","PCS","Stok Toko (PKL)",787,"AMAN"],[696,"0200306","RH OREGANO VNT3","10Gr","Stok Toko (PKL)",1022,"AMAN"],[697,"0100729","SP 40GR (B)","PCS","Stok Toko (PKL)",1341,"AMAN"],[698,"0405190","TOPLES 1300ML NECK85 BNG","PCS - 60","Stok Toples PKL",104,"AMAN"],[699,"0406241","TOPLES 2LTR KOTAK NECK85","PCS - 30","Stok Toples PKL",30,"AMAN"],[700,"0406392","TOPLES 300ML TUTUP BENING","PCS - 42","Stok Toples PKL",0,"HABIS"],[701,"0406391","TOPLES 300ML TUTUP BENING","PCS - 40","Stok Toples PKL",5,"MENIPIS"],[702,"0406537","TOPLES 400ML NECK85 + TUTUP","PCS - 63","Stok Toples PKL",111,"AMAN"],[703,"0406382","TOPLES 500ML A0501","PCS - 80","Stok Toples PKL",30,"AMAN"],[704,"0405286","TOPLES 600ML NECK85 BNG","PCS - 49","Stok Toples PKL",25,"AMAN"],[705,"0405287","TOPLES 800ML NECK85 BNG","PCS dus-120","Stok Toples PKL",16,"AMAN"],[706,"0405287","TOPLES 800ML NECK85 BNG","PCS - 49","Stok Toples PKL",56,"AMAN"],[707,"0501794","TOPLES A-1A (0451)","PCS - 24","Stok Toples PKL",30,"AMAN"],[708,"0501238","TOPLES A-3A (0291)","PCS - 100","Stok Toples PKL",31,"AMAN"],[709,"0501795","TOPLES A-4A (0401/0402)","PCS - 90","Stok Toples PKL",27,"AMAN"],[710,"0501239","TOPLES A-5A (0701/0702/0704)","PCS - 77","Stok Toples PKL",69,"AMAN"],[711,"0501240","TOPLES A-6A (0341)","PCS - 100","Stok Toples PKL",25,"AMAN"],[712,"0407096","TOPLES B2002 (B-20C102) 2000ML","PCS - 56","Stok Toples PKL",0,"HABIS"],[713,"0407097","TOPLES B2002 (B-20C102) 2000ML","PCS - 48","Stok Toples PKL",28,"AMAN"],[714,"0501243","TOPLES B-4A (0861)","PCS - 36","Stok Toples PKL",19,"AMAN"],[715,"0501997","TOPLES B-5A (1752) 1750ML","PCS - 56","Stok Toples PKL",16,"AMAN"],[716,"0503045","TOPLES BIGGY CT-135 OVAL","PCS - 24","Stok Toples PKL",131,"AMAN"],[717,"0502150","TOPLES BIGGY CT-150 250GR","PCS - 24","Stok Toples PKL",490,"AMAN"],[718,"0406975","TOPLES DELICE LD 167 S 250GR","PCS - 12","Stok Toples PKL",560,"AMAN"],[719,"0406011","TOPLES F0152 BUMBU KECIL 150ML","PCS - 100","Stok Toples PKL",25,"AMAN"],[720,"0502734","TOPLES F0211+TTP C5","PCS - 100","Stok Toples PKL",23,"AMAN"],[721,"0502733","TOPLES F0212+TTP C5","PCS - 100","Stok Toples PKL",25,"AMAN"],[722,"0503522","TOPLES F0221+TTP C5","PCS - 100","Stok Toples PKL",25,"AMAN"],[723,"0503109","TOPLES GB VICI P.PANJANG 350GR","PCS - 12","Stok Toples PKL",40,"AMAN"],[724,"0405597","TOPLES NATHA GB PERSEGI 300GR","PCS - 12","Stok Toples PKL",390,"AMAN"],[725,"04071120","TOPLES TABUNG 1000ML ALU GOLD","BAL-46","Stok Toples PKL",0,"HABIS"],[726,"04063870","TOPLES TABUNG 1000ML ALU SILVER","BAL-46","Stok Toples PKL",59,"AMAN"],[727,"04063880","TOPLES TABUNG 1300ML ALU SILVER","BAL-42","Stok Toples PKL",0,"HABIS"],[728,"04067720","TOPLES TABUNG 300ML ALU ROSE GOLD","BAL-42","Stok Toples PKL",0,"HABIS"],[729,"04063840","TOPLES TABUNG 300ML ALU SILVER","BAL-42","Stok Toples PKL",0,"HABIS"],[730,"04066860","TOPLES TABUNG 400ML ALU GOLD","BAL-40","Stok Toples PKL",0,"HABIS"],[731,"04071450","TOPLES TABUNG 400ML ALU ROSE GOLD","BAL-40","Stok Toples PKL",115,"AMAN"],[732,"04064620","TOPLES TABUNG 400ML ALU SILVER","BAL-40","Stok Toples PKL",13,"AMAN"],[733,"04064620","TOPLES TABUNG 400ML ALU SILVER (natural)","BAL-40","Stok Toples PKL",238,"AMAN"],[734,"04066880","TOPLES TABUNG 600ML ALU GOLD","BAL-56","Stok Toples PKL",0,"HABIS"],[735,"0406688000","TOPLES TABUNG 600ML ALU GOLD","BAL-35","Stok Toples PKL",0,"HABIS"],[736,"040668800","TOPLES TABUNG 600ML ALU GOLD","BAL-40","Stok Toples PKL",0,"HABIS"],[737,"04066870","TOPLES TABUNG 600ML ALU RED","CTN-120","Stok Toples PKL",0,"HABIS"],[738,"04071460","TOPLES TABUNG 600ML ALU ROSE GOLD","BAL-35","Stok Toples PKL",20,"AMAN"],[739,"04063850","TOPLES TABUNG 600ML ALU SILVER","BAL-56","Stok Toples PKL",0,"HABIS"],[740,"04063850000","TOPLES TABUNG 600ML ALU SILVER","BAL-40","Stok Toples PKL",0,"HABIS"],[741,"040638500","TOPLES TABUNG 600ML ALU SILVER","CTN-120","Stok Toples PKL",0,"HABIS"],[742,"0406385000","TOPLES TABUNG 600ML ALU SILVER","BAL-35","Stok Toples PKL",40,"AMAN"],[743,"0406385000","TOPLES TABUNG 600ML ALU SILVER (natural)","BAL-35","Stok Toples PKL",30,"AMAN"],[744,"04067710","TOPLES TABUNG 750ML ALU GOLD","BAL-56","Stok Toples PKL",0,"HABIS"],[745,"04063860","TOPLES TABUNG 750ML ALU SILVER","BAL-56","Stok Toples PKL",0,"HABIS"],[746,"040638600","TOPLES TABUNG 750ML ALU SILVER","CTN","Stok Toples PKL",0,"HABIS"],[747,"0406386000","TOPLES TABUNG 750ML ALU SILVER","BAL-35","Stok Toples PKL",35,"AMAN"],[748,"04063860","TOPLES TABUNG 750ML ALU SILVER (natural)","BAL-56","Stok Toples PKL",43,"AMAN"],[749,"0406386000","TOPLES TABUNG 750ML ALU SILVER (natural)","BAL-35","Stok Toples PKL",109,"AMAN"]];
}

function getInitialCatalogItems() {
  var raw = getInitialCatalogRaw();
  var items = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    items.push({
      id: "item_" + r[0] + "_" + (r[1] || "it"),
      kode: r[1],
      nama: r[2],
      satuan: r[3],
      lokasi: r[4],
      stok: r[5],
      status: r[6]
    });
  }
  return items;
}
