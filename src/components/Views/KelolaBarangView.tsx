import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { NavLink } from '../Navigation/NavLink';
import { Item } from '../../types';
import { exportItemsToExcel } from '../../utils/excel';
import { 
  FileEdit, 
  Trash2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Save,
  ArrowUpDown,
  History,
  Layers
} from 'lucide-react';

export const KelolaBarangView: React.FC = () => {
  const { items, updateItem, deleteItem, locations, units } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'ZERO' | 'LOW' | 'AVAILABLE'>('ALL');
  const [sortBy, setSortBy] = useState<'nama' | 'kode' | 'stok'>('nama');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editKode, setEditKode] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editSatuan, setEditSatuan] = useState('');
  const [editLokasi, setEditLokasi] = useState('');
  const [editStok, setEditStok] = useState<number | ''>('');

  // Delete Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchTerm.toLowerCase();
      const matchSearch = 
        (item.kode || '').toLowerCase().includes(q) ||
        (item.nama || '').toLowerCase().includes(q);

      const matchLocation = selectedLocation === 'ALL' || item.lokasi === selectedLocation;

      let matchStock = true;
      if (stockFilter === 'ZERO') matchStock = item.stok === 0;
      else if (stockFilter === 'LOW') matchStock = item.stok > 0 && item.stok <= 5;
      else if (stockFilter === 'AVAILABLE') matchStock = item.stok > 5;

      return matchSearch && matchLocation && matchStock;
    }).sort((a, b) => {
      let valA: any = a[sortBy] ?? '';
      let valB: any = b[sortBy] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, selectedLocation, stockFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setEditKode(item.kode || '');
    setEditNama(item.nama);
    setEditSatuan(item.satuan);
    setEditLokasi(item.lokasi);
    setEditStok(item.stok);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editNama.trim()) {
      alert('Nama barang tidak boleh kosong.');
      return;
    }

    const finalStok = editStok === '' ? 0 : Number(editStok);

    updateItem(editingItem.id, {
      kode: editKode.trim(),
      nama: editNama.trim(),
      satuan: editSatuan.trim(),
      lokasi: editLokasi.trim(),
      stok: finalStok
    });

    showToast(`Data barang "${editNama}" berhasil diperbarui.`);
    setEditingItem(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteItem(deletingItem.id);
    showToast(`Barang "${deletingItem.nama}" berhasil dihapus.`);
    setDeletingItem(null);
  };

  const handleExport = () => {
    exportItemsToExcel(filteredItems, 'Katalog_Barang_Gudang_Repack.xlsx');
  };

  const toggleSort = (field: 'nama' | 'kode' | 'stok') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <FileEdit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              4. Edit / Hapus Barang
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Kelola katalog data barang, penyesuaian jumlah stok, lokasi penempatan, dan penghapusan item.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs self-start md:self-auto transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
          Ekspor Daftar .xlsx
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau kode barang..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter Lokasi */}
          <select
            value={selectedLocation}
            onChange={e => {
              setSelectedLocation(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="ALL">Semua Lokasi ({locations.length})</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {/* Filter Stok Status */}
          <select
            value={stockFilter}
            onChange={e => {
              setStockFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="ALL">Semua Status Stok</option>
            <option value="ZERO">Stok Kosong (0)</option>
            <option value="LOW">Stok Menipis (1 - 5)</option>
            <option value="AVAILABLE">Stok Aman (&gt; 5)</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Ditemukan: <strong className="text-gray-800">{filteredItems.length}</strong> barang
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th
                  onClick={() => toggleSort('kode')}
                  className="py-3 px-3 cursor-pointer hover:bg-gray-200/80 transition-colors w-36"
                >
                  <div className="flex items-center gap-1">
                    <span>Kode</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nama')}
                  className="py-3 px-3 cursor-pointer hover:bg-gray-200/80 transition-colors min-w-[240px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Barang</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="py-3 px-3 w-28">Satuan</th>
                <th className="py-3 px-3 w-40">Lokasi</th>
                <th
                  onClick={() => toggleSort('stok')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-gray-200/80 transition-colors w-32"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Stok</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center w-28">Status</th>
                <th className="py-3 px-3 text-center w-36">Aksi Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Tidak ada barang yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-gray-400 font-mono">
                        {globalIndex}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-gray-700">
                        {item.kode || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {item.nama}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {item.satuan}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {item.lokasi}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black font-mono text-gray-900">
                        {item.stok}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.stok === 0
                              ? 'bg-rose-100 text-rose-800'
                              : item.stok <= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.stok === 0 ? 'KOSONG' : item.stok <= 5 ? 'MENIPIS' : 'AMAN'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Native Link to Kartu Stok with ID supporting new tab */}
                          <NavLink
                            href={`#/kartu-stok?id=${item.id}`}
                            className="p-1.5 bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 rounded-lg transition-colors"
                            title="Buka Kartu Stok (bisa klik kanan buka tab baru)"
                          >
                            <History className="w-3.5 h-3.5" />
                          </NavLink>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg transition-colors"
                            title="Edit Barang"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-700 rounded-lg transition-colors"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Halaman {currentPage} dari {totalPages} ({filteredItems.length} total barang)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileEdit className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Edit Data Barang</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-emerald-200 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kode Barang</label>
                <input
                  type="text"
                  value={editKode}
                  onChange={e => setEditKode(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Barang *</label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={e => setEditNama(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Satuan</label>
                  <select
                    value={editSatuan}
                    onChange={e => setEditSatuan(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    {units.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lokasi</label>
                  <select
                    value={editLokasi}
                    onChange={e => setEditLokasi(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Penyesuaian Stok Fisik
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editStok}
                  onChange={e => setEditStok(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2 text-sm font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Ubah angka jika ada penyesuaian stock opname langsung.
                </span>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-rose-200 overflow-hidden animate-in fade-in duration-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-3 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">Konfirmasi Hapus Barang</h3>
                <p className="text-xs text-gray-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
              <div><strong>Kode:</strong> {deletingItem.kode || '-'}</div>
              <div><strong>Nama:</strong> {deletingItem.nama}</div>
              <div><strong>Lokasi:</strong> {deletingItem.lokasi}</div>
              <div><strong>Stok:</strong> {deletingItem.stok} {deletingItem.satuan}</div>
            </div>

            <p className="text-xs text-gray-600">
              Apakah Anda yakin ingin menghapus barang ini dari katalog gudang?
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
