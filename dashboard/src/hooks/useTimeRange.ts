import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useTimeRange() {
  const [searchParams, setSearchParams] = useSearchParams();

  const from = searchParams.get('from') || 'now-1h';
  const to = searchParams.get('to') || 'now';

  const setTimeRange = useCallback(
    (newFrom: string, newTo: string) => {
      setSearchParams(
        (params) => {
          params.set('from', newFrom);
          params.set('to', newTo);
          return params;
        },
        { replace: true } // Don't push a million states to browser history for time scrubs
      );
    },
    [setSearchParams]
  );

  return { from, to, setTimeRange };
}
