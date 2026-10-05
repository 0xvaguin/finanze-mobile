import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppProvider';

export interface AsyncData<T> { data: T | null; loading: boolean; error: string | null; reload: () => void }

/** Carrega dados do repositorio; recarrega quando `revision` (qualquer escrita) ou `deps` mudam. */
export function useRepoData<T>(load: () => Promise<T>, deps: unknown[]): AsyncData<T> {
  const { revision } = useApp();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadRef.current().then(
      (data) => { if (mine === seq.current) setState({ data, loading: false, error: null }); },
      (e: unknown) => { if (mine === seq.current) setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar.' }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
