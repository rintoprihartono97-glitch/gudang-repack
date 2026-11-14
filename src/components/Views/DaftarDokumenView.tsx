import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { NavLink } from '../Navigation/NavLink';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { formatToDDMMYYYY } from '../../utils/date';
import { exportTransactionsToExcel } from '../../utils/excel';
import { Item, StockTransaction } from '../../types';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  History
} from 'lucide-react';

interface EditDocRow {
  rowId: string;
  item: Item | null;
  namaInput: string;
  qty: number | '';
}

export const DaftarDokumenView: React.FC = () => {
  const { items, transactions, updateTransaction } = useInventory();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected document window (hasil input + edit)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form states
  const [editTanggal, setEditTanggal] = useState('');
  const [editNoDokumen, setEditNoDokumen] = useState('');
  const [editKeteranganOption, setEditKeteranganOption] = useState('');
  const [editCustomKeterangan, setEditCustomKeterangan] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');
  const [editRows, setEditRows] = useState<EditDocRow[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => {
    return transactions
      .filter(tx => {
        if (startDate && tx.tanggal < startDate) return false;
        if (endDate && tx.tanggal > endDate) return false;
        if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchDoc = (tx.noDokumen || '').toLowerCase().includes(q);
          const matchKet = (tx.keterangan || '').toLowerCase().includes(q);
          const matchTgl =
            (tx.tanggal || '').toLowerCase().includes(q) ||
            formatToDDMMYYYY(tx.tanggal).toLowerCase().includes(q);
          const matchItems = tx.items.some(
            it =>
              (it.nama || '').toLowerCase().includes(q) ||
              (it.kode || '').toLowerCase().includes(q)
          );
          if (!matchDoc && !matchKet && !matchTgl && !matchItems) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [transactions, startDate, endDate, typeFilter, searchQuery]);

  const selectedDoc: StockTransaction | null = useMemo(() => {
    if (!selectedDocId) return null;
    return transactions.find(t => t.id === selectedDocId) || null;
  }, [transactions, selectedDocId]);

  const handleOpenDocument = (tx: StockTransaction) => {
    setSelectedDocId(tx.id);
    setIsEditing(false);
    setEditError(null);
  };

  const handleCloseModal = () => {
    setSelectedDocId(null);
    setIsEditing(false);
    setEditError(null);
  };

  const handleStartEdit = (tx: StockTransaction) => {
    const presets =
      tx.type === 'IN'
        ? ['Repack KSB', 'Repack PKL', 'Repack Ulang']
        : ['Untuk Toko', 'Repack Ulang', 'Kiriman Custumer'];

    setEditTanggal(tx.tanggal);
    setEditNoDokumen(tx.noDokumen);

    if (presets.includes(tx.keterangan)) {
      setEditKeteranganOption(tx.keterangan);
      setEditCustomKeterangan('');
      setEditKeterangan(tx.keterangan);
    } else {
      const cleanKet = tx.keterangan === '-' ? '' : tx.keterangan;
      setEditKeteranganOption('isi sendiri');
      setEditCustomKeterangan(cleanKet);
      setEditKeterangan(cleanKet);
    }

    setEditRows(
      tx.items.map((entry, idx) => {
        const matched = items.find(i => i.id === entry.itemId) || {
          id: entry.itemId,
          kode: entry.kode,
          nama: entry.nama,
          satuan: entry.satuan,
          lokasi: entry.lokasi,
          stok: entry.stokSesudah
        };
        return {
          rowId: `edit_row_${tx.id}_${idx}_${Date.now()}`,
          item: matched,
          namaInput: entry.nama,
          qty: entry.qty
        };
      })
    );
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = (tx: StockTransaction) => {
    setEditError(null);

    if (!editNoDokumen.trim()) {
      setEditError('No Document wajib diisi.');
      return;
    }

    const validItems: Array<{ itemId: string; qty: number }> = [];
    for (let i = 0; i < editRows.length; i++) {
      const r = editRows[i];
      if (!r.item) {
        setEditError(`Baris #${i + 1}: Silakan pilih barang terlebih dahulu.`);
        return;
      }
      if (!r.qty || Number(r.qty) <= 0) {
        setEditError(`Baris #${i + 1} (${r.item.nama}): Qty harus lebih dari 0.`);
        return;
      }
      validItems.push({
        itemId: r.item.id,
        qty: Number(r.qty)
      });
    }

    if (validItems.length === 0) {
      setEditError('Minimal harus ada 1 barang dalam dokumen.');
      return;
    }

    const res = updateTransaction(tx.id, {
      type: tx.type,
      tanggal: editTanggal,
      noDokumen: editNoDokumen.trim(),
      keterangan: editKeterangan.trim(),
      items: validItems
    });

    if (!res.success) {
      setEditError(res.error || 'Gagal menyimpan perubahan dokumen.');
      return;
    }

    setIsEditing(false);
    setSuccessMessage(`Dokumen ${editNoDokumen.trim()} berhasil diperbarui dan stok telah disesuaikan.`);
  };

  const handleExport = () => {
    exportTransactionsToExcel(filteredDocuments, 'Daftar_Document_Gudang_Repack.xlsx');
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Daftar Document Transaksi
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Klik baris dokumen untuk melihat hasil input dan melakukan edit data transaksi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavLink
            href="#/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </NavLink>

          <NavLink
            href="#/riwayat-stok"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <History className="w-4 h-4 text-emerald-600" />
            Riwayat Lengkap
          </NavLink>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            Ekspor Excel .xlsx
          </button>
        </div>
      </div>

      {/* Success Toast Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-emerald-700" />
            Filter Daftar Document ({filteredDocuments.length} dokumen)
          </span>
          {(startDate || endDate || typeFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Jenis Document
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT')}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua (Masuk & Keluar)</option>
              <option value="IN">Masuk (IN)</option>
              <option value="OUT">Keluar (OUT)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Cari Document / Keterangan / Barang
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="No Document, keterangan, barang..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Document List Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                <th className="py-3 px-4 whitespace-nowrap">No Document</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Total Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    Belum ada dokumen transaksi yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map(tx => {
                  const totalQtyDoc = tx.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
                  const isActive = selectedDocId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => handleOpenDocument(tx)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-emerald-50/80' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-gray-700 whitespace-nowrap">
                        {formatToDDMMYYYY(tx.tanggal)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900">
                            {tx.noDokumen}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type === 'IN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {tx.type === 'IN' ? 'Masuk' : 'Keluar'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {tx.keterangan || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded font-bold ${
                            tx.type === 'IN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {tx.type === 'IN' ? `+${totalQtyDoc}` : `-${totalQtyDoc}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Window Detail Hasil Input & Edit Document */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                    selectedDoc.type === 'IN'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {selectedDoc.type === 'IN' ? 'Hasil Input Masuk' : 'Hasil Input Keluar'}
                </span>
                <span className="font-mono font-bold text-sm sm:text-base">
                  {selectedDoc.noDokumen}
                </span>
                <span className="text-emerald-200 text-xs">
                  ({formatToDDMMYYYY(selectedDoc.tanggal)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(selectedDoc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-extrabold shadow-xs transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditError(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(selectedDoc)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-lg text-xs font-extrabold shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Perubahan
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {editError && isEditing && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="font-medium">{editError}</span>
                </div>
              )}

              {!isEditing ? (
                /* VIEW MODE: HASIL INPUT */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Tanggal</span>
                      <strong className="font-mono text-gray-900">{formatToDDMMYYYY(selectedDoc.tanggal)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">No Document</span>
                      <strong className="font-mono text-gray-900">{selectedDoc.noDokumen}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Keterangan</span>
                      <strong className="text-gray-900">{selectedDoc.keterangan || '-'}</strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">Kode Barang</th>
                          <th className="py-2.5 px-3">Nama Barang</th>
                          <th className="py-2.5 px-3 text-center">Satuan</th>
                          <th className="py-2.5 px-3">Lokasi</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Stok Sebelum</th>
                          <th className="py-2.5 px-3 text-right">Stok Sesudah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedDoc.items.map((it, idx) => (
                          <tr key={`${selectedDoc.id}_it_${idx}`} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-700">{it.kode || '-'}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-900">{it.nama}</td>
                            <td className="py-2.5 px-3 text-center text-gray-600">{it.satuan}</td>
                            <td className="py-2.5 px-3 text-gray-600">{it.lokasi}</td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              <span className={selectedDoc.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}>
                                {selectedDoc.type === 'IN' ? `+${it.qty}` : `-${it.qty}`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-gray-500">{it.stokSebelum}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{it.stokSesudah}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* EDIT MODE */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={editTanggal}
                        onChange={e => setEditTanggal(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">No Document</label>
                      <input
                        type="text"
                        value={editNoDokumen}
                        onChange={e => setEditNoDokumen(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Keterangan</label>
                      <select
                        value={editKeteranganOption}
                        onChange={e => {
                          const val = e.target.value;
                          setEditKeteranganOption(val);
                          if (val === 'isi sendiri') {
                            setEditKeterangan(editCustomKeterangan);
                          } else {
                            setEditKeterangan(val);
                          }
                        }}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- Pilih Keterangan --</option>
                        {selectedDoc.type === 'IN' ? (
                          <>
                            <option value="Repack KSB">Repack KSB</option>
                            <option value="Repack PKL">Repack PKL</option>
                            <option value="Repack Ulang">Repack Ulang</option>
                          </>
                        ) : (
                          <>
                            <option value="Untuk Toko">Untuk Toko</option>
                            <option value="Repack Ulang">Repack Ulang</option>
                            <option value="Kiriman Custumer">Kiriman Custumer</option>
                          </>
                        )}
                        <option value="isi sendiri">isi sendiri</option>
                      </select>
                      {editKeteranganOption === 'isi sendiri' && (
                        <input
                          type="text"
                          value={editCustomKeterangan}
                          onChange={e => {
                            setEditCustomKeterangan(e.target.value);
                            setEditKeterangan(e.target.value);
                          }}
                          placeholder="Ketik keterangan sendiri..."
                          className="mt-1.5 w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">No</th>
                          <th className="py-2 px-3 min-w-[220px]">Nama Barang</th>
                          <th className="py-2 px-3 text-center">Satuan</th>
                          <th className="py-2 px-3">Lokasi</th>
                          <th className="py-2 px-3 text-right w-28">Qty</th>
                          <th className="py-2 px-3 text-center w-14">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {editRows.map((r, rIdx) => (
                          <tr key={r.rowId}>
                            <td className="py-2 px-3 text-center text-gray-400 font-mono">{rIdx + 1}</td>
                            <td className="py-2 px-3">
                              <ItemAutocomplete
                                value={r.namaInput}
                                onChange={val => {
                                  setEditRows(prev =>
                                    prev.map((row, idx) =>
                                      idx === rIdx ? { ...row, namaInput: val, item: null } : row
                                    )
                                  );
                                }}
                                onSelectItem={selected => {
                                  setEditRows(prev =>
                                    prev.map((row, idx) =>
                                      idx === rIdx ? { ...row, item: selected, namaInput: selected.nama } : row
                                    )
                                  );
                                }}
                                placeholder="Cari nama / kode barang..."
                                size="sm"
                              />
                            </td>
                            <td className="py-2 px-3 text-center text-gray-600">
                              {r.item?.satuan || '-'}
                            </td>
                            <td className="py-2 px-3 text-gray-600">
                              {r.item?.lokasi || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={r.qty}
                                onChange={e => {
                                  const val =
                                    e.target.value === ''
                                      ? ''
                                      : Math.max(0, parseFloat(e.target.value) || 0);
                                  setEditRows(prev =>
                                    prev.map((row, idx) => (idx === rIdx ? { ...row, qty: val } : row))
                                  );
                                }}
                                className="w-full text-right bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editRows.length <= 1) return;
                                  setEditRows(prev => prev.filter((_, idx) => idx !== rIdx));
                                }}
                                disabled={editRows.length <= 1}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded disabled:opacity-30"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRows(prev => [
                          ...prev,
                          {
                            rowId: `edit_row_${Date.now()}_${Math.random()}`,
                            item: null,
                            namaInput: '',
                            qty: ''
                          }
                        ]);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Baris
                    </button>

                    <span className="text-xs text-gray-500">
                      Total Qty:{' '}
                      <strong className="text-gray-900">
                        {editRows.reduce((s, r) => s + (typeof r.qty === 'number' ? r.qty : 0), 0)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
