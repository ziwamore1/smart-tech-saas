declare module '@mui/x-data-grid' {
  import React from 'react';

  export interface GridColDef {
    field: string;
    headerName?: string;
    width?: number;
    editable?: boolean;
    sortable?: boolean;
    type?: string;
    cellClassName?: ((params: any) => string) | string;
    valueFormatter?: (value: any) => string;
    [key: string]: any;
  }

  export interface GridRowModel {
    id: string | number;
    [key: string]: any;
  }

  export interface GridCellEditStopParams {
    id: string | number;
    field: string;
    value: any;
    [key: string]: any;
  }

  export const GridCellEditStopReasons: {
    cellFocusOut: 'cellFocusOut';
    escapeKeyDown: 'escapeKeyDown';
    enterKeyDown: 'enterKeyDown';
    deleteKeyDown: 'deleteKeyDown';
    tabKeyDown: 'tabKeyDown';
    shiftTabKeyDown: 'shiftTabKeyDown';
  };

  export interface GridEditCellProps {
    value: any;
    [key: string]: any;
  }

  export interface DataGridProps {
    rows: any[];
    columns: GridColDef[];
    pageSizeOptions?: number[];
    initialState?: any;
    disableRowSelectionOnClick?: boolean;
    editMode?: string;
    processRowUpdate?: (newRow: GridRowModel, oldRow: GridRowModel) => any;
    onCellEditStop?: (params: GridCellEditStopParams, event: any) => void;
    sx?: any;
    [key: string]: any;
  }

  export const DataGrid: React.FC<DataGridProps>;
}
