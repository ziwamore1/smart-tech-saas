"use client";

import { useState, useCallback } from "react";

interface UseBulkActionsOptions<T> {
  items: T[];
  getId: (item: T) => string;
  onBulkAction?: (action: string, ids: string[]) => void;
}

export function useBulkActions<T>({ items, getId, onBulkAction }: UseBulkActionsOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectAll(false);
  }, []);

  const selectAllItems = useCallback(() => {
    const allIds = new Set(items.map(getId));
    setSelectedIds(allIds);
    setSelectAll(true);
  }, [items, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAll(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const executeBulkAction = useCallback(
    (action: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      onBulkAction?.(action, ids);
    },
    [selectedIds, onBulkAction]
  );

  return {
    selectedIds: Array.from(selectedIds),
    selectAll,
    toggleSelect,
    selectAllItems,
    clearSelection,
    isSelected,
    executeBulkAction,
    hasSelection: selectedIds.size > 0,
    selectionCount: selectedIds.size,
  };
}
