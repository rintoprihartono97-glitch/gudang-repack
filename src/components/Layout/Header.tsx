import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from '../Navigation/NavLink';
import { ItemAutocomplete } from '../Common/ItemAutocomplete';
import { ItemQuickDetailModal } from '../Common/ItemQuickDetailModal';
import { Item, AppRoute } from '../../types';
import { 
  Home, 
  Menu, 
  Undo2, 
  X,
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  FileEdit,
  ClipboardList,
  PackageSearch,
  Database
} from 'lucide-react';

interface HeaderProps {
  onGoBack: () => void;
  canGoBack: boolean;
  currentRoute?: AppRoute;
}

export const Header: React.FC<HeaderProps> = ({
  onGoBack,
  canGoBack,
  currentRoute
}) => {
  const [searchVal, setSearchVal] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    {
      label: 'Dashboard Gudang',
      href: '#/dashboard',
      route: 'dashboard' as AppRoute,
      icon: LayoutDashboard,
      desc: 'Ringkasan stok & pergerakan'
    },
    {
      label: '1. Input Barang Masuk',
      href: '#/barang-masuk',
      route: 'barang-masuk' as AppRoute,
      icon: ArrowDownLeft,
      desc: 'Pencatatan mutasi penerimaan'
    },
    {
      label: '2. Input Barang Keluar',
      href: '#/barang-keluar',
      route: 'barang-keluar' as AppRoute,
      icon: ArrowUpRight,
      desc: 'Pencatatan mutasi pengeluaran'
    },
    {
      label: '3. Input Barang Baru',
      href: '#/barang-baru',
      route: 'barang-baru' as AppRoute,
      icon: PlusCircle,
      desc: 'Daftarkan item / SKU baru'
    },
    {
      label: '4. Edit / Hapus Barang',
      href: '#/kelola-barang',
      route: 'kelola-barang' as AppRoute,
      icon: FileEdit,
      desc: 'Manajemen katalog & penyesuaian'
    },
    {
      label: '5. Laporan / Riwayat Stok',
      href: '#/riwayat-stok',
      route: 'riwayat-stok' as AppRoute,
      icon: ClipboardList,
      desc: 'Log keluar masuk per tanggal'
    },
    {
      label: '6. Kartu Stok Masing-masing',
      href: '#/kartu-stok',
      route: 'kartu-stok' as AppRoute,
      icon: PackageSearch,
      desc: 'Buku besar per item barang'
    },
    {
      label: '7. Backup & Google Sheets',
      href: '#/backup-restore',
      route: 'backup-restore' as AppRoute,
      icon: Database,
      desc: 'Ekspor .xlsx & Google Drive'
    }
  ];

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-emerald-800 text-white shadow-md border-b border-emerald-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Pojok Kiri Atas: Icon Rumah + GUDANG REPACK */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <NavLink
              href="#/dashboard"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-emerald-700/60 transition-colors text-white group"
              title="Kembali ke Dashboard Utama"
            >
              <div className="p-2 bg-emerald-700 group-hover:bg-emerald-600 rounded-lg shadow-xs transition-colors flex items-center justify-center">
                <Home className="w-5 h-5 text-emerald-100" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-wider text-base sm:text-lg leading-tight text-white flex items-center gap-1.5">
                  GUDANG REPACK
                </span>
                <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-medium">
                  Sistem Pergudangan
                </span>
              </div>
            </NavLink>
          </div>

          {/* Bagian Tengah Paling Atas: Kolom Pencarian Barang Autocomplete */}
          <div className="flex-1 max-w-xl mx-auto px-2 relative hidden sm:block">
            <div className="relative">
              <ItemAutocomplete
                value={searchVal}
                onChange={setSearchVal}
                onSelectItem={handleSelectItem}
                placeholder="Cari nama barang,kode..."
                size="md"
                className="w-full shadow-inner"
              />
            </div>
          </div>

          {/* Pojok Kanan Atas: Tombol Kembali/Undo & Hamburger Dropdown Popover */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Tombol Undo / Kembali */}
            <button
              type="button"
              onClick={onGoBack}
              title="Kembali / Undo ke tampilan sebelumnya"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700/80 hover:bg-emerald-700 text-emerald-100 hover:text-white rounded-lg text-xs font-semibold shadow-xs transition-colors border border-emerald-600/60"
            >
              <Undo2 className="w-4 h-4 text-emerald-200" />
              <span className="hidden md:inline">Kembali</span>
            </button>

            {/* Ikon Hamburger dengan Menu Dropdown Langsung */}
            <div ref={menuContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(prev => !prev)}
                title="Buka Menu Navigasi"
                aria-label="Menu Navigasi"
                aria-expanded={isMenuOpen}
                className={`p-2 rounded-lg transition-all border ${
                  isMenuOpen
                    ? 'bg-emerald-900 text-white border-emerald-400 ring-2 ring-emerald-400/50'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600'
                }`}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Menu Popover Langsung dari Ikon Hamburger */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-emerald-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-gray-800">
                  <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                        PILIHAN MENU
                      </span>
                      <p className="text-[10px] text-gray-400">Gudang Repack</p>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      {menuItems.length} Menu
                    </span>
                  </div>

                  <div className="max-h-[75vh] overflow-y-auto py-1 space-y-0.5 px-2">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentRoute === item.route;

                      return (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          isActive={isActive}
                          activeClassName="bg-emerald-700 text-white font-semibold shadow-xs"
                          className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all ${
                            isActive
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-950'
                          }`}
                        >
                          <div
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-emerald-800 text-white'
                                : 'bg-gray-100 group-hover:bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate leading-tight">
                              {item.label}
                            </div>
                            <div
                              className={`text-[10px] truncate ${
                                isActive ? 'text-emerald-100' : 'text-gray-400 group-hover:text-emerald-700'
                              }`}
                            >
                              {item.desc}
                            </div>
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>

                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 text-center rounded-b-2xl">
                    Klik kanan / tekan lama untuk buka di tab baru
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile search bar visible on small screens */}
        <div className="sm:hidden px-4 pb-3">
          <ItemAutocomplete
            value={searchVal}
            onChange={setSearchVal}
            onSelectItem={handleSelectItem}
            placeholder="Cari nama barang,kode..."
            size="sm"
            className="w-full shadow-inner"
          />
        </div>
      </header>

      {/* Quick Detail Modal when item selected from top search */}
      <ItemQuickDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
};
