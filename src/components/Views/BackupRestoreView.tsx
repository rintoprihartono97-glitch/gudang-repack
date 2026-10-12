import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { exportFullBackupExcel, parseExcelBackup } from '../../utils/excel';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../../services/googleAuth';
import { 
  createWarehouseSpreadsheet, 
  syncCurrentStockToSpreadsheet, 
  appendTransactionsToSpreadsheet,
  listWarehouseSpreadsheets, 
  importItemsFromSpreadsheet,
  extractSpreadsheetId,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  SpreadsheetFileInfo 
} from '../../services/googleSheets';
import { 
  Database, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  FileCode,
  ShieldCheck,
  Package,
  ExternalLink,
  RefreshCw,
  LogOut,
  FolderOpen,
  Trash2,
  Link as LinkIcon,
  Check,
  ArrowRight
} from 'lucide-react';
import { User } from 'firebase/auth';

const STORAGE_KEY_SPREADSHEET_ID = 'gudang_repack_active_spreadsheet_id';

export const BackupRestoreView: React.FC = () => {
  const { items, transactions, importItems, resetToDefault, clearTransactions } = useInventory();

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearTxConfirm, setShowClearTxConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Google Auth & Sheets states
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [userSheets, setUserSheets] = useState<SpreadsheetFileInfo[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);

  // Active spreadsheet state, default to the user's specific spreadsheet
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  });
  const [inputSpreadsheetUrl, setInputSpreadsheetUrl] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID);
    return saved ? `https://docs.google.com/spreadsheets/d/${saved}/edit` : DEFAULT_SPREADSHEET_URL;
  });
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

  // Confirmation modal states for Google Sheets destructive operations (per Workspace Guidelines)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    onConfirm: async () => {}
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Save activeSpreadsheetId whenever changed
  useEffect(() => {
    if (activeSpreadsheetId) {
      localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, activeSpreadsheetId);
    }
  }, [activeSpreadsheetId]);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // When token is available, load user's Google Drive spreadsheets
  useEffect(() => {
    if (googleToken) {
      loadDriveSpreadsheets(googleToken);
    }
  }, [googleToken]);

  const loadDriveSpreadsheets = async (token: string) => {
    setLoadingSheets(true);
    try {
      const files = await listWarehouseSpreadsheets(token);
      setUserSheets(files);
    } catch (e: any) {
      console.warn('Gagal memuat spreadsheet Google Drive:', e.message);
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setStatusMessage({
          type: 'success',
          text: `Berhasil terhubung dengan Google (${res.user.email}).`
        });
        loadDriveSpreadsheets(res.accessToken);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal login Google: ' + (err.message || 'Izin ditolak.')
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleToken(null);
    setUserSheets([]);
    setLastCreatedUrl(null);
    setStatusMessage({
      type: 'success',
      text: 'Berhasil logout dari akun Google.'
    });
  };

  // Connect or switch active spreadsheet by URL or ID
  const handleConnectSpreadsheet = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const extractedId = extractSpreadsheetId(inputSpreadsheetUrl);
    if (!extractedId) {
      setStatusMessage({ type: 'error', text: 'Masukkan link atau ID Google Spreadsheet yang valid.' });
      return;
    }

    setActiveSpreadsheetId(extractedId);
    localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, extractedId);
    setStatusMessage({
      type: 'success',
      text: `Berhasil menyambungkan ke Google Spreadsheet ID: ${extractedId}`
    });
  };

  // Google Sheets: Create New Spreadsheet in Drive
  const handleCreateNewSpreadsheet = async () => {
    if (!googleToken) {
      setStatusMessage({ type: 'error', text: 'Silakan login dengan Google terlebih dahulu.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    try {
      const now = new Date();
      const title = `GUDANG REPACK - Data Stok & Riwayat (${now.toLocaleDateString('id-ID')})`;
      const { spreadsheetId, spreadsheetUrl } = await createWarehouseSpreadsheet(
        googleToken,
        title,
        items,
        transactions
      );

      setActiveSpreadsheetId(spreadsheetId);
      setInputSpreadsheetUrl(spreadsheetUrl);
      setLastCreatedUrl(spreadsheetUrl);
      loadDriveSpreadsheets(googleToken);

      setStatusMessage({
        type: 'success',
        text: `Google Spreadsheet baru berhasil dibuat di Drive dan tersambung otomatis!`
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal membuat Google Spreadsheet: ' + e.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sheets: Sync Stock (requires user confirmation)
  const promptSyncStock = () => {
    if (!googleToken) {
      setStatusMessage({ type: 'error', text: 'Silakan login dengan Google terlebih dahulu.' });
      return;
    }
    const targetId = activeSpreadsheetId.trim();
    if (!targetId) {
      setStatusMessage({ type: 'error', text: 'Pilih atau masukkan ID Google Spreadsheet target.' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Sinkronkan Data Stok ke Google Sheets?',
      description: `Tindakan ini akan memperbarui lembar kerja "DATA BARANG" di Google Spreadsheet (${targetId}) dengan total ${items.length} item data stok saat ini. Apakah Anda yakin ingin melanjutkan?`,
      actionLabel: 'Ya, Sinkronkan Data',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setStatusMessage(null);
        try {
          await syncCurrentStockToSpreadsheet(googleToken, targetId, items);
          setStatusMessage({
            type: 'success',
            text: `Berhasil menyinkronkan ${items.length} data barang ke Google Spreadsheet!`
          });
        } catch (e: any) {
          setStatusMessage({
            type: 'error',
            text: 'Gagal sinkronisasi ke Google Sheets: ' + e.message
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Google Sheets: Append Transactions (requires user confirmation)
  const promptAppendTransactions = () => {
    if (!googleToken) {
      setStatusMessage({ type: 'error', text: 'Silakan login dengan Google terlebih dahulu.' });
      return;
    }
    const targetId = activeSpreadsheetId.trim();
    if (!targetId) {
      setStatusMessage({ type: 'error', text: 'Pilih atau masukkan ID Google Spreadsheet target.' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Kirim Riwayat Mutasi ke Google Sheets?',
      description: `Tindakan ini akan menambahkan ${transactions.length} mutasi ke lembar kerja "RIWAYAT TRANSAKSI" pada Google Spreadsheet (${targetId}). Lanjutkan?`,
      actionLabel: 'Ya, Kirim Riwayat Mutasi',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setStatusMessage(null);
        try {
          await appendTransactionsToSpreadsheet(googleToken, targetId, transactions);
          setStatusMessage({
            type: 'success',
            text: `Berhasil menambahkan riwayat transaksi ke Google Spreadsheet!`
          });
        } catch (e: any) {
          setStatusMessage({
            type: 'error',
            text: 'Gagal mengirim riwayat ke Google Sheets: ' + e.message
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Google Sheets: Import items from Google Sheets (requires user confirmation)
  const promptImportFromSheets = () => {
    if (!googleToken) {
      setStatusMessage({ type: 'error', text: 'Silakan login dengan Google terlebih dahulu.' });
      return;
    }
    const targetId = activeSpreadsheetId.trim();
    if (!targetId) {
      setStatusMessage({ type: 'error', text: 'Pilih atau masukkan ID Google Spreadsheet sumber.' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Impor Data Barang dari Google Sheets?',
      description: `Tindakan ini akan membaca data barang dari lembar kerja pada Google Spreadsheet (${targetId}) dan memperbarui katalog barang di GUDANG REPACK. Apakah Anda yakin ingin melanjutkan?`,
      actionLabel: 'Ya, Impor Barang',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsLoading(true);
        setStatusMessage(null);
        try {
          const imported = await importItemsFromSpreadsheet(googleToken, targetId);
          importItems(imported);
          setStatusMessage({
            type: 'success',
            text: `Berhasil mengimpor ${imported.length} data barang dari Google Spreadsheet!`
          });
        } catch (e: any) {
          setStatusMessage({
            type: 'error',
            text: 'Gagal mengimpor dari Google Sheets: ' + e.message
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleBackupExcel = () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      exportFullBackupExcel(items, transactions, `BACKUP_GUDANG_REPACK_${dateStr}.xlsx`);
      setStatusMessage({
        type: 'success',
        text: 'File cadangan Excel (.xlsx) berhasil diunduh!'
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal membuat file backup: ' + e.message
      });
    }
  };

  const handleBackupJSON = () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const data = {
        app: 'GUDANG REPACK',
        backupDate: now.toISOString(),
        items,
        transactions
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BACKUP_GUDANG_REPACK_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: 'File cadangan JSON berhasil diunduh!'
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal membuat file JSON: ' + e.message
      });
    }
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await parseExcelBackup(file);
    setIsLoading(false);

    if (res.error) {
      setStatusMessage({ type: 'error', text: res.error });
    } else if (res.items && res.items.length > 0) {
      importItems(res.items);
      setStatusMessage({
        type: 'success',
        text: `Berhasil memulihkan ${res.items.length} data barang dari file Excel!`
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Tidak ada baris data barang yang ditemukan di file Excel.'
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.items)) {
          importItems(parsed.items);
          setStatusMessage({
            type: 'success',
            text: `Berhasil memulihkan ${parsed.items.length} data barang dari backup JSON!`
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Format file JSON tidak sesuai struktur backup GUDANG REPACK.'
          });
        }
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: 'Gagal membaca file JSON: ' + err.message
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);

    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleReset = () => {
    resetToDefault();
    setShowResetConfirm(false);
    setStatusMessage({
      type: 'success',
      text: 'Data gudang berhasil dikembalikan ke data katalog bawaan pabrik!'
    });
  };

  const handleClearTransactionsOnly = () => {
    clearTransactions();
    setShowClearTxConfirm(false);
    setStatusMessage({
      type: 'success',
      text: 'Riwayat transaksi keluar & masuk berhasil dikosongkan! Data master barang tetap utuh.'
    });
  };

  const currentSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              7. Backup & Google Sheets
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Sambungkan ke Google Spreadsheet Anda, sinkronkan stok, ekspor-impor Excel (.xlsx), dan pemeliharaan data.
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm animate-in fade-in ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1 font-medium">{statusMessage.text}</div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-60 hover:opacity-100 px-2 py-1"
          >
            Tutup
          </button>
        </div>
      )}

      {/* SECTION 1: GOOGLE SHEETS CONNECTION & SYNC */}
      <div className="bg-white rounded-2xl shadow-xs border border-emerald-300 overflow-hidden">
        {/* Banner */}
        <div className="p-6 bg-gradient-to-r from-emerald-800 to-emerald-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Koneksi Google Spreadsheet
                </h2>
                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Tersambung
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Sinkronisasi langsung dengan spreadsheet Google Anda secara dua arah (Baca & Tulis).
              </p>
            </div>
          </div>

          {/* Google Sign In / User Status */}
          <div className="flex-shrink-0">
            {googleUser ? (
              <div className="flex items-center gap-3 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/20">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google User'}
                    className="w-7 h-7 rounded-full border border-emerald-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    {(googleUser.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight truncate max-w-[140px]">
                    {googleUser.displayName || googleUser.email?.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-emerald-200 truncate max-w-[140px]">
                    {googleUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  title="Logout dari Google"
                  className="p-1.5 hover:bg-white/20 rounded-lg text-emerald-200 hover:text-white transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Google Sign In Button */
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2.5 px-4 py-2 bg-white text-gray-800 hover:bg-slate-50 font-semibold text-xs rounded-xl shadow-md transition-all active:scale-95 border border-slate-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Active Connected Spreadsheet Card */}
          <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  Spreadsheet Aktif Terhubung
                </span>
              </div>
              <a
                href={currentSpreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-2xs transition-colors w-fit"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Buka Spreadsheet di Tab Baru</span>
              </a>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-mono text-gray-800 truncate select-all">
                <span className="text-gray-400 font-sans mr-1">ID:</span>
                <strong>{activeSpreadsheetId}</strong>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 w-fit">
                Siap Sinkron ({items.length} Stok, {transactions.length} Mutasi)
              </span>
            </div>

            {/* Input URL/ID Bar */}
            <form onSubmit={handleConnectSpreadsheet} className="pt-1">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Ganti / Sambungkan Link Spreadsheet Lain:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputSpreadsheetUrl}
                    onChange={(e) => setInputSpreadsheetUrl(e.target.value)}
                    placeholder="Tempel link Google Spreadsheet (docs.google.com/spreadsheets/d/...)"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                >
                  Sambungkan
                </button>
              </div>
            </form>
          </div>

          {/* Sync & Import Actions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              Operasi Sinkronisasi Spreadsheet
            </h3>

            {!googleUser ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
                <p className="text-xs text-gray-600">
                  Untuk memulai sinkronisasi dengan spreadsheet <strong className="font-mono text-emerald-800">{activeSpreadsheetId}</strong>, silakan masuk dengan akun Google Anda terlebih dahulu.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Masuk dengan Akun Google
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Sync Stock */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                      1. Sinkronkan Data Stok
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Kirim dan perbarui data seluruh {items.length} barang ke sheet <strong>DATA BARANG</strong> di Google Spreadsheet.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={promptSyncStock}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Stok</span>
                  </button>
                </div>

                {/* 2. Import From Sheets */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-blue-700" />
                      2. Impor dari Spreadsheet
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Baca baris barang dari Google Spreadsheet Anda dan masukkan ke dalam katalog GUDANG REPACK.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={promptImportFromSheets}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Impor Data Barang</span>
                  </button>
                </div>

                {/* 3. Send Transaction Log */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                      3. Kirim Riwayat Mutasi
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Kirim log mutasi masuk/keluar ({transactions.length} mutasi) ke sheet <strong>RIWAYAT TRANSAKSI</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={promptAppendTransactions}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Kirim Riwayat Mutasi</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Optional: Pick other files from Drive or create new */}
          {googleUser && (
            <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Atau pilih dari Google Drive:</span>
                <select
                  value={activeSpreadsheetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setActiveSpreadsheetId(id);
                    setInputSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${id}/edit`);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-gray-800"
                >
                  <option value={activeSpreadsheetId}>Spreadsheet Terpilih ({activeSpreadsheetId.slice(0, 8)}...)</option>
                  {userSheets.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateNewSpreadsheet}
                disabled={isLoading}
                className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
              >
                + Buat Spreadsheet Baru di Drive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: EXCEL (.xlsx) & JSON BACKUP & RESTORE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <Download className="w-5 h-5" />
              <h2 className="text-base font-bold text-gray-800">
                Ekspor Backup Lokal (.xlsx)
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Unduh cadangan data ke file komputer dalam format Microsoft Excel (.xlsx) dengan 2 lembar: Data Barang & Riwayat Transaksi.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Item Barang:</span>
              <span className="font-bold text-gray-900">{items.length} Item</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total Riwayat Transaksi:</span>
              <span className="font-bold text-gray-900">{transactions.length} Mutasi</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleBackupExcel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Unduh Backup Excel (.xlsx)
            </button>
            <button
              onClick={handleBackupJSON}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <FileCode className="w-4 h-4" />
              Unduh Backup Mentah JSON (.json)
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <Upload className="w-5 h-5" />
              <h2 className="text-base font-bold text-gray-800">
                Pulihkan / Impor Data
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Unggah file Excel (.xlsx) atau file JSON yang telah dicadangkan sebelumnya untuk mengembalikan atau memperbarui data barang.
            </p>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-xl text-xs text-blue-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Keamanan Data
            </div>
            <p className="text-[11px] text-blue-700">
              Pastikan struktur kolom pada file Excel memiliki kolom: Kode, Nama Barang, Satuan, Stok, dan Lokasi.
            </p>
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleUploadExcel}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isLoading ? 'Memproses File...' : 'Pilih File Excel (.xlsx) untuk Dipulihkan'}
            </button>

            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={handleUploadJSON}
              className="hidden"
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <FileCode className="w-4 h-4" />
              Pilih File JSON untuk Dipulihkan
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: DATA MAINTENANCE & PURGE */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Pemeliharaan & Pengosongan Data
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Gunakan opsi ini jika Anda ingin mengosongkan riwayat mutasi atau mengembalikan aplikasi ke data katalog bawaan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Clear Transactions Only */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-amber-600" />
                Kosongkan Riwayat Transaksi Saja
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Menghapus semua catatan mutasi masuk/keluar sehingga riwayat bersih. Data master barang dan stok tetap tersimpan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearTxConfirm(true)}
              className="w-full px-3 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors"
            >
              Kosongkan Riwayat Transaksi ({transactions.length} Mutasi)
            </button>
          </div>

          {/* Reset Total to Factory Initial */}
          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Reset Total ke Katalog Awal
              </div>
              <p className="text-[11px] text-rose-700/80 mt-1">
                Mengembalikan 100% data barang dan stok ke data bawaan awal tanpa mutasi apapun.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="w-full px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              Reset Total ke Data Awal
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: WORKSPACE DESTRUCTIVE OPERATION */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl w-fit">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                {confirmModal.description}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: CLEAR TRANSACTIONS */}
      {showClearTxConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl w-fit">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">
                Kosongkan Seluruh Riwayat Transaksi?
              </h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Tindakan ini akan menghapus {transactions.length} riwayat transaksi keluar & masuk. Daftar master barang dan stok tidak akan diubah.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowClearTxConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearTransactionsOnly}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Ya, Kosongkan Riwayat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: RESET TOTAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="p-3 bg-rose-100 text-rose-800 rounded-xl w-fit">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">
                Konfirmasi Reset Total ke Data Awal
              </h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Apakah Anda yakin ingin mengatur ulang data? Semua perubahan data barang dan riwayat transaksi yang Anda buat akan dikembalikan ke data awal bawaan.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
