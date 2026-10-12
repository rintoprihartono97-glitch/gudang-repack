import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { NavLink } from '../Navigation/NavLink';
import { formatToDDMMYYYY } from '../../utils/date';
import { exportTransactionsToExcel } from '../../utils/excel';
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  ArrowDownLeft, 
  ArrowUpRight,
  History,
  FileText
} from 'lucide-react';

export const RiwayatStokView: React.FC = () => {
  const { transactions, locations } = useInventory();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 35;

  // Flatten transactions per row
  const flattenedRows = useMemo(() => {
    const list: Array<{
      txId: string;
      tanggal: string;
      noDokumen: string;
      type: 'IN' | 'OUT';
      keterangan: string;
      itemId: string;
      kode: string;
      nama: string;
      satuan: string;
      lokasi: string;
      qty: number;
      stokSebelum: number;
      stokSesudah: number;
      createdAt: string;
    }> = [];

    transactions.forEach(tx => {
      // Filter by Date
      if (startDate && tx.tanggal < startDate) return;
      if (endDate && tx.tanggal > endDate) return;

      // Filter by Type
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return;

      tx.items.forEach(it => {
        // Filter by Location
        if (selectedLocation !== 'ALL' && it.lokasi !== selectedLocation) return;

        // Filter by Search Query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchDoc = tx.noDokumen.toLowerCase().includes(q);
          const matchKet = (tx.keterangan || '').toLowerCase().includes(q);
          const matchKode = (it.kode || '').toLowerCase().includes(q);
          const matchNama = it.nama.toLowerCase().includes(q);

          if (!matchDoc && !matchKet && !matchKode && !matchNama) return;
        }

        list.push({
          txId: tx.id,
          tanggal: tx.tanggal,
          noDokumen: tx.noDokumen,
          type: tx.type,
          keterangan: tx.keterangan,
          itemId: it.itemId,
          kode: it.kode,
          nama: it.nama,
          satuan: it.satuan,
          lokasi: it.lokasi,
          qty: it.qty,
          stokSebelum: it.stokSebelum,
          stokSesudah: it.stokSesudah,
          createdAt: tx.createdAt
        });
      });
    });

    // Sort by date descending
    return list.sort((a, b) => {
      if (a.tanggal !== b.tanggal) {
        return b.tanggal.localeCompare(a.tanggal);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [transactions, startDate, endDate, typeFilter, selectedLocation, searchQuery]);

  // Statistics from filtered rows
  const totalQtyMasuk = flattenedRows
    .filter(r => r.type === 'IN')
    .reduce((sum, r) => sum + r.qty, 0);

  const totalQtyKeluar = flattenedRows
    .filter(r => r.type === 'OUT')
    .reduce((sum, r) => sum + r.qty, 0);

  const uniqueDocCount = new Set(flattenedRows.map(r => r.noDokumen)).size;

  const totalPages = Math.ceil(flattenedRows.length / itemsPerPage) || 1;
  const paginatedRows = flattenedRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    // Reconstruct transactions matching filter
    const matchedTxIds = new Set(flattenedRows.map(r => r.txId));
    const matchedTxs = transactions.filter(t => matchedTxIds.has(t.id));
    exportTransactionsToExcel(matchedTxs, 'Laporan_Riwayat_Stok_Gudang_Repack.xlsx');
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('ALL');
    setSelectedLocation('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              5. Laporan / Riwayat Stok
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Laporan keluar masuk barang komprehensif dengan filter per tanggal dan ekspor Excel.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs self-start md:self-auto transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
          Ekspor Laporan .xlsx
        </button>
      </div>

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-emerald-700" />
            Filter Laporan Stok
          </span>
          {(startDate || endDate || typeFilter !== 'ALL' || selectedLocation !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Dari Tanggal */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Dari Tanggal (dd-mm-yyyy)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500"
            />
            {startDate && (
              <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
                {formatToDDMMYYYY(startDate)}
              </span>
            )}
          </div>

          {/* Sampai Tanggal */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              Sampai Tanggal (dd-mm-yyyy)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500"
            />
            {endDate && (
              <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
                {formatToDDMMYYYY(endDate)}
              </span>
            )}
          </div>

          {/* Jenis Transaksi */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Jenis Transaksi
            </label>
            <select
              value={typeFilter}
              onChange={e => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua (Masuk & Keluar)</option>
              <option value="IN">Barang Masuk Saja</option>
              <option value="OUT">Barang Keluar Saja</option>
            </select>
          </div>

          {/* Lokasi */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Lokasi Barang
            </label>
            <select
              value={selectedLocation}
              onChange={e => {
                setSelectedLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Lokasi</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Cari Keyword */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Cari No Dokumen / Barang
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="No Dok, nama, kode..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Total Baris:</span>
            <strong className="text-gray-900 font-bold">{flattenedRows.length}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Dokumen Unik:</span>
            <strong className="text-gray-900 font-bold">{uniqueDocCount}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span>Total Qty Masuk:</span>
            <strong className="font-extrabold">+{totalQtyMasuk}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-rose-700">
            <span>Total Qty Keluar:</span>
            <strong className="font-extrabold">-{totalQtyKeluar}</strong>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 w-28 whitespace-nowrap">Tanggal (dd-mm-yyyy)</th>
                <th className="py-3 px-3 w-36 whitespace-nowrap">No Document</th>
                <th className="py-3 px-3 min-w-[150px]">Keterangan</th>
                <th className="py-3 px-3 w-24">Kode</th>
                <th className="py-3 px-3 min-w-[180px]">Nama Barang</th>
                <th className="py-3 px-3 w-20">Satuan</th>
                <th className="py-3 px-3 w-28">Lokasi</th>
                <th className="py-3 px-3 text-right w-24 text-emerald-700 font-bold whitespace-nowrap">Masuk</th>
                <th className="py-3 px-3 text-right w-24 text-rose-700 font-bold whitespace-nowrap">Keluar</th>
                <th className="py-3 px-3 text-right w-24 text-gray-600 whitespace-nowrap">Stok Sebelum</th>
                <th className="py-3 px-3 text-right w-24 text-gray-900 font-bold whitespace-nowrap">Stok Saat Ini</th>
                <th className="py-3 px-2 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-400">
                    Tidak ada riwayat mutasi stok pada rentang filter ini.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={`${row.txId}_${index}`} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-gray-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-700 font-medium whitespace-nowrap">
                        {formatToDDMMYYYY(row.tanggal)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-900 whitespace-nowrap">
                        {row.noDokumen}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate" title={row.keterangan}>
                        {row.keterangan || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">
                        {row.kode || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {row.nama}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {row.satuan}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {row.lokasi}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                        {row.type === 'IN' ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60">
                            +{row.qty}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                        {row.type === 'OUT' ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-rose-700 bg-rose-50 border border-rose-200/60">
                            -{row.qty}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 font-mono whitespace-nowrap">
                        {row.stokSebelum}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono whitespace-nowrap">
                        {row.stokSesudah}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <NavLink
                          href={`#/kartu-stok?id=${row.itemId}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-semibold transition-colors"
                          title="Buka Kartu Stok Barang ini (Bisa buka tab baru)"
                        >
                          Kartu Stok
                        </NavLink>
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
              Halaman {currentPage} dari {totalPages} ({flattenedRows.length} total baris)
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
    </div>
  );
};
