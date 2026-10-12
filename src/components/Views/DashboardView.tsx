import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { NavLink } from '../Navigation/NavLink';
import { exportItemsToExcel } from '../../utils/excel';
import { Item } from '../../types';
import { 
  Package, 
  MapPin, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileSpreadsheet, 
  TrendingUp, 
  Layers, 
  History, 
  CheckCircle2, 
  ChevronRight,
  PlusCircle,
  Database,
  Search,
  Filter
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { items, transactions, locations } = useInventory();
  const [filterMode, setFilterMode] = useState<'ALL' | 'EMPTY' | 'LOCATION' | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Stats calculation
  const totalBarang = items.length;
  const totalLokasi = locations.length;
  const barangKosong = items.filter(i => i.stok === 0);
  const barangMenipis = items.filter(i => i.stok > 0 && i.stok <= 5);

  const totalMasukTx = transactions.filter(t => t.type === 'IN').length;
  const totalKeluarTx = transactions.filter(t => t.type === 'OUT').length;

  // Fast Moving Goods computation
  // Calculate movement frequency and total units out
  const fastMovingMap = new Map<string, {
    item: Item;
    txCount: number;
    totalQtyOut: number;
    totalQtyIn: number;
  }>();

  // Populate map with all items
  items.forEach(it => {
    fastMovingMap.set(it.id, {
      item: it,
      txCount: 0,
      totalQtyOut: 0,
      totalQtyIn: 0
    });
  });

  transactions.forEach(tx => {
    tx.items.forEach(itemEntry => {
      const existing = fastMovingMap.get(itemEntry.itemId);
      if (existing) {
        existing.txCount += 1;
        if (tx.type === 'OUT') {
          existing.totalQtyOut += itemEntry.qty;
        } else {
          existing.totalQtyIn += itemEntry.qty;
        }
      }
    });
  });

  // Sort by highest outbound qty first, then by txCount
  const fastMovingList = Array.from(fastMovingMap.values())
    .filter(entry => entry.txCount > 0 || entry.totalQtyOut > 0)
    .sort((a, b) => b.totalQtyOut - a.totalQtyOut || b.txCount - a.txCount)
    .slice(0, 10);

  // Fast moving items based strictly on actual outbound transactions
  const displayFastMoving = fastMovingList;

  // Filtered items when user clicks stat cards
  const displayedItems = React.useMemo(() => {
    let list = items;
    if (filterMode === 'EMPTY') {
      list = barangKosong;
    } else if (filterMode === 'LOCATION' && selectedLocation) {
      list = list.filter(i => i.lokasi === selectedLocation);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(i => 
        (i.kode || '').toLowerCase().includes(q) ||
        (i.nama || '').toLowerCase().includes(q) ||
        (i.lokasi || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filterMode, selectedLocation, searchTerm, barangKosong]);

  const handleExportAll = () => {
    exportItemsToExcel(items, 'Katalog_Stok_Gudang_Repack.xlsx');
  };

  const handleExportFiltered = () => {
    const filename = filterMode === 'EMPTY' 
      ? 'Daftar_Barang_Kosong.xlsx' 
      : filterMode === 'LOCATION'
      ? `Stok_Lokasi_${selectedLocation.replace(/\s+/g, '_')}.xlsx`
      : 'Data_Barang_Gudang.xlsx';
    exportItemsToExcel(displayedItems, filename);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & Excel Action Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sistem Informasi Gudang Aktif
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
            Dashboard Gudang Repack
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manajemen stok keluar masuk barang, pemantauan ketersediaan, dan kartu stok.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow-md transition-all active:scale-95"
            title="Ekspor Seluruh Data Barang ke Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            Ekspor Excel .xlsx
          </button>

          <NavLink
            href="#/backup-restore"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            title="Kelola & Sinkronkan ke Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Google Sheets
          </NavLink>

          <NavLink
            href="#/barang-masuk"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            + Barang Masuk
          </NavLink>

          <NavLink
            href="#/barang-keluar"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            - Barang Keluar
          </NavLink>
        </div>
      </div>

      {/* Dashboard Stat Cards with Hover & Click Animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Barang */}
        <div
          onClick={() => {
            setFilterMode(filterMode === 'ALL' ? null : 'ALL');
            setSelectedLocation('');
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] ${
            filterMode === 'ALL'
              ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500'
              : 'bg-white hover:border-emerald-300 text-gray-900 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              filterMode === 'ALL' ? 'text-emerald-200' : 'text-gray-500'
            }`}>
              Total Barang
            </span>
            <div className={`p-2 rounded-xl ${
              filterMode === 'ALL' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{totalBarang}</span>
            <span className={`text-xs ${filterMode === 'ALL' ? 'text-emerald-200' : 'text-gray-500'}`}>
              SKU Terdaftar
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-xs">
            <span className={filterMode === 'ALL' ? 'text-emerald-100' : 'text-emerald-700 font-medium'}>
              {filterMode === 'ALL' ? 'Sedang ditampilkan' : 'Klik untuk lihat semua data'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Total Lokasi */}
        <div
          onClick={() => {
            setFilterMode(filterMode === 'LOCATION' ? null : 'LOCATION');
            if (!selectedLocation && locations.length > 0) {
              setSelectedLocation(locations[0]);
            }
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] ${
            filterMode === 'LOCATION'
              ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500'
              : 'bg-white hover:border-emerald-300 text-gray-900 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              filterMode === 'LOCATION' ? 'text-emerald-200' : 'text-gray-500'
            }`}>
              Total Lokasi
            </span>
            <div className={`p-2 rounded-xl ${
              filterMode === 'LOCATION' ? 'bg-emerald-800 text-emerald-100' : 'bg-blue-50 text-blue-700'
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{totalLokasi}</span>
            <span className={`text-xs ${filterMode === 'LOCATION' ? 'text-emerald-200' : 'text-gray-500'}`}>
              Gudang & Toko
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-xs">
            <span className={filterMode === 'LOCATION' ? 'text-emerald-100' : 'text-blue-700 font-medium'}>
              {filterMode === 'LOCATION' ? 'Filter per lokasi aktif' : 'Klik untuk filter lokasi'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Barang Kosong (Stok 0) */}
        <div
          onClick={() => {
            setFilterMode(filterMode === 'EMPTY' ? null : 'EMPTY');
            setSelectedLocation('');
          }}
          className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] ${
            filterMode === 'EMPTY'
              ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-500'
              : 'bg-white hover:border-rose-300 text-gray-900 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              filterMode === 'EMPTY' ? 'text-rose-200' : 'text-rose-700'
            }`}>
              Barang Kosong
            </span>
            <div className={`p-2 rounded-xl ${
              filterMode === 'EMPTY' ? 'bg-rose-800 text-rose-100' : 'bg-rose-50 text-rose-700'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-rose-600">{barangKosong.length}</span>
            <span className={`text-xs ${filterMode === 'EMPTY' ? 'text-rose-200' : 'text-gray-500'}`}>
              Stok Habis (0)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-xs">
            <span className={filterMode === 'EMPTY' ? 'text-rose-100' : 'text-rose-700 font-medium'}>
              {filterMode === 'EMPTY' ? 'Menampilkan stok kosong' : 'Klik untuk lihat barang kosong'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Total Riwayat Transaksi */}
        <NavLink
          href="#/riwayat-stok"
          className="rounded-2xl p-5 border bg-white hover:border-emerald-300 text-gray-900 border-gray-200 transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Total Mutasi
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
              <History className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{transactions.length}</span>
            <span className="text-xs text-gray-500">
              Dokumen ({totalMasukTx} In / {totalKeluarTx} Out)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-700 font-medium">
            <span>Buka Riwayat Lengkap</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </NavLink>
      </div>

      {/* Interactive Detail List when any Stat Card is clicked */}
      {filterMode && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                  {filterMode === 'ALL' && 'Semua Barang Terdaftar'}
                  {filterMode === 'EMPTY' && 'Daftar Barang Stok Kosong (0)'}
                  {filterMode === 'LOCATION' && `Daftar Barang di ${selectedLocation || 'Lokasi'}`}
                </span>
                <span className="text-xs text-gray-500">({displayedItems.length} item ditemukan)</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mt-1">
                Rincian Data dari Kartu Statistik
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {filterMode === 'LOCATION' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Pilih Lokasi:</span>
                  <select
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value)}
                    className="text-xs bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 text-gray-800 font-medium"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Saring nama / kode..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none w-44 md:w-56"
                />
              </div>

              <button
                type="button"
                onClick={handleExportFiltered}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ekspor Hasil .xlsx
              </button>

              <button
                type="button"
                onClick={() => setFilterMode(null)}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Kode Barang</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3">Lokasi</th>
                  <th className="py-2.5 px-3 text-right">Stok Saat Ini</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      Tidak ada barang yang memenuhi kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-500 font-mono">{index + 1}</td>
                      <td className="py-2 px-3 font-mono font-medium text-gray-800">{item.kode || '-'}</td>
                      <td className="py-2 px-3 font-semibold text-gray-900">{item.nama}</td>
                      <td className="py-2 px-3 text-gray-600">{item.satuan}</td>
                      <td className="py-2 px-3 text-gray-600">{item.lokasi}</td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold ${
                            item.stok === 0
                              ? 'bg-rose-100 text-rose-800'
                              : item.stok <= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.stok}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <NavLink
                          href={`#/kartu-stok?id=${item.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold transition-colors"
                        >
                          Kartu Stok
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards to Key Menus with Hover Animations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <NavLink
          href="#/barang-masuk"
          className="group p-4 bg-white hover:bg-emerald-700 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-emerald-50 group-hover:bg-emerald-800 rounded-xl text-emerald-700 group-hover:text-white transition-colors mb-2">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Input Masuk</span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-100 mt-0.5">Barang Masuk</span>
        </NavLink>

        <NavLink
          href="#/barang-keluar"
          className="group p-4 bg-white hover:bg-rose-700 rounded-2xl border border-rose-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-rose-50 group-hover:bg-rose-800 rounded-xl text-rose-700 group-hover:text-white transition-colors mb-2">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Input Keluar</span>
          <span className="text-[10px] text-gray-400 group-hover:text-rose-100 mt-0.5">Barang Keluar</span>
        </NavLink>

        <NavLink
          href="#/barang-baru"
          className="group p-4 bg-white hover:bg-emerald-700 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-emerald-50 group-hover:bg-emerald-800 rounded-xl text-emerald-700 group-hover:text-white transition-colors mb-2">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Barang Baru</span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-100 mt-0.5">Daftarkan SKU</span>
        </NavLink>

        <NavLink
          href="#/kelola-barang"
          className="group p-4 bg-white hover:bg-emerald-700 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-emerald-50 group-hover:bg-emerald-800 rounded-xl text-emerald-700 group-hover:text-white transition-colors mb-2">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Edit / Hapus</span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-100 mt-0.5">Kelola Barang</span>
        </NavLink>

        <NavLink
          href="#/riwayat-stok"
          className="group p-4 bg-white hover:bg-emerald-700 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-emerald-50 group-hover:bg-emerald-800 rounded-xl text-emerald-700 group-hover:text-white transition-colors mb-2">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Riwayat Stok</span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-100 mt-0.5">Filter Tanggal</span>
        </NavLink>

        <NavLink
          href="#/backup-restore"
          className="group p-4 bg-white hover:bg-emerald-700 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:-translate-y-1"
        >
          <div className="p-3 bg-emerald-50 group-hover:bg-emerald-800 rounded-xl text-emerald-700 group-hover:text-white transition-colors mb-2">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-gray-800 group-hover:text-white">Backup Data</span>
          <span className="text-[10px] text-gray-400 group-hover:text-emerald-100 mt-0.5">Import / Export</span>
        </NavLink>
      </div>

      {/* Requirement 17: Tampilkan Paling Bawah Dashboard "BARANG FAST MOVING" agar saya bisa mengetahui */}
      <div className="bg-white rounded-2xl shadow-xs border border-emerald-100 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">
                  Barang Fast Moving
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase rounded-full">
                  Paling Cepat Bergerak
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Daftar barang dengan frekuensi keluar-masuk dan pengeluaran volume paling aktif.
              </p>
            </div>
          </div>

          {displayFastMoving.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const dataToExport = displayFastMoving.map(m => m.item);
                exportItemsToExcel(dataToExport, 'Barang_Fast_Moving_Gudang_Repack.xlsx');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold self-start sm:self-auto transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              Ekspor Fast Moving .xlsx
            </button>
          )}
        </div>

        {displayFastMoving.length === 0 ? (
          <div className="py-8 px-4 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-xl">
            <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">
              Belum ada transaksi keluar/masuk yang tercatat
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Daftar barang fast moving akan muncul secara otomatis setelah Anda menginput barang keluar pada menu Input Barang Keluar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-700 font-semibold">
                <tr>
                  <th className="py-3 px-3">Peringkat</th>
                  <th className="py-3 px-3">Kode Barang</th>
                  <th className="py-3 px-3">Nama Barang</th>
                  <th className="py-3 px-3">Satuan</th>
                  <th className="py-3 px-3">Lokasi</th>
                  <th className="py-3 px-3 text-center">Frekuensi Mutasi</th>
                  <th className="py-3 px-3 text-right">Total Keluar</th>
                  <th className="py-3 px-3 text-right">Stok Sekarang</th>
                  <th className="py-3 px-3 text-center">Kartu Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayFastMoving.map((entry, idx) => (
                  <tr key={entry.item.id} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-gray-700">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                        idx === 0
                          ? 'bg-amber-400 text-amber-950 shadow-xs'
                          : idx === 1
                          ? 'bg-gray-200 text-gray-800'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-gray-800">
                      {entry.item.kode || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      {entry.item.nama}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {entry.item.satuan}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {entry.item.lokasi}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium">
                        {entry.txCount} kali
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      {entry.totalQtyOut} {entry.item.satuan}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                      {entry.item.stok}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <NavLink
                        href={`#/kartu-stok?id=${entry.item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold shadow-2xs transition-colors"
                      >
                        Buka Kartu
                      </NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
