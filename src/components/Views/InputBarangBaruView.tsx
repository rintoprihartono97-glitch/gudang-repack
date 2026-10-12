import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { exportItemsToExcel } from '../../utils/excel';
import { 
  PlusCircle, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Package, 
  MapPin, 
  Layers
} from 'lucide-react';

export const InputBarangBaruView: React.FC = () => {
  const { addItem, items, locations, units } = useInventory();

  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [satuan, setSatuan] = useState(units[0] || 'PCS');
  const [customSatuan, setCustomSatuan] = useState('');
  const [lokasi, setLokasi] = useState(locations[0] || 'Stok Gdg PKL');
  const [customLokasi, setCustomLokasi] = useState('');
  const [stokAwal, setStokAwal] = useState<number | ''>('');
  const [kategori, setKategori] = useState('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const finalNama = nama.trim();
    if (!finalNama) {
      setErrorMsg('Nama barang wajib diisi.');
      return;
    }

    const finalSatuan = satuan === '__CUSTOM__' ? customSatuan.trim().toUpperCase() : satuan;
    if (!finalSatuan) {
      setErrorMsg('Satuan barang wajib dipilih atau diisi.');
      return;
    }

    const finalLokasi = lokasi === '__CUSTOM__' ? customLokasi.trim() : lokasi;
    if (!finalLokasi) {
      setErrorMsg('Lokasi gudang/toko wajib dipilih atau diisi.');
      return;
    }

    const finalKode = kode.trim();

    // Check if exactly same item with same kode AND same location already exists
    const duplicate = items.find(
      i => i.kode && i.kode.toLowerCase() === finalKode.toLowerCase() && i.lokasi === finalLokasi
    );

    if (duplicate && finalKode) {
      setErrorMsg(`Barang dengan kode "${finalKode}" di lokasi "${finalLokasi}" sudah ada (${duplicate.nama}). Gunakan menu Edit Barang jika ingin mengubah.`);
      return;
    }

    const parsedStok = stokAwal === '' ? 0 : Number(stokAwal);

    const created = addItem({
      kode: finalKode,
      nama: finalNama,
      satuan: finalSatuan,
      lokasi: finalLokasi,
      stok: parsedStok,
      kategori: kategori.trim() || undefined
    });

    setSuccessMsg(`Barang baru "${created.nama}" berhasil didaftarkan ke "${created.lokasi}"!`);
    
    // Reset form
    setKode('');
    setNama('');
    setStokAwal('');
    setKategori('');
    setCustomSatuan('');
    setCustomLokasi('');
  };

  const handleExport = () => {
    exportItemsToExcel(items, 'Daftar_Barang_Terbaru.xlsx');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              3. Input Barang Baru
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Registrasi item baru ke katalog dengan pilihan dropdown satuan dan lokasi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold self-start sm:self-auto transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          Ekspor Katalog .xlsx
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kode Barang */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Kode Barang (SKU / Barcode)
            </label>
            <input
              type="text"
              value={kode}
              onChange={e => setKode(e.target.value)}
              placeholder="Contoh: 0105075 atau SKU-001"
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-medium text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Boleh kosong jika belum memiliki kode baku. Kode sama di lokasi berbeda diperbolehkan.
            </span>
          </div>

          {/* Nama Barang */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nama Barang <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: BUTTER CURAH GOLD 1KG"
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Masukkan nama barang dengan lengkap dan jelas.
            </span>
          </div>

          {/* Satuan (Dropdown Sesuai Data + Opsi Lainnya) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
              <span>Satuan Barang <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-gray-400">Pilihan Dropdown</span>
            </label>
            <select
              value={satuan}
              onChange={e => setSatuan(e.target.value)}
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {units.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__CUSTOM__">+ Tambah Satuan Baru...</option>
            </select>

            {satuan === '__CUSTOM__' && (
              <input
                type="text"
                placeholder="Ketik satuan baru (contoh: PACK, DUS, LTR)..."
                value={customSatuan}
                onChange={e => setCustomSatuan(e.target.value)}
                required
                className="mt-2 w-full bg-white border border-emerald-400 rounded-xl px-3.5 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Lokasi (Dropdown Sesuai Data + Opsi Lainnya) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
              <span>Lokasi Penempatan <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-gray-400">Pilihan Dropdown</span>
            </label>
            <select
              value={lokasi}
              onChange={e => setLokasi(e.target.value)}
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
              <option value="__CUSTOM__">+ Tambah Lokasi Baru...</option>
            </select>

            {lokasi === '__CUSTOM__' && (
              <input
                type="text"
                placeholder="Ketik nama lokasi baru..."
                value={customLokasi}
                onChange={e => setCustomLokasi(e.target.value)}
                required
                className="mt-2 w-full bg-white border border-emerald-400 rounded-xl px-3.5 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Stok Awal */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Stok Awal
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={stokAwal}
              onChange={e => setStokAwal(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Jumlah stok fisik awal saat pendaftaran item baru.
            </span>
          </div>

          {/* Kategori / Catatan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Kategori / Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={kategori}
              onChange={e => setKategori(e.target.value)}
              placeholder="Contoh: Bahan Baku, Kemasan Toples, Pewarna"
              className="w-full bg-slate-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-7 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            SIMPAN BARANG BARU
          </button>
        </div>
      </form>
    </div>
  );
};
