/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryProvider } from './context/InventoryContext';
import { useHashRouter } from './hooks/useHashRouter';
import { Header } from './components/Layout/Header';

import { DashboardView } from './components/Views/DashboardView';
import { InputBarangMasukView } from './components/Views/InputBarangMasukView';
import { InputBarangKeluarView } from './components/Views/InputBarangKeluarView';
import { InputBarangBaruView } from './components/Views/InputBarangBaruView';
import { KelolaBarangView } from './components/Views/KelolaBarangView';
import { RiwayatStokView } from './components/Views/RiwayatStokView';
import { KartuStokView } from './components/Views/KartuStokView';
import { BackupRestoreView } from './components/Views/BackupRestoreView';

const MainApp: React.FC = () => {
  const { route, param, goBack, canGoBack } = useHashRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* Header Bar with direct hamburger menu popover */}
      <Header
        onGoBack={goBack}
        canGoBack={canGoBack}
        currentRoute={route}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
        {route === 'dashboard' && <DashboardView />}
        {route === 'barang-masuk' && <InputBarangMasukView />}
        {route === 'barang-keluar' && <InputBarangKeluarView />}
        {route === 'barang-baru' && <InputBarangBaruView />}
        {route === 'kelola-barang' && <KelolaBarangView />}
        {route === 'riwayat-stok' && <RiwayatStokView />}
        {route === 'kartu-stok' && <KartuStokView initialItemId={param} />}
        {route === 'backup-restore' && <BackupRestoreView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-800">GUDANG REPACK</span>
            <span>&bull;</span>
            <span>Sistem Manajemen Pergudangan & Kartu Stok</span>
          </div>
          <div className="text-gray-400">
            Dukungan Tab Baru &bull; Export Excel (.xlsx) &bull; Sinkronisasi Otomatis
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <MainApp />
    </InventoryProvider>
  );
}
