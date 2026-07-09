/**
 * Provides a ref for a scroll container plus a helper to reset it to the top-left.
 * Used by paginated list pages so paging / page-size changes start from the top.
 */
import { useRef, useCallback } from 'react';

export function useScrollReset<T extends HTMLElement = HTMLDivElement>() {
    const scrollRef = useRef<T | null>(null);

    const resetScroll = useCallback(() => {
        scrollRef.current?.scrollTo({ top: 0, left: 0 });
    }, []);

    return { scrollRef, resetScroll };
}
