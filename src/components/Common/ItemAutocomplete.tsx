import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Item } from '../../types';
import { useInventory } from '../../context/InventoryContext';
import { Search, MapPin } from 'lucide-react';

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

export const ItemAutocomplete = forwardRef<ItemAutocompleteHandle, ItemAutocompleteProps>(({
  value,
  onChange,
  onSelectItem,
  onNextField,
  placeholder = 'Cari nama barang, kode...',
  field = 'all',
  className = '',
  autoFocus = false,
  filterLokasi,
  size = 'md',
  dropdownAlign = 'left'
}, ref) => {
  const { items } = useInventory();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLTableSectionElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  const query = value.trim().toLowerCase();

  const filteredItems = React.useMemo(() => {
    if (!query) return [];

    let pool = items;
    if (filterLokasi) {
      pool = pool.filter(item => item.lokasi === filterLokasi);
    }

    return pool
      .filter(item => {
        const matchKode = (item.kode || '').toLowerCase().includes(query);
        const matchNama = (item.nama || '').toLowerCase().includes(query);
        const matchLokasi = (item.lokasi || '').toLowerCase().includes(query);

        if (field === 'kode') return matchKode;
        if (field === 'nama') return matchNama;
        return matchKode || matchNama || matchLokasi;
      })
      .slice(0, 20); // Show top 20 matches
  }, [items, query, field, filterLokasi]);

  useEffect(() => {
    setHighlightedIndex(filteredItems.length > 0 ? 0 : -1);
  }, [filteredItems]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation: ArrowDown, ArrowUp, Enter, Tab, Escape
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredItems.length === 0) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && query) {
        setIsOpen(true);
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
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        e.preventDefault();
        selectItem(filteredItems[highlightedIndex]);
        if (onNextField) {
          // Move to next field (e.g. Qty)
          setTimeout(() => onNextField(), 30);
        }
      }
    } else if (e.key === 'Escape') {
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

  const selectItem = (item: Item) => {
    onSelectItem(item);
    setIsOpen(false);
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
          }}
          onFocus={() => {
            if (query) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          title={value}
          className={`w-full bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-950 font-bold text-xs sm:text-sm transition-colors shadow-2xs ${sizeClasses[size]}`}
          autoComplete="off"
          spellCheck={false}
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
          >
            ×
          </button>
        )}
      </div>

      {/* Suggestion Dropdown as a full-width structured table that accommodates full name length */}
      {isOpen && filteredItems.length > 0 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute z-50 mt-1 bg-white border border-emerald-400 rounded-xl shadow-2xl overflow-hidden max-h-84 overflow-y-auto ${
            dropdownAlign === 'right' ? 'right-0' : 'left-0'
          } min-w-[640px] sm:min-w-[740px] max-w-[92vw] animate-in fade-in duration-150 ring-1 ring-black/5`}
        >
          <div className="bg-emerald-800 text-white px-3.5 py-1.5 text-[11px] font-bold flex items-center justify-between">
            <span>Saran Barang ({filteredItems.length} pilihan)</span>
            <span className="text-[10px] text-emerald-200 font-normal">
              Gunakan panah &uarr;&darr; & tekan <strong>Enter / Tab</strong> untuk memilih
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3 w-28 font-mono">Kode</th>
                <th className="py-2 px-3 min-w-[340px]">Nama Barang</th>
                <th className="py-2 px-2.5 w-20 text-center">Satuan</th>
                <th className="py-2 px-3 w-36">Lokasi</th>
                <th className="py-2 px-3 w-24 text-right">Stok</th>
              </tr>
            </thead>
            <tbody ref={listRef} className="divide-y divide-gray-100">
              {filteredItems.map((item, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      selectItem(item);
                      if (onNextField) {
                        setTimeout(() => onNextField(), 30);
                      }
                    }}
                    className={`cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-emerald-100/90 text-emerald-950 font-bold border-l-4 border-emerald-600'
                        : 'text-gray-800 hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                      {item.kode || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 font-bold leading-normal">
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
      )}

      {isOpen && query && filteredItems.length === 0 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 left-0 mt-1 min-w-[320px] bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs text-gray-500 text-center"
        >
          Tidak ada barang cocok dengan "{value}"
        </div>
      )}
    </div>
  );
});

ItemAutocomplete.displayName = 'ItemAutocomplete';
