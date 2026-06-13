'use client';

import { useCallback, useState } from 'react';

/** 服务端分页：page + pageSize 状态，改每页条数时自动回到第 1 页 */
export function useServerPagination(initialPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return { page, setPage, pageSize, onPageSizeChange };
}
