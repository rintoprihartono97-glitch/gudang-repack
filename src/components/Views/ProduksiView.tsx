import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../../context/InventoryContext';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { Item, ProductionRecord } from '../../types';
import { getTodayYYYYMMDD, formatToDDMMYYYY } from '../../utils/date';
import {
  Repeat,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Filter,
  Search,
  Pencil,
  X
} from 'lucide-react';

interface ProductionEntryRow {
  rowId: string;
  item: Item | null;
  kodeInput: string;
  namaInput: string;
  keluar: number | '';
  masuk: number | '';
}

export const ProduksiView: React.FC = () => {
  const {
    items,
    productions,
    locations,
    recordProduction,
    updateProduction,
    getNextProductionDocNumber
  } = useInventory();

  // Form states
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState<string>(getTodayYYYYMMDD());
  const [noDokumen, setNoDokumen] = useState<string>(() => getNextProductionDocNumber());
  const [keterangan, setKeterangan] = useState<string>('');
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  const [rows, setRows] = useState<ProductionEntryRow[]>([
    {
      rowId: 'prod_row_1',
      item: null,
      kodeInput: '',
      namaInput: '',
      keluar: '',
      masuk: ''
    },
    {
      rowId: 'prod_row_2',
      item: null,
      kodeInput: '',
      namaInput: '',
      keluar: '',
      masuk: ''
    }
  ]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter states for Production Document Table
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mutasiFilter, setMutasiFilter] = useState<'ALL' | 'KELUAR' | 'MASUK'>('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal window states (hasil inputan + edit inside modal)
  const [selectedProdId, setSelectedProdId] = useState<string | null>(null);
  const [isModalEditing, setIsModalEditing] = useState(false);
  const [modalTanggal, setModalTanggal] = useState('');
  const [modalNoDokumen, setModalNoDokumen] = useState('');
  const [modalKeterangan, setModalKeterangan] = useState('');
  const [modalRows, setModalRows] = useState<ProductionEntryRow[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  const formTopRef = useRef<HTMLDivElement>(null);
  const namaInputRefs = useRef<any[]>([]);
  const keluarInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const masukInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If editing in form or modal, calculate old net deltas so Stok Terkini reflects baseline before the edited record
  const editingProd = useMemo(() => {
    const targetId = editingProdId || (isModalEditing ? selectedProdId : null);
    return targetId ? productions.find(p => p.id === targetId) || null : null;
  }, [editingProdId, isModalEditing, selectedProdId, productions]);

  const oldDeltaMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!editingProd) return map;
    editingProd.items.forEach(entry => {
      const net = (Number(entry.masuk) || 0) - (Number(entry.keluar) || 0);
      map.set(entry.itemId, (map.get(entry.itemId) || 0) + net);
    });
    return map;
  }, [editingProd]);

  const getAvailableStock = (item: Item | null): number => {
    if (!item) return 0;
    const latest = items.find(i => i.id === item.id) || item;
    const oldDelta = oldDeltaMap.get(latest.id) || 0;
    return latest.stok - oldDelta;
  };

  const resetFormToNew = (keepMessage = false) => {
    setEditingProdId(null);
    setTanggal(getTodayYYYYMMDD());
    setNoDokumen(getNextProductionDocNumber());
    setKeterangan('');
    setRows([
      {
        rowId: `prod_row_${Date.now()}_1`,
        item: null,
        kodeInput: '',
        namaInput: '',
        keluar: '',
        masuk: ''
      },
      {
        rowId: `prod_row_${Date.now()}_2`,
        item: null,
        kodeInput: '',
        namaInput: '',
        keluar: '',
        masuk: ''
      }
    ]);
    setActiveRowIndex(0);
    if (!keepMessage) {
      setSuccessMessage(null);
    }
    setErrorMessage(null);
  };

  const handleNewSheet = () => {
    const nextDoc = getNextProductionDocNumber();
    setEditingProdId(null);
    setTanggal(getTodayYYYYMMDD());
    setNoDokumen(nextDoc);
    setKeterangan('');
    setRows([
      {
        rowId: `prod_row_${Date.now()}_1`,
        item: null,
        kodeInput: '',
        namaInput: '',
        keluar: '',
        masuk: ''
      },
      {
        rowId: `prod_row_${Date.now()}_2`,
        item: null,
        kodeInput: '',
        namaInput: '',
        keluar: '',
        masuk: ''
      }
    ]);
    setActiveRowIndex(0);
    setSuccessMessage(`Lembar produksi baru disiapkan: ${nextDoc}`);
    setErrorMessage(null);
    setTimeout(() => {
      namaInputRefs.current[0]?.focus();
    }, 50);
  };

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        rowId: `prod_row_${Date.now()}_${Math.random()}`,
        item: null,
        kodeInput: '',
        namaInput: '',
        keluar: '',
        masuk: ''
      }
    ]);
  };

  const addRowAndFocus = () => {
    setRows(prev => {
      const next: ProductionEntryRow[] = [
        ...prev,
        {
          rowId: `prod_row_${Date.now()}_${Math.random()}`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
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
          rowId: `prod_row_${Date.now()}`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
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
    setRows(prev =>
      prev.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              item: selectedItem,
              kodeInput: selectedItem.kode,
              namaInput: selectedItem.nama
            }
          : r
      )
    );
  };

  const updateNumberField = (
    rowIndex: number,
    field: 'keluar' | 'masuk',
    val: string
  ) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setRows(prev =>
      prev.map((r, i) => (i === rowIndex ? { ...r, [field]: num } : r))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!noDokumen.trim()) {
      setErrorMessage('No Document Produksi wajib diisi.');
      return;
    }

    // Filter out completely empty rows unless all rows are empty
    const filledRows = rows.filter(
      r => r.item !== null || r.kodeInput.trim() !== '' || r.namaInput.trim() !== '' || Number(r.keluar) > 0 || Number(r.masuk) > 0
    );

    if (filledRows.length === 0) {
      setErrorMessage('Silakan isi minimal 1 baris barang produksi.');
      return;
    }

    const validItems: Array<{ itemId: string; keluar: number; masuk: number }> = [];
    for (let i = 0; i < filledRows.length; i++) {
      const r = filledRows[i];
      if (!r.item) {
        setErrorMessage(`Baris #${i + 1}: Silakan pilih barang dari daftar terlebih dahulu.`);
        return;
      }
      const keluar = Number(r.keluar) || 0;
      const masuk = Number(r.masuk) || 0;
      if (keluar === 0 && masuk === 0) {
        setErrorMessage(
          `Baris #${i + 1} (${r.item.nama}): Isi jumlah Keluar atau Masuk lebih dari 0.`
        );
        return;
      }
      validItems.push({
        itemId: r.item.id,
        keluar,
        masuk
      });
    }

    if (editingProdId) {
      const res = updateProduction(editingProdId, {
        tanggal,
        noDokumen: noDokumen.trim(),
        keterangan: keterangan.trim(),
        items: validItems
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Gagal memperbarui data produksi.');
        return;
      }

      const savedDoc = noDokumen.trim();
      setEditingProdId(null);
      setTanggal(getTodayYYYYMMDD());
      setNoDokumen(getNextProductionDocNumber());
      setKeterangan('');
      setRows([
        {
          rowId: `prod_row_${Date.now()}_1`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
        },
        {
          rowId: `prod_row_${Date.now()}_2`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
        }
      ]);
      setActiveRowIndex(0);
      setSuccessMessage(`Data produksi ${savedDoc} berhasil diperbarui dan stok telah disesuaikan.`);
    } else {
      const res = recordProduction({
        tanggal,
        noDokumen: noDokumen.trim(),
        keterangan: keterangan.trim(),
        items: validItems
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Gagal menyimpan data produksi.');
        return;
      }

      const savedDoc = noDokumen.trim();
      setTanggal(getTodayYYYYMMDD());
      setNoDokumen(getNextProductionDocNumber());
      setKeterangan('');
      setRows([
        {
          rowId: `prod_row_${Date.now()}_1`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
        },
        {
          rowId: `prod_row_${Date.now()}_2`,
          item: null,
          kodeInput: '',
          namaInput: '',
          keluar: '',
          masuk: ''
        }
      ]);
      setActiveRowIndex(0);
      setSuccessMessage(`Berhasil menyimpan produksi ${savedDoc}. Stok keluar & masuk telah otomatis diperbarui.`);
    }
  };

  const selectedProd: ProductionRecord | null = useMemo(() => {
    if (!selectedProdId) return null;
    return productions.find(p => p.id === selectedProdId) || null;
  }, [productions, selectedProdId]);

  const handleOpenProdModal = (prod: ProductionRecord) => {
    setSelectedProdId(prod.id);
    setIsModalEditing(false);
    setModalError(null);
  };

  const handleCloseProdModal = () => {
    setSelectedProdId(null);
    setIsModalEditing(false);
    setModalError(null);
  };

  const handleStartModalEdit = (prod: ProductionRecord) => {
    setModalTanggal(prod.tanggal);
    setModalNoDokumen(prod.noDokumen);
    setModalKeterangan(prod.keterangan === '-' ? '' : prod.keterangan);
    setModalRows(
      prod.items.map((entry, idx) => {
        const matched = items.find(i => i.id === entry.itemId) || {
          id: entry.itemId,
          kode: entry.kode,
          nama: entry.nama,
          satuan: entry.satuan,
          lokasi: entry.lokasi,
          stok: entry.stokSesudah
        };
        return {
          rowId: `modal_edit_${prod.id}_${idx}_${Date.now()}`,
          item: matched,
          kodeInput: entry.kode,
          namaInput: entry.nama,
          keluar: entry.keluar > 0 ? entry.keluar : '',
          masuk: entry.masuk > 0 ? entry.masuk : ''
        };
      })
    );
    setModalError(null);
    setIsModalEditing(true);
  };

  const handleSaveModalEdit = (prod: ProductionRecord) => {
    setModalError(null);

    if (!modalNoDokumen.trim()) {
      setModalError('No Document wajib diisi.');
      return;
    }

    const filledRows = modalRows.filter(
      r =>
        r.item !== null ||
        r.kodeInput.trim() !== '' ||
        r.namaInput.trim() !== '' ||
        Number(r.keluar) > 0 ||
        Number(r.masuk) > 0
    );

    if (filledRows.length === 0) {
      setModalError('Minimal harus ada 1 barang dalam dokumen produksi.');
      return;
    }

    const validItems: Array<{ itemId: string; keluar: number; masuk: number }> = [];
    for (let i = 0; i < filledRows.length; i++) {
      const r = filledRows[i];
      if (!r.item) {
        setModalError(`Baris #${i + 1}: Silakan pilih barang terlebih dahulu.`);
        return;
      }
      const keluar = Number(r.keluar) || 0;
      const masuk = Number(r.masuk) || 0;
      if (keluar === 0 && masuk === 0) {
        setModalError(`Baris #${i + 1} (${r.item.nama}): Isi jumlah Keluar atau Masuk lebih dari 0.`);
        return;
      }
      validItems.push({
        itemId: r.item.id,
        keluar,
        masuk
      });
    }

    const res = updateProduction(prod.id, {
      tanggal: modalTanggal,
      noDokumen: modalNoDokumen.trim(),
      keterangan: modalKeterangan.trim(),
      items: validItems
    });

    if (!res.success) {
      setModalError(res.error || 'Gagal menyimpan perubahan produksi.');
      return;
    }

    setIsModalEditing(false);
    setSuccessMessage(`Data produksi ${modalNoDokumen.trim()} berhasil diperbarui dan stok telah disesuaikan.`);
  };

  // Filtered production documents
  const filteredDocuments = useMemo(() => {
    return productions
      .filter(prod => {
        if (startDate && prod.tanggal < startDate) return false;
        if (endDate && prod.tanggal > endDate) return false;

        if (mutasiFilter === 'KELUAR' && !prod.items.some(it => it.keluar > 0)) return false;
        if (mutasiFilter === 'MASUK' && !prod.items.some(it => it.masuk > 0)) return false;
        if (selectedLocation !== 'ALL' && !prod.items.some(it => it.lokasi === selectedLocation)) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchDoc = (prod.noDokumen || '').toLowerCase().includes(q);
          const matchKet = (prod.keterangan || '').toLowerCase().includes(q);
          const matchTgl =
            (prod.tanggal || '').toLowerCase().includes(q) ||
            formatToDDMMYYYY(prod.tanggal).toLowerCase().includes(q);
          const matchItems = prod.items.some(
            it =>
              (it.kode || '').toLowerCase().includes(q) ||
              (it.nama || '').toLowerCase().includes(q)
          );
          if (!matchDoc && !matchKet && !matchTgl && !matchItems) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.tanggal !== b.tanggal) {
          return b.tanggal.localeCompare(a.tanggal);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [productions, startDate, endDate, mutasiFilter, selectedLocation, searchQuery]);

  const handleExportExcel = () => {
    const data: any[] = [];
    let no = 1;
    filteredDocuments.forEach(prod => {
      prod.items.forEach(r => {
        data.push({
          'No': no++,
          'Tanggal': formatToDDMMYYYY(prod.tanggal),
          'No Document': prod.noDokumen,
          'Keterangan': prod.keterangan || '-',
          'Kode': r.kode || '-',
          'Nama Barang': r.nama,
          'Satuan': r.satuan,
          'Lokasi': r.lokasi,
          'Stok Terkini': r.stokSebelum,
          'Keluar': r.keluar || 0,
          'Masuk': r.masuk || 0,
          'Stok Akhir': r.stokSesudah
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Produksi');
    XLSX.writeFile(wb, 'Laporan_Produksi_Gudang_Repack.xlsx');
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setMutasiFilter('ALL');
    setSelectedLocation('ALL');
    setSearchQuery('');
  };

  const formTotalKeluar = rows.reduce((s, r) => s + (typeof r.keluar === 'number' ? r.keluar : 0), 0);
  const formTotalMasuk = rows.reduce((s, r) => s + (typeof r.masuk === 'number' ? r.masuk : 0), 0);
  const formItemCount = rows.filter(r => r.item !== null).length;

  const listTotalKeluar = filteredDocuments.reduce(
    (s, p) => s + p.items.reduce((is, it) => is + (it.keluar || 0), 0),
    0
  );
  const listTotalMasuk = filteredDocuments.reduce(
    (s, p) => s + p.items.reduce((is, it) => is + (it.masuk || 0), 0),
    0
  );

  return (
    <div ref={formTopRef} className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Produksi &amp; Kemas Ulang
              </span>
              <span className="text-[11px] text-gray-400">Gudang Repack</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-0.5">
              Produksi Barang
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Produksi ulang / kemas ulang barang (contoh: Amonia 1 kg dikemas ulang menjadi Amonia 500 gr). Keluar otomatis mengurangi stok dan Masuk otomatis menambah stok.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNewSheet}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Lembar Baru
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Ekspor Excel .xlsx
          </button>
        </div>
      </div>

      {/* Edit Mode Banner */}
      {editingProdId && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Pencil className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <div>
              <span className="font-extrabold">Mode Edit Produksi Aktif:</span>{' '}
              <span className="font-mono font-bold">{noDokumen}</span>. Ubah data keluar/masuk barang di bawah lalu klik{' '}
              <strong>Save Perubahan</strong>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => resetFormToNew(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold self-start sm:self-auto"
          >
            <X className="w-3.5 h-3.5" />
            Batal Edit
          </button>
        </div>
      )}

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs sm:text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
          >
            Tutup
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Production Input Form */}
      <form
        onSubmit={handleSave}
        className={`p-5 sm:p-7 rounded-2xl border shadow-sm space-y-6 ${
          editingProdId
            ? 'bg-amber-50/40 border-amber-300'
            : 'bg-slate-100 border-slate-300'
        }`}
      >
        {/* Metadata Row */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-700" />
              Tanggal Produksi
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              required
              className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1 font-mono">
              Terpilih: <strong>{formatToDDMMYYYY(tanggal)}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              No Document
            </label>
            <input
              type="text"
              value={noDokumen}
              onChange={e => setNoDokumen(e.target.value)}
              placeholder="Contoh: PRD-2026-000001"
              required
              className="w-full bg-emerald-50/70 border border-emerald-300 rounded-lg px-3 py-2 text-sm text-emerald-950 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Nomor Dokumen Produksi Otomatis / Manual
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Keterangan Produksi
            </label>
            <input
              type="text"
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              placeholder="Contoh: Kemas ulang Amonia 1kg ke 500gr"
              className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Catatan proses kemas ulang / produksi
            </div>
          </div>
        </div>

        {/* Tabel Input Produksi: Kode - Nama Barang - Stok Terkini - Keluar - Masuk */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              Input Barang Produksi
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                Keluar: otomatis mengurangi qty barang
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Masuk: otomatis menambah qty barang
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-200 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-300">
                <tr>
                  <th className="py-3 px-2.5 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-36">Kode</th>
                  <th className="py-3 px-3 min-w-[240px]">Nama Barang</th>
                  <th className="py-3 px-3 w-32 text-right whitespace-nowrap">Stok Terkini</th>
                  <th className="py-3 px-3 w-32 text-right bg-rose-100/70 text-rose-900">
                    <div>Keluar</div>
                    <div className="text-[9px] font-medium normal-case text-rose-700">
                      Kurangi stok
                    </div>
                  </th>
                  <th className="py-3 px-3 w-32 text-right bg-emerald-100/70 text-emerald-900">
                    <div>Masuk</div>
                    <div className="text-[9px] font-medium normal-case text-emerald-700">
                      Tambah stok
                    </div>
                  </th>
                  <th className="py-3 px-2 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, index) => {
                  const baseStock = getAvailableStock(row.item);
                  const keluarVal = Number(row.keluar) || 0;
                  const masukVal = Number(row.masuk) || 0;
                  const previewAkhir = baseStock - keluarVal + masukVal;
                  const isOver = row.item !== null && baseStock - keluarVal < 0;

                  return (
                    <tr
                      key={row.rowId}
                      onClick={() => setActiveRowIndex(index)}
                      className={`transition-colors ${
                        activeRowIndex === index ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-2.5 text-center text-gray-500 font-bold font-mono">
                        {index + 1}
                      </td>

                      {/* Kode */}
                      <td className="py-2 px-3">
                        <div onFocus={() => setActiveRowIndex(index)}>
                          <ItemAutocomplete
                            value={row.kodeInput}
                            onChange={val => {
                              setRows(prev =>
                                prev.map((r, i) => (i === index ? { ...r, kodeInput: val } : r))
                              );
                            }}
                            onSelectItem={item => handleSelectItem(index, item)}
                            onNextField={() => {
                              keluarInputRefs.current[index]?.focus();
                            }}
                            field="kode"
                            placeholder="Ketik kode..."
                            size="sm"
                          />
                        </div>
                      </td>

                      {/* Nama Barang */}
                      <td className="py-2 px-3 min-w-[240px]">
                        <div onFocus={() => setActiveRowIndex(index)}>
                          <ItemAutocomplete
                            ref={el => {
                              namaInputRefs.current[index] = el;
                            }}
                            value={row.namaInput}
                            onChange={val => {
                              setRows(prev =>
                                prev.map((r, i) => (i === index ? { ...r, namaInput: val } : r))
                              );
                            }}
                            onSelectItem={item => handleSelectItem(index, item)}
                            onNextField={() => {
                              keluarInputRefs.current[index]?.focus();
                            }}
                            field="nama"
                            placeholder="Cari nama barang..."
                            size="sm"
                          />
                        </div>
                      </td>

                      {/* Stok Terkini */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {row.item ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md font-bold font-mono text-xs border border-slate-200">
                              {baseStock} {row.item.satuan}
                            </span>
                            {(keluarVal > 0 || masukVal > 0) && (
                              <span
                                className={`text-[10px] font-bold mt-0.5 ${
                                  isOver ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              >
                                Akhir: {previewAkhir}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Keluar */}
                      <td className="py-2 px-3 text-right bg-rose-50/30">
                        <input
                          ref={el => {
                            keluarInputRefs.current[index] = el;
                          }}
                          type="number"
                          min="0"
                          step="any"
                          value={row.keluar}
                          onChange={e => updateNumberField(index, 'keluar', e.target.value)}
                          onFocus={() => setActiveRowIndex(index)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              masukInputRefs.current[index]?.focus();
                            }
                          }}
                          placeholder="0"
                          className={`w-full rounded px-2 py-1.5 text-xs font-bold text-right focus:ring-2 focus:outline-none ${
                            isOver
                              ? 'bg-rose-100 border border-rose-500 text-rose-900 focus:ring-rose-500'
                              : 'bg-rose-50 border border-rose-300 text-rose-900 focus:ring-rose-500'
                          }`}
                        />
                      </td>

                      {/* Masuk */}
                      <td className="py-2 px-3 text-right bg-emerald-50/30">
                        <input
                          ref={el => {
                            masukInputRefs.current[index] = el;
                          }}
                          type="number"
                          min="0"
                          step="any"
                          value={row.masuk}
                          onChange={e => updateNumberField(index, 'masuk', e.target.value)}
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
                          className="w-full bg-emerald-50 border border-emerald-300 rounded px-2 py-1.5 text-xs font-bold text-right text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </td>

                      {/* Hapus */}
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

          <div className="pt-1 flex justify-start">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              + Tambah Baris Barang
            </button>
          </div>
        </div>

        {/* Bottom Actions: Totals + Save */}
        <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5 text-xs text-gray-600">
            <div>
              Item Terpilih: <strong className="text-gray-900 font-mono">{formItemCount}</strong> dari {rows.length} baris
            </div>
            <div>
              Total Keluar:{' '}
              <strong className="text-rose-700 font-mono text-sm font-black">-{formTotalKeluar}</strong>
            </div>
            <div>
              Total Masuk:{' '}
              <strong className="text-emerald-700 font-mono text-sm font-black">+{formTotalMasuk}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => resetFormToNew(false)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              {editingProdId ? 'Batal Edit' : 'Reset'}
            </button>

            <button
              type="submit"
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 ${
                editingProdId
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-800 hover:bg-emerald-900'
              }`}
            >
              <Save className="w-4 h-4" />
              {editingProdId ? 'Save Perubahan' : 'Save Produksi'}
            </button>
          </div>
        </div>
      </form>

      {/* Filter & Daftar Riwayat Produksi */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-emerald-700" />
            Filter Daftar Document Produksi ({filteredDocuments.length} dokumen)
          </span>
          {(startDate || endDate || mutasiFilter !== 'ALL' || selectedLocation !== 'ALL' || searchQuery) && (
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
              Jenis Mutasi
            </label>
            <select
              value={mutasiFilter}
              onChange={e => setMutasiFilter(e.target.value as 'ALL' | 'KELUAR' | 'MASUK')}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua (Keluar &amp; Masuk)</option>
              <option value="KELUAR">Ada Barang Keluar</option>
              <option value="MASUK">Ada Barang Masuk</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Lokasi Barang
            </label>
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Lokasi</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              Cari Kode / Nama / Dokumen
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

        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Dokumen Produksi:</span>
            <strong className="text-gray-900 font-bold">{filteredDocuments.length}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-rose-700">
            <span>Total Keluar:</span>
            <strong className="font-extrabold">-{listTotalKeluar}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span>Total Masuk:</span>
            <strong className="font-extrabold">+{listTotalMasuk}</strong>
          </div>
          <span className="text-[11px] text-gray-400 ml-auto">
            Klik baris dokumen untuk membuka detail hasil inputan &amp; edit
          </span>
        </div>
      </div>

      {/* Table Daftar No Document Produksi: Tanggal - No Document - Keterangan */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                <th className="py-3 px-4 whitespace-nowrap">No Document</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-400">
                    Belum ada dokumen produksi tersimpan. Silakan input produksi pada formulir di atas lalu klik Save.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map(prod => {
                  const isActive = selectedProdId === prod.id;
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => handleOpenProdModal(prod)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-emerald-50/80' : 'hover:bg-emerald-50/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-gray-700 whitespace-nowrap">
                        {formatToDDMMYYYY(prod.tanggal)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-900 whitespace-nowrap">
                        {prod.noDokumen}
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {prod.keterangan || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jendela Baru Hasil Inputan Produksi & Edit */}
      {selectedProd && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={handleCloseProdModal}
        >
          <div
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[11px] font-extrabold uppercase bg-emerald-600 text-white">
                  Hasil Input Produksi
                </span>
                <span className="font-mono font-bold text-sm sm:text-base">
                  {selectedProd.noDokumen}
                </span>
                <span className="text-emerald-200 text-xs">
                  ({formatToDDMMYYYY(selectedProd.tanggal)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isModalEditing ? (
                  <button
                    type="button"
                    onClick={() => handleStartModalEdit(selectedProd)}
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
                        setIsModalEditing(false);
                        setModalError(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveModalEdit(selectedProd)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-lg text-xs font-extrabold shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Perubahan
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleCloseProdModal}
                  className="p-1.5 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {modalError && isModalEditing && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="font-medium">{modalError}</span>
                </div>
              )}

              {!isModalEditing ? (
                /* VIEW MODE: HASIL INPUTAN PRODUKSI */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Tanggal</span>
                      <strong className="font-mono text-gray-900">
                        {formatToDDMMYYYY(selectedProd.tanggal)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">No Document</span>
                      <strong className="font-mono text-gray-900">{selectedProd.noDokumen}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Keterangan</span>
                      <strong className="text-gray-900">{selectedProd.keterangan || '-'}</strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">Kode</th>
                          <th className="py-2.5 px-3">Nama Barang</th>
                          <th className="py-2.5 px-3 text-right">Stok Terkini</th>
                          <th className="py-2.5 px-3 text-right text-rose-700">Keluar</th>
                          <th className="py-2.5 px-3 text-right text-emerald-700">Masuk</th>
                          <th className="py-2.5 px-3 text-right">Stok Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedProd.items.map((it, idx) => (
                          <tr key={`${selectedProd.id}_it_${idx}`} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-gray-700">{it.kode || '-'}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-900">
                              <div>{it.nama}</div>
                              <span className="text-[10px] text-gray-400 font-normal">
                                {it.satuan} &bull; {it.lokasi}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                              {it.stokSebelum}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {it.keluar > 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  -{it.keluar}
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {it.masuk > 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  +{it.masuk}
                                </span>
                              ) : (
                                <span className="text-gray-300 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                              {it.stokSesudah}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* EDIT MODE INSIDE MODAL WINDOW */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={modalTanggal}
                        onChange={e => setModalTanggal(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">No Document</label>
                      <input
                        type="text"
                        value={modalNoDokumen}
                        onChange={e => setModalNoDokumen(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Keterangan</label>
                      <input
                        type="text"
                        value={modalKeterangan}
                        onChange={e => setModalKeterangan(e.target.value)}
                        placeholder="Keterangan produksi..."
                        className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-2.5 w-10 text-center">No</th>
                          <th className="py-2 px-3 w-36">Kode</th>
                          <th className="py-2 px-3 min-w-[200px]">Nama Barang</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Stok Terkini</th>
                          <th className="py-2 px-3 text-right w-28 text-rose-800">Keluar</th>
                          <th className="py-2 px-3 text-right w-28 text-emerald-800">Masuk</th>
                          <th className="py-2 px-2 text-center w-12">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {modalRows.map((r, rIdx) => {
                          const baseStock = getAvailableStock(r.item);
                          return (
                            <tr key={r.rowId}>
                              <td className="py-2 px-2.5 text-center text-gray-400 font-mono">
                                {rIdx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <ItemAutocomplete
                                  value={r.kodeInput}
                                  onChange={val => {
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx ? { ...row, kodeInput: val } : row
                                      )
                                    );
                                  }}
                                  onSelectItem={selected => {
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx
                                          ? {
                                              ...row,
                                              item: selected,
                                              kodeInput: selected.kode,
                                              namaInput: selected.nama
                                            }
                                          : row
                                      )
                                    );
                                  }}
                                  field="kode"
                                  placeholder="Kode..."
                                  size="sm"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <ItemAutocomplete
                                  value={r.namaInput}
                                  onChange={val => {
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx ? { ...row, namaInput: val } : row
                                      )
                                    );
                                  }}
                                  onSelectItem={selected => {
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx
                                          ? {
                                              ...row,
                                              item: selected,
                                              kodeInput: selected.kode,
                                              namaInput: selected.nama
                                            }
                                          : row
                                      )
                                    );
                                  }}
                                  field="nama"
                                  placeholder="Cari nama barang..."
                                  size="sm"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                {r.item ? `${baseStock} ${r.item.satuan}` : '-'}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={r.keluar}
                                  onChange={e => {
                                    const val =
                                      e.target.value === ''
                                        ? ''
                                        : Math.max(0, parseFloat(e.target.value) || 0);
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx ? { ...row, keluar: val } : row
                                      )
                                    );
                                  }}
                                  placeholder="0"
                                  className="w-full text-right bg-rose-50 border border-rose-300 rounded-lg px-2 py-1 text-xs font-bold text-rose-900 focus:ring-2 focus:ring-rose-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={r.masuk}
                                  onChange={e => {
                                    const val =
                                      e.target.value === ''
                                        ? ''
                                        : Math.max(0, parseFloat(e.target.value) || 0);
                                    setModalRows(prev =>
                                      prev.map((row, idx) =>
                                        idx === rIdx ? { ...row, masuk: val } : row
                                      )
                                    );
                                  }}
                                  placeholder="0"
                                  className="w-full text-right bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (modalRows.length <= 1) return;
                                    setModalRows(prev => prev.filter((_, idx) => idx !== rIdx));
                                  }}
                                  disabled={modalRows.length <= 1}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded disabled:opacity-30"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setModalRows(prev => [
                          ...prev,
                          {
                            rowId: `modal_edit_row_${Date.now()}_${Math.random()}`,
                            item: null,
                            kodeInput: '',
                            namaInput: '',
                            keluar: '',
                            masuk: ''
                          }
                        ]);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Baris
                    </button>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>
                        Total Keluar:{' '}
                        <strong className="text-rose-700">
                          -{modalRows.reduce((s, r) => s + (typeof r.keluar === 'number' ? r.keluar : 0), 0)}
                        </strong>
                      </span>
                      <span>
                        Total Masuk:{' '}
                        <strong className="text-emerald-700">
                          +{modalRows.reduce((s, r) => s + (typeof r.masuk === 'number' ? r.masuk : 0), 0)}
                        </strong>
                      </span>
                    </div>
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
