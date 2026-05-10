import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks the pending state of an async action (e.g. a button-triggered RPC
 * call or contract write). Returns `pending: true` for the duration of the
 * call and flips back to `false` once it settles. Ignores state updates
 * after the host component unmounts.
 *
 * ```tsx
 * const { pending, run } = useAsyncAction()
 * <button onClick={() => run(refresh)} disabled={pending}>
 *   {pending ? 'refreshing…' : 'refresh'}
 * </button>
 * ```
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (mounted.current) setPending(true)
    try {
      return await action()
    } finally {
      if (mounted.current) setPending(false)
    }
  }, [])

  return { pending, run }
}
