import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { Item } from '../../types';
import { getTodayYYYYMMDD, formatToDDMMYYYY } from '../../utils/date';
import { exportTransactionsToExcel } from '../../utils/excel';
import { 
  ArrowDownLeft, 
  Calendar, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';

interface EntryRow {
  rowId: string;
  item: Item | null;
  kodeInput: string;
  namaInput: string;
  qty: number | '';
}

export const InputBarangMasukView: React.FC = () => {
  const { recordTransaction, getNextDocNumber, createNewSheetDocNumber, transactions } = useInventory();

  const [tanggal, setTanggal] = useState<string>(getTodayYYYYMMDD());
  const [noDokumen, setNoDokumen] = useState<string>(() => getNextDocNumber('IN'));
  const [keterangan, setKeterangan] = useState<string>('');
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  const [rows, setRows] = useState<EntryRow[]>([
    {
      rowId: `row_1`,
      item: null,
      kodeInput: '',
      namaInput: '',
      qty: ''
    }
  ]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const namaInputRefs = React.useRef<any[]>([]);
  const qtyInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Selected item preview for top banner
  const activeItemPreview = rows[activeRowIndex]?.item || rows.find(r => r.item)?.item || null;

  const handleNewSheet = () => {
    const nextDoc = createNewSheetDocNumber();
    setNoDokumen(nextDoc);
    setRows([
      {
        rowId: `row_${Date.now()}`,
        item: null,
        kodeInput: '',
        namaInput: '',
        qty: ''
      }
    ]);
    setKeterangan('');
    setActiveRowIndex(0);
    setSuccessMessage(`Lembar baru dibuat dengan No Dokumen: ${nextDoc}`);
    setErrorMessage(null);
    setTimeout(() => {
      namaInputRefs.current[0]?.focus();
    }, 50);
  };

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        rowId: `row_${Date.now()}_${Math.random()}`,
        item: null,
        kodeInput: '',
        namaInput: '',
        qty: ''
      }
    ]);
  };

  const addRowAndFocus = () => {
    setRows(prev => {
      const next: EntryRow[] = [
        ...prev,
        {
          rowId: `row_${Date.now()}_${Math.random()}`,
          item: null,
          kodeInput: '',
          namaInput: '',
          qty: ''
        }
      ];
      setActiveRowIndex(next.length - 1);
      setTimeout(() => {
        namaInputRefs.current[next.length - 1]?.focus();
      }, 50);
      return next;
    });
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      setRows([
        {
          rowId: `row_${Date.now()}`,
          item: null,
          kodeInput: '',
          namaInput: '',
          qty: ''
        }
      ]);
      setActiveRowIndex(0);
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index));
    setActiveRowIndex(prev => Math.max(0, prev - 1));
  };

  const handleSelectItem = (rowIndex: number, selectedItem: Item) => {
    setActiveRowIndex(rowIndex);
    setRows(prev => prev.map((r, i) => {
      if (i === rowIndex) {
        return {
          ...r,
          item: selectedItem,
          kodeInput: selectedItem.kode,
          namaInput: selectedItem.nama
        };
      }
      return r;
    }));
  };

  const updateQty = (rowIndex: number, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setRows(prev => prev.map((r, i) => {
      if (i === rowIndex) {
        return { ...r, qty: num };
      }
      return r;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!noDokumen.trim()) {
      setErrorMessage('No Dokumen wajib diisi.');
      return;
    }

    const validItems: Array<{ itemId: string; qty: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.item) {
        setErrorMessage(`Baris #${i + 1}: Silakan pilih barang terlebih dahulu.`);
        return;
      }
      if (!r.qty || Number(r.qty) <= 0) {
        setErrorMessage(`Baris #${i + 1} (${r.item.nama}): Qty masuk harus lebih dari 0.`);
        return;
      }
      validItems.push({
        itemId: r.item.id,
        qty: Number(r.qty)
      });
    }

    const result = recordTransaction({
      type: 'IN',
      tanggal,
      noDokumen: noDokumen.trim(),
      keterangan: keterangan.trim(),
      items: validItems
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal menyimpan barang masuk.');
    } else {
      setSuccessMessage(`Berhasil menyimpan barang masuk No Dokumen: ${noDokumen}`);
      // Reset rows and generate next auto document number automatically
      setRows([
        {
          rowId: `row_${Date.now()}`,
          item: null,
          kodeInput: '',
          namaInput: '',
          qty: ''
        }
      ]);
      setKeterangan('');
      setActiveRowIndex(0);
      setNoDokumen(getNextDocNumber('IN'));
    }
  };

  const handleExportHistory = () => {
    const inTxs = transactions.filter(t => t.type === 'IN');
    exportTransactionsToExcel(inTxs, 'Laporan_Barang_Masuk_Gudang_Repack.xlsx');
  };

  const totalQty = rows.reduce((acc, r) => acc + (typeof r.qty === 'number' ? r.qty : 0), 0);
  const totalItemCount = rows.filter(r => r.item !== null).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Formulir Penerimaan
              </span>
              <span className="text-[11px] text-gray-400">Gudang Repack</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">
              1. Input Barang Masuk
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Pencatatan penerimaan barang, penambahan stok, dan pembuatan dokumen mutasi masuk.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewSheet}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Buat Lembar Baru
          </button>

          <button
            type="button"
            onClick={handleExportHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
            title="Ekspor Riwayat Barang Masuk ke Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Ekspor Excel .xlsx
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
          >
            Tutup
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Form Container with requested "latar abu abu" (gray background) */}
      <form onSubmit={handleSubmit} className="bg-slate-100 p-5 sm:p-7 rounded-2xl border border-slate-300 shadow-sm space-y-6">
        {/* Top Header Information: Tanggal, No Dokumen, Keterangan */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tanggal dengan Icon Date Picker & format dd-mm-yyyy */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-700" />
              Tanggal Masuk (dd-mm-yyyy)
            </label>
            <div className="relative">
              <input
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                required
                className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-1 font-mono">
              Terpilih: <strong>{formatToDDMMYYYY(tanggal)}</strong>
            </div>
          </div>

          {/* No Document: awal manual, selanjutnya otomatis (RPK-2026-000001) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                No Document
              </label>
              <button
                type="button"
                onClick={handleNewSheet}
                title="Buat lembar baru dengan nomor dokumen otomatis selanjutnya"
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                + Lembar Baru
              </button>
            </div>
            <input
              type="text"
              value={noDokumen}
              onChange={e => setNoDokumen(e.target.value)}
              placeholder="Contoh: RPK-2026-000001"
              required
              className="w-full bg-emerald-50/70 border border-emerald-300 rounded-lg px-3 py-2 text-sm text-emerald-950 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
            />
            <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
              <span>Nomor Otomatis: <strong>{noDokumen}</strong></span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                Otomatis Bertambah
              </span>
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Keterangan / Asal Pengiriman
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              placeholder="Contoh: Penerimaan Pabrik / Supplier A"
              className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Catatan dokumen mutasi masuk
            </div>
          </div>
        </div>

        {/* Banner Preview Nama Barang di Bagian Atas */}
        {activeItemPreview && (
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white p-4 rounded-xl shadow-md border border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl text-emerald-200 flex-shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-emerald-300 uppercase tracking-widest font-bold">
                  Nama Barang Terpilih (Baris #{activeRowIndex + 1})
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight text-white leading-tight truncate">
                  {activeItemPreview.nama}
                </div>
                <div className="text-xs text-emerald-200 flex flex-wrap items-center gap-3 mt-1 font-mono">
                  <span>Kode: <strong>{activeItemPreview.kode}</strong></span>
                  <span>&bull;</span>
                  <span>Satuan: <strong>{activeItemPreview.satuan}</strong></span>
                  <span>&bull;</span>
                  <span>Lokasi: <strong>{activeItemPreview.lokasi}</strong></span>
                  <span>&bull;</span>
                  <span>Stok Saat Ini: <strong className="text-white bg-emerald-950 px-2 py-0.5 rounded">{activeItemPreview.stok}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grid Baris & Kolom Kebawah: Kode - Nama Barang - Satuan - Stok Saat Ini - Qty */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              Tabel Baris Item Barang Masuk
            </h3>
            <span className="text-xs text-gray-500">
              Gunakan tanda panah keyboard & Enter / Tab untuk memilih & otomatis tambah baris
            </span>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-200 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-40">Kode Barang</th>
                  <th className="py-3 px-3 min-w-[280px]">Nama Barang (Autocomplete)</th>
                  <th className="py-3 px-3 w-24 text-center">Satuan</th>
                  <th className="py-3 px-3 w-36">Lokasi</th>
                  <th className="py-3 px-3 w-28 text-right">Stok Saat Ini</th>
                  <th className="py-3 px-3 w-32 text-right">Qty Masuk</th>
                  <th className="py-3 px-2 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, index) => (
                  <tr 
                    key={row.rowId} 
                    onClick={() => setActiveRowIndex(index)}
                    className={`transition-colors ${activeRowIndex === index ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2.5 px-3 text-center text-gray-500 font-bold font-mono">
                      {index + 1}
                    </td>

                    {/* Kolom: Kode (Autocomplete) */}
                    <td className="py-2 px-3">
                      <div onFocus={() => setActiveRowIndex(index)}>
                        <ItemAutocomplete
                          value={row.kodeInput}
                          onChange={val => {
                            setRows(prev => prev.map((r, i) => i === index ? { ...r, kodeInput: val } : r));
                          }}
                          onSelectItem={item => handleSelectItem(index, item)}
                          onNextField={() => {
                            qtyInputRefs.current[index]?.focus();
                          }}
                          field="kode"
                          placeholder="Ketik kode..."
                          size="sm"
                        />
                      </div>
                    </td>

                    {/* Kolom: Nama Barang (Autocomplete) */}
                    <td className="py-2.5 px-3 min-w-[280px]">
                      {/* Tampilkan Nama Barang di bagian atas input jika sudah dipilih */}
                      {row.item && (
                        <div className="mb-1.5 px-2.5 py-1 bg-emerald-100/90 border border-emerald-300 rounded-lg text-emerald-950 text-xs font-black leading-snug flex items-center justify-between gap-1 shadow-2xs">
                          <span className="truncate" title={row.item.nama}>
                            {row.item.nama}
                          </span>
                          <span className="text-[10px] text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0">
                            {row.item.satuan}
                          </span>
                        </div>
                      )}

                      <div onFocus={() => setActiveRowIndex(index)}>
                        <ItemAutocomplete
                          ref={el => { namaInputRefs.current[index] = el; }}
                          value={row.namaInput}
                          onChange={val => {
                            setRows(prev => prev.map((r, i) => i === index ? { ...r, namaInput: val } : r));
                          }}
                          onSelectItem={item => handleSelectItem(index, item)}
                          onNextField={() => {
                            qtyInputRefs.current[index]?.focus();
                          }}
                          field="nama"
                          placeholder="Ketik nama barang..."
                          size="sm"
                        />
                      </div>
                    </td>

                    {/* Kolom: Satuan (Read Only) */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="text"
                        readOnly
                        value={row.item ? row.item.satuan : '-'}
                        className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1.5 text-xs text-gray-700 font-bold cursor-not-allowed text-center"
                      />
                    </td>

                    {/* Kolom: Lokasi (Read Only) */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        readOnly
                        value={row.item ? row.item.lokasi : '-'}
                        className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1.5 text-xs text-gray-600 cursor-not-allowed truncate"
                      />
                    </td>

                    {/* Kolom: Stok Saat Ini (Hanya Baca) */}
                    <td className="py-2 px-3 text-right">
                      <span className="inline-block px-2.5 py-1 bg-slate-200 text-slate-800 rounded-md font-bold font-mono text-xs">
                        {row.item ? row.item.stok : '-'}
                      </span>
                    </td>

                    {/* Kolom: Qty Masuk */}
                    <td className="py-2 px-3 text-right">
                      <input
                        ref={el => { qtyInputRefs.current[index] = el; }}
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.qty}
                        onChange={e => updateQty(index, e.target.value)}
                        onFocus={() => setActiveRowIndex(index)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                            e.preventDefault();
                            if (index === rows.length - 1) {
                              addRowAndFocus();
                            } else {
                              namaInputRefs.current[index + 1]?.focus();
                            }
                          }
                        }}
                        placeholder="0"
                        required
                        className="w-full bg-emerald-50 border border-emerald-300 rounded px-2 py-1.5 text-xs font-bold text-right text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>

                    {/* Kolom: Hapus */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Button Tambah Baris */}
          <div className="pt-1 flex justify-start">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              + Tambah Baris Barang (Atau tekan Enter/Tab di Qty)
            </button>
          </div>
        </div>

        {/* Bottom Section: Total Summary & Tombol Simpan */}
        <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <div>
              Total Baris Terisi: <strong className="text-gray-900 font-mono">{totalItemCount}</strong> dari {rows.length}
            </div>
            <div>
              Total Qty Masuk: <strong className="text-emerald-800 font-mono text-sm font-black">{totalQty}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleNewSheet}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Reset / Lembar Baru
            </button>

            <button
              type="submit"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              Simpan Barang Masuk
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
