import React from 'react';
import { Item } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { NavLink } from '../Navigation/NavLink';
import { formatToDDMMYYYY } from '../../utils/date';
import { exportKartuStokToExcel } from '../../utils/excel';
import { 
  X, 
  Package, 
  MapPin, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileSpreadsheet, 
  History,
  ExternalLink
} from 'lucide-react';

interface ItemQuickDetailModalProps {
  item: Item | null;
  onClose: () => void;
}

export const ItemQuickDetailModal: React.FC<ItemQuickDetailModalProps> = ({ item, onClose }) => {
  const { transactions } = useInventory();

  if (!item) return null;

  // Filter transactions containing this item
  const itemTransactions: Array<{
    tanggal: string;
    noDokumen: string;
    type: 'IN' | 'OUT';
    qty: number;
    stokSebelum: number;
    stokSesudah: number;
    keterangan: string;
  }> = [];

  let runningStock = item.stok;

  transactions.forEach(tx => {
    const it = tx.items.find(i => i.itemId === item.id);
    if (it) {
      itemTransactions.push({
        tanggal: tx.tanggal,
        noDokumen: tx.noDokumen,
        type: tx.type,
        qty: it.qty,
        stokSebelum: it.stokSebelum,
        stokSesudah: it.stokSesudah,
        keterangan: tx.keterangan
      });
    }
  });

  // Calculate totals
  const totalMasuk = itemTransactions
    .filter(t => t.type === 'IN')
    .reduce((acc, curr) => acc + curr.qty, 0);

  const totalKeluar = itemTransactions
    .filter(t => t.type === 'OUT')
    .reduce((acc, curr) => acc + curr.qty, 0);

  const handleExport = () => {
    const entries = itemTransactions.map(t => ({
      tanggal: formatToDDMMYYYY(t.tanggal),
      noDokumen: t.noDokumen,
      jenis: t.type === 'IN' ? 'MASUK' : 'KELUAR',
      keterangan: t.keterangan,
      masuk: t.type === 'IN' ? t.qty : 0,
      keluar: t.type === 'OUT' ? t.qty : 0,
      sisa: t.stokSesudah
    }));
    exportKartuStokToExcel(item, entries);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-emerald-100 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/60 rounded-lg">
              <Package className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">Detail Stok & Kartu Barang</span>
              <h3 className="text-lg font-bold text-white line-clamp-1">{item.nama}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-600/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 font-medium">Kode Barang</div>
              <div className="text-sm font-mono font-bold text-gray-900 mt-0.5">{item.kode || '-'}</div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500 font-medium">Satuan & Lokasi</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
                {item.satuan} • {item.lokasi}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-xs text-emerald-700 font-semibold">Stok Saat Ini</div>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {item.stok} <span className="text-xs font-normal text-emerald-700">{item.satuan}</span>
              </div>
            </div>

            <div className={`rounded-xl p-3 border ${
              item.stok === 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : item.stok <= 5
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="text-xs font-medium">Status Ketersediaan</div>
              <div className="text-sm font-bold mt-0.5">
                {item.stok === 0 ? 'STOK KOSONG' : item.stok <= 5 ? 'STOK MENIPIS' : 'STOK TERSEDIA'}
              </div>
            </div>
          </div>

          {/* Quick Actions & Links */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <NavLink
                href={`#/kartu-stok?id=${item.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Buka Halaman Kartu Stok Penuh
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </NavLink>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Ekspor Kartu .xlsx
              </button>
            </div>

            <div className="flex items-center gap-2">
              <NavLink
                href="#/barang-masuk"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                + Masuk
              </NavLink>
              <NavLink
                href="#/barang-keluar"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-medium"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                - Keluar
              </NavLink>
            </div>
          </div>

          {/* Stock Card / History Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-gray-800">Riwayat Mutasi Barang (Kartu Stok)</h4>
              </div>
              <div className="text-xs text-gray-500">
                Masuk: <strong className="text-emerald-600">+{totalMasuk}</strong> | Keluar: <strong className="text-rose-600">-{totalKeluar}</strong>
              </div>
            </div>

            {itemTransactions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-500 text-xs">
                Belum ada catatan mutasi transaksi keluar/masuk untuk barang ini.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal (dd-mm-yyyy)</th>
                      <th className="py-2.5 px-3">No Dokumen</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Sisa Stok</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {itemTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-gray-600">
                          {formatToDDMMYYYY(tx.tanggal)}
                        </td>
                        <td className="py-2 px-3 font-mono text-emerald-800 font-medium">
                          {tx.noDokumen}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.type === 'IN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {tx.type === 'IN' ? 'MASUK' : 'KELUAR'}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {tx.type === 'IN' ? `+${tx.qty}` : `-${tx.qty}`}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900">
                          {tx.stokSesudah}
                        </td>
                        <td className="py-2 px-3 text-gray-600 max-w-xs truncate">
                          {tx.keterangan || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
