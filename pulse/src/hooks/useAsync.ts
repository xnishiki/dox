import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data?: T
  error?: Error
  loading: boolean
  reload: () => void
}

/** Загрузка данных с отменой устаревших запросов. deps — когда перезагружать. */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ data: s.data, loading: true }))
    fn(ctrl.signal)
      .then((data) => !ctrl.signal.aborted && setState({ data, loading: false }))
      .catch((error) => !ctrl.signal.aborted && setState({ error, loading: false }))
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
