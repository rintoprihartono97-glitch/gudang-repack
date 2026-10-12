import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { NavLink } from '../Navigation/NavLink';
import { Item } from '../../types';
import { formatToDDMMYYYY } from '../../utils/date';
import { exportKartuStokToExcel } from '../../utils/excel';
import { 
  PackageSearch, 
  Package, 
  MapPin, 
  Calendar, 
  FileSpreadsheet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History,
  Tag,
  Search,
  ExternalLink
} from 'lucide-react';

interface KartuStokViewProps {
  initialItemId?: string;
}

export const KartuStokView: React.FC<KartuStokViewProps> = ({ initialItemId }) => {
  const { items, transactions } = useInventory();

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<Item | null>(() => {
    if (initialItemId) {
      const found = items.find(i => i.id === initialItemId);
      if (found) return found;
    }
    return items[0] || null;
  });

  const [searchVal, setSearchVal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // When initialItemId changes (e.g. user opens a link with specific id in url)
  useEffect(() => {
    if (initialItemId) {
      const found = items.find(i => i.id === initialItemId);
      if (found) {
        setSelectedItem(found);
      }
    }
  }, [initialItemId, items]);

  // Compute ledger entries for selected item
  const ledgerEntries = useMemo(() => {
    if (!selectedItem) return [];

    const entries: Array<{
      txId: string;
      tanggal: string;
      noDokumen: string;
      jenis: 'MASUK' | 'KELUAR';
      keterangan: string;
      masuk: number;
      keluar: number;
      stokSebelum: number;
      stokSesudah: number;
      createdAt: string;
    }> = [];

    transactions.forEach(tx => {
      // Date filter
      if (startDate && tx.tanggal < startDate) return;
      if (endDate && tx.tanggal > endDate) return;

      const itemEntry = tx.items.find(it => it.itemId === selectedItem.id);
      if (itemEntry) {
        entries.push({
          txId: tx.id,
          tanggal: tx.tanggal,
          noDokumen: tx.noDokumen,
          jenis: tx.type === 'IN' ? 'MASUK' : 'KELUAR',
          keterangan: tx.keterangan || '-',
          masuk: tx.type === 'IN' ? itemEntry.qty : 0,
          keluar: tx.type === 'OUT' ? itemEntry.qty : 0,
          stokSebelum: itemEntry.stokSebelum,
          stokSesudah: itemEntry.stokSesudah,
          createdAt: tx.createdAt
        });
      }
    });

    // Sort by date ascending to show realistic timeline progression
    return entries.sort((a, b) => {
      if (a.tanggal !== b.tanggal) {
        return a.tanggal.localeCompare(b.tanggal);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [selectedItem, transactions, startDate, endDate]);

  const totalMasuk = ledgerEntries.reduce((acc, curr) => acc + curr.masuk, 0);
  const totalKeluar = ledgerEntries.reduce((acc, curr) => acc + curr.keluar, 0);

  const handleExport = () => {
    if (!selectedItem) return;
    const formatted = ledgerEntries.map(e => ({
      tanggal: formatToDDMMYYYY(e.tanggal),
      noDokumen: e.noDokumen,
      keterangan: e.keterangan,
      masuk: e.masuk,
      keluar: e.keluar,
      stokSebelum: e.stokSebelum,
      stokSaatIni: e.stokSesudah,
      sisa: e.stokSesudah
    }));

    exportKartuStokToExcel(selectedItem, formatted);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              6. Kartu Stok Masing-masing Barang
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Buku besar mutasi detail per item barang dengan histori keluar masuk dan saldo stok.
            </p>
          </div>
        </div>

        {selectedItem && (
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs self-start md:self-auto transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            Ekspor Kartu Stok .xlsx
          </button>
        )}
      </div>

      {/* Item Selector Autocomplete Box */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-4 h-4 text-emerald-700" />
          Pilih / Ganti Barang (Gunakan Arrow Keyboard & Enter):
        </label>
        <div className="max-w-xl">
          <ItemAutocomplete
            value={searchVal}
            onChange={setSearchVal}
            onSelectItem={item => {
              setSelectedItem(item);
              setSearchVal('');
              // Update URL hash without breaking SPA history
              window.location.hash = `#/kartu-stok?id=${item.id}`;
            }}
            placeholder="Ketik nama atau kode barang untuk melihat kartu stok..."
            size="md"
          />
        </div>
      </div>

      {/* Selected Item Profile Banner */}
      {selectedItem ? (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-mono font-bold">
                  KODE: {selectedItem.kode || 'TANPA KODE'}
                </span>
                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  {selectedItem.lokasi}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {selectedItem.nama}
              </h2>
              <div className="text-xs text-gray-500">
                Satuan: <strong className="text-gray-800">{selectedItem.satuan}</strong>
              </div>
            </div>

            {/* Quick Stats on Item */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl min-w-[120px]">
                <div className="text-[11px] text-emerald-700 font-semibold">Stok Terkini</div>
                <div className="text-2xl font-black text-emerald-900 mt-0.5">
                  {selectedItem.stok} <span className="text-xs font-normal text-emerald-700">{selectedItem.satuan}</span>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl min-w-[100px]">
                <div className="text-[11px] text-gray-500 font-medium">Total Masuk</div>
                <div className="text-lg font-bold text-emerald-700 mt-0.5">
                  +{totalMasuk}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl min-w-[100px]">
                <div className="text-[11px] text-gray-500 font-medium">Total Keluar</div>
                <div className="text-lg font-bold text-rose-700 mt-0.5">
                  -{totalKeluar}
                </div>
              </div>
            </div>
          </div>

          {/* Date Filter for Ledger */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-600">Filter Tanggal Kartu:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs"
              />
              <span className="text-gray-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-rose-600 hover:text-rose-700 font-semibold ml-2"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="text-gray-500">
              Menampilkan {ledgerEntries.length} catatan mutasi
            </div>
          </div>

          {/* Ledger Table */}
          <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Tanggal</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">No Document</th>
                  <th className="py-2.5 px-2.5">Keterangan</th>
                  <th className="py-2.5 px-2.5 text-right text-emerald-700 font-bold whitespace-nowrap">Masuk</th>
                  <th className="py-2.5 px-2.5 text-right text-rose-700 font-bold whitespace-nowrap">Keluar</th>
                  <th className="py-2.5 px-2.5 text-right text-gray-600 whitespace-nowrap">Stok Sebelum</th>
                  <th className="py-2.5 px-2.5 text-right text-gray-900 font-bold whitespace-nowrap">Stok Saat Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      Belum ada transaksi keluar/masuk yang tercatat untuk item ini.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((row, idx) => (
                    <tr key={`${row.txId}_${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-2.5 text-center text-gray-400 font-mono font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-gray-700 font-medium whitespace-nowrap">
                        {formatToDDMMYYYY(row.tanggal)}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-semibold text-emerald-900 whitespace-nowrap">
                        {row.noDokumen}
                      </td>
                      <td className="py-2 px-2.5 text-gray-600 max-w-xs truncate" title={row.keterangan}>
                        {row.keterangan}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap">
                        {row.masuk > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60">
                            +{row.masuk}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap">
                        {row.keluar > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-rose-700 bg-rose-50 border border-rose-200/60">
                            -{row.keluar}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-gray-600 whitespace-nowrap">
                        {row.stokSebelum}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                        {row.stokSesudah}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400">
          Silakan pilih barang pada kotak pencarian di atas untuk melihat kartu stok.
        </div>
      )}
    </div>
  );
};
