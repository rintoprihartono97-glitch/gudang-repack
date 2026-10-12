import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { Item } from '../../types';
import { getTodayYYYYMMDD, formatToDDMMYYYY } from '../../utils/date';
import { exportTransactionsToExcel } from '../../utils/excel';
import { 
  ArrowUpRight, 
  Calendar, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Package,
  AlertTriangle
} from 'lucide-react';

interface EntryRow {
  rowId: string;
  item: Item | null;
  kodeInput: string;
  namaInput: string;
  qty: number | '';
}

export const InputBarangKeluarView: React.FC = () => {
  const { recordTransaction, getNextDocNumber, transactions } = useInventory();

  const [tanggal, setTanggal] = useState<string>(getTodayYYYYMMDD());
  const [noDokumen, setNoDokumen] = useState<string>(() => getNextDocNumber('OUT'));
  const [keterangan, setKeterangan] = useState<string>('');

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
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectItem = (rowIndex: number, selectedItem: Item) => {
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
      setErrorMessage('No Dokumen keluar wajib diisi.');
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
        setErrorMessage(`Baris #${i + 1} (${r.item.nama}): Qty keluar harus lebih dari 0.`);
        return;
      }
      if (Number(r.qty) > r.item.stok) {
        setErrorMessage(
          `Baris #${i + 1} (${r.item.nama}): Qty keluar (${r.qty}) melebihi stok yang tersedia (${r.item.stok} ${r.item.satuan})!`
        );
        return;
      }
      validItems.push({
        itemId: r.item.id,
        qty: Number(r.qty)
      });
    }

    const result = recordTransaction({
      type: 'OUT',
      tanggal,
      noDokumen: noDokumen.trim(),
      keterangan: keterangan.trim(),
      items: validItems
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal menyimpan barang keluar.');
    } else {
      setSuccessMessage(`Berhasil menyimpan barang keluar No Dokumen: ${noDokumen}`);
      // Reset rows and generate next auto document number
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
      setNoDokumen(getNextDocNumber('OUT'));
    }
  };

  const handleExportHistory = () => {
    const outTxs = transactions.filter(t => t.type === 'OUT');
    exportTransactionsToExcel(outTxs, 'Laporan_Barang_Keluar_Gudang_Repack.xlsx');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 rounded-xl text-rose-700">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              2. Input Barang Keluar
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Formulir pengeluaran / distribusi barang dengan grid baris dan validasi ketersediaan stok.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportHistory}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold self-start md:self-auto transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-rose-600" />
          Ekspor Riwayat Keluar .xlsx
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
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
              <Calendar className="w-4 h-4 text-rose-700" />
              Tanggal Keluar (dd-mm-yyyy)
            </label>
            <div className="relative">
              <input
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                required
                className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-1 font-mono">
              Terpilih: <strong>{formatToDDMMYYYY(tanggal)}</strong>
            </div>
          </div>

          {/* No Document: awal manual, selanjutnya otomatis */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-rose-700" />
              No Document
            </label>
            <input
              type="text"
              value={noDokumen}
              onChange={e => setNoDokumen(e.target.value)}
              placeholder="Contoh: BK-20261011-001"
              required
              className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Nomor dokumen terisi otomatis atau ubah manual
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Keterangan / Tujuan Distribusi
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              placeholder="Contoh: Kirim ke Toko / Repack Paket A"
              className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Keperluan atau tujuan pengeluaran barang
            </div>
          </div>
        </div>

        {/* Grid Baris & Kolom Kebawah: Kode - Nama Barang - Satuan - Stok Saat Ini - Qty */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-rose-700" />
              Tabel Baris Item Barang Keluar
            </h3>
            <span className="text-xs text-gray-500">
              Gunakan tanda panah keyboard & Enter untuk memilih pada kolom pencarian
            </span>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-200 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-44">Kode Barang</th>
                  <th className="py-3 px-3 min-w-[240px]">Nama Barang (Autocomplete)</th>
                  <th className="py-3 px-3 w-28">Satuan</th>
                  <th className="py-3 px-3 w-36">Lokasi</th>
                  <th className="py-3 px-3 w-28 text-right">Stok Saat Ini</th>
                  <th className="py-3 px-3 w-32 text-right">Qty Keluar</th>
                  <th className="py-3 px-2 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, index) => {
                  const isInsufficient = row.item && row.qty !== '' && Number(row.qty) > row.item.stok;

                  return (
                    <tr key={row.rowId} className={`transition-colors ${isInsufficient ? 'bg-rose-50/70' : 'hover:bg-slate-50'}`}>
                      <td className="py-2.5 px-3 text-center text-gray-500 font-bold font-mono">
                        {index + 1}
                      </td>

                      {/* Kolom: Kode (Autocomplete) */}
                      <td className="py-2 px-3">
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
                      </td>

                      {/* Kolom: Nama Barang (Autocomplete) */}
                      <td className="py-2 px-3">
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
                      </td>

                      {/* Kolom: Satuan (Read Only) */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          readOnly
                          value={row.item ? row.item.satuan : '-'}
                          className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1.5 text-xs text-gray-600 font-semibold cursor-not-allowed text-center"
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
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-bold font-mono text-xs ${
                            !row.item
                              ? 'bg-slate-200 text-slate-800'
                              : row.item.stok === 0
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {row.item ? row.item.stok : '-'}
                        </span>
                      </td>

                      {/* Kolom: Qty Keluar */}
                      <td className="py-2 px-3 text-right">
                        <div className="relative">
                          <input
                            ref={el => { qtyInputRefs.current[index] = el; }}
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.qty}
                            onChange={e => updateQty(index, e.target.value)}
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
                            className={`w-full rounded px-2 py-1.5 text-xs font-bold text-right focus:outline-none transition-colors ${
                              isInsufficient
                                ? 'bg-rose-100 border-2 border-rose-500 text-rose-900'
                                : 'bg-rose-50/50 border border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500'
                            }`}
                          />
                        </div>
                        {isInsufficient && (
                          <div className="text-[10px] text-rose-600 font-bold mt-0.5 text-right flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Stok kurang! (Sisa {row.item?.stok})
                          </div>
                        )}
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Button Tambah Baris */}
          <div className="pt-1 flex justify-start">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              + Tambah Baris Barang Keluar
            </button>
          </div>
        </div>

        {/* Tombol Save dipaling bawah */}
        <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            Total {rows.filter(r => r.item && Number(r.qty) > 0).length} item siap dikeluarkan.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              SIMPAN BARANG KELUAR
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
