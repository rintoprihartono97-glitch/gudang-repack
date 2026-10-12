import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Item } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { MapPin, Search } from 'lucide-react';

export interface ItemAutocompleteHandle {
  focus: () => void;
}

interface ItemAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem: (item: Item) => void;
  onNextField?: () => void;
  placeholder?: string;
  field?: 'kode' | 'nama' | 'all';
  className?: string;
  autoFocus?: boolean;
  filterLokasi?: string;
  size?: 'sm' | 'md' | 'lg';
  dropdownAlign?: 'left' | 'right';
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
}

export const ItemAutocomplete = forwardRef<ItemAutocompleteHandle, ItemAutocompleteProps>(({
  value,
  onChange,
  onSelectItem,
  onNextField,
  placeholder = 'Ketik nama barang...',
  field = 'all',
  className = '',
  autoFocus = false,
  filterLokasi,
  size = 'md',
  dropdownAlign = 'left'
}, ref) => {
  const { items } = useInventory();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLTableSectionElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  const query = value.trim().toLowerCase();

  // Filter items matching query or show initial top items when opened
  const filteredItems = React.useMemo(() => {
    let pool = items;
    if (filterLokasi) {
      pool = pool.filter(item => item.lokasi === filterLokasi);
    }

    if (!query) {
      // When input is empty, show top 15 items so suggestions are immediately visible
      return pool.slice(0, 15);
    }

    return pool
      .filter(item => {
        const matchKode = (item.kode || '').toLowerCase().includes(query);
        const matchNama = (item.nama || '').toLowerCase().includes(query);
        const matchLokasi = (item.lokasi || '').toLowerCase().includes(query);

        if (field === 'kode') return matchKode;
        if (field === 'nama') return matchNama;
        return matchNama || matchKode || matchLokasi;
      })
      .slice(0, 25);
  }, [items, query, field, filterLokasi]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(filteredItems.length > 0 ? 0 : -1);
  }, [filteredItems]);

  // Calculate and update dropdown screen position
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const popupWidth = Math.min(780, viewportWidth - 24);
    let left = dropdownAlign === 'right' ? rect.right - popupWidth : rect.left;

    // Constrain left within screen
    if (left + popupWidth > viewportWidth - 12) {
      left = viewportWidth - popupWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // If less than 240px below but more than 200px above, open above
    const openAbove = spaceBelow < 240 && spaceAbove > 200;

    if (openAbove) {
      const maxHeight = Math.min(320, spaceAbove - 16);
      setDropdownPos({
        bottom: viewportHeight - rect.top + 4,
        left,
        width: popupWidth,
        maxHeight,
        openAbove: true
      });
    } else {
      const maxHeight = Math.min(360, Math.max(180, spaceBelow - 16));
      setDropdownPos({
        top: rect.bottom + 4,
        left,
        width: popupWidth,
        maxHeight,
        openAbove: false
      });
    }
  }, [dropdownAlign]);

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectItem = (item: Item) => {
    onSelectItem(item);
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        updatePosition();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      if (filteredItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        e.preventDefault();
        const selected = filteredItems[highlightedIndex];
        selectItem(selected);
        if (onNextField) {
          setTimeout(() => onNextField(), 40);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (listRef.current) {
      const rows = listRef.current.children;
      if (rows[index]) {
        (rows[index] as HTMLElement).scrollIntoView({
          block: 'nearest'
        });
      }
    }
  };

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2 px-3 text-sm',
    lg: 'py-2.5 px-4 text-base'
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
            updatePosition();
          }}
          onFocus={() => {
            setIsOpen(true);
            updatePosition();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          title={value}
          className={`w-full bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-950 font-bold text-xs sm:text-sm transition-colors shadow-2xs ${sizeClasses[size]}`}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
            title="Hapus"
          >
            ×
          </button>
        )}
      </div>

      {/* Suggestion Dropdown rendered via Portal directly to body to ensure it is ALWAYS clearly visible on screen without being clipped by table overflow */}
      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed',
            top: dropdownPos.top !== undefined ? `${dropdownPos.top}px` : 'auto',
            bottom: dropdownPos.bottom !== undefined ? `${dropdownPos.bottom}px` : 'auto',
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            maxHeight: `${dropdownPos.maxHeight}px`,
            zIndex: 99999
          }}
          className="bg-white border-2 border-emerald-500 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/20"
        >
          {/* Header bar of suggestions */}
          <div className="bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold flex items-center justify-between flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-300" />
              <span>Saran Barang {query ? `untuk "${value}"` : ''} ({filteredItems.length} barang)</span>
            </span>
            <span className="text-[11px] text-emerald-200 font-normal hidden sm:inline">
              Gunakan panah &uarr;&darr; lalu tekan <strong>Enter / Tab</strong> untuk memilih
            </span>
          </div>

          {/* Table content */}
          {filteredItems.length > 0 ? (
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2 px-3 w-32 font-mono text-[11px]">Kode Barang</th>
                    <th className="py-2 px-3 min-w-[320px]">Nama Barang</th>
                    <th className="py-2 px-2.5 w-20 text-center">Satuan</th>
                    <th className="py-2 px-3 w-36">Lokasi</th>
                    <th className="py-2 px-3 w-28 text-right">Stok Saat Ini</th>
                  </tr>
                </thead>
                <tbody ref={listRef} className="divide-y divide-gray-100">
                  {filteredItems.map((item, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <tr
                        key={item.id}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onMouseDown={e => {
                          e.preventDefault();
                          selectItem(item);
                          if (onNextField) {
                            setTimeout(() => onNextField(), 40);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-emerald-100/90 text-emerald-950 font-bold border-l-4 border-emerald-700'
                            : 'text-gray-800 hover:bg-emerald-50/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-900 whitespace-nowrap">
                          {item.kode || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-gray-950 font-bold text-xs sm:text-sm leading-tight">
                          {item.nama}
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-gray-600 font-medium">
                          {item.satuan}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-[11px] whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            {item.lokasi}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                              item.stok === 0
                                ? 'bg-rose-100 text-rose-700'
                                : item.stok <= 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.stok}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 text-xs">
              Tidak ada barang yang cocok dengan kata kunci &quot;<strong className="text-gray-800">{value}</strong>&quot;.
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});

ItemAutocomplete.displayName = 'ItemAutocomplete';
