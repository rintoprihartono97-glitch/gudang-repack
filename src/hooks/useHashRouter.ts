import { useState, useEffect, useCallback, useRef } from 'react';
import { AppRoute } from '../types';

export interface RouteState {
  route: AppRoute;
  param?: string;
  queryParams: Record<string, string>;
  fullHash: string;
}

export function parseHash(hashString: string): RouteState {
  const cleanHash = hashString.startsWith('#') ? hashString.slice(1) : hashString;
  const [pathPart, queryPart] = cleanHash.split('?');
  
  const segments = (pathPart || '').split('/').filter(Boolean);
  const routeCandidate = segments[0] as AppRoute;
  
  const validRoutes: AppRoute[] = [
    'dashboard',
    'barang-masuk',
    'barang-keluar',
    'barang-baru',
    'kelola-barang',
    'riwayat-stok',
    'kartu-stok',
    'backup-restore'
  ];

  const route: AppRoute = validRoutes.includes(routeCandidate) ? routeCandidate : 'dashboard';
  const param = segments[1] || undefined;

  const queryParams: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });
  }

  // If id is in queryParams and no path param, use queryParams.id
  const finalParam = param || queryParams.id;

  return {
    route,
    param: finalParam,
    queryParams,
    fullHash: hashString || '#/dashboard'
  };
}

export function useHashRouter() {
  const [state, setState] = useState<RouteState>(() => {
    return parseHash(window.location.hash || '#/dashboard');
  });

  const historyStack = useRef<string[]>([]);

  useEffect(() => {
    // If initial hash is empty, set default to #/dashboard
    if (!window.location.hash || window.location.hash === '#/') {
      window.location.hash = '#/dashboard';
    }

    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash);
      setState(parsed);
      historyStack.current.push(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((targetHash: string) => {
    const formatted = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
    window.location.hash = formatted;
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/dashboard';
    }
  }, []);

  return {
    ...state,
    navigate,
    goBack,
    canGoBack: window.history.length > 1
  };
}
