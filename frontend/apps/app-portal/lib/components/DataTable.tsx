"use client";

import React, { useState } from 'react';

interface Column {
  key: string;
  label: string;
  render?: (item: any) => React.ReactNode;
}

interface Action {
  label: string;
  icon: string;
  onClick: (item: any) => void;
  color?: string;
  bgColor?: string;
}

interface DataTableProps {
  title?: string;
  subtitle?: string;
  data: any[];
  columns: Column[];
  actions?: Action[];
  loading?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  filterOptions?: { label: string; value: string }[];
  onSearch?: (term: string) => void;
  onFilter?: (value: string) => void;
  searchTerm?: string;
  filterValue?: string;
  createButton?: {
    label: string;
    onClick: () => void;
  };
  stats?: { label: string; value: string | number; color?: string }[];
}

export default function DataTable({
  title,
  subtitle,
  data,
  columns,
  actions,
  loading,
  emptyIcon = '📋',
  emptyTitle = 'No Data Found',
  emptyMessage = 'No items to display.',
  searchPlaceholder = 'Search...',
  filterOptions,
  onSearch,
  onFilter,
  searchTerm = '',
  filterValue = '',
  createButton,
  stats,
}: DataTableProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    onSearch?.(value);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            {title && <h2 className="text-lg font-bold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          
          <div className="flex items-center gap-3">
            {onSearch && (
              <div className="relative">
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={localSearch}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-56 text-sm bg-white"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            )}
            
            {onFilter && filterOptions && (
              <select
                value={filterValue}
                onChange={(e) => onFilter(e.target.value)}
                className="py-2 px-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                {filterOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            
            {createButton && (
              <button
                onClick={createButton.onClick}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl hover:from-indigo-600 hover:to-blue-700 transition-all shadow-sm text-sm font-medium flex items-center gap-2"
              >
                <span className="text-lg">+</span> {createButton.label}
              </button>
            )}
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="flex gap-4 mt-4">
            {stats.map((stat, i) => (
              <div key={i} className={`px-4 py-2 rounded-xl ${stat.color || 'bg-indigo-100 text-indigo-700'}`}>
                <span className="font-bold">{stat.value}</span>
                <span className="ml-2 text-sm">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-6xl mb-4">{emptyIcon}</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{emptyTitle}</h3>
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
                {actions && actions.length > 0 && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item: any, index: number) => (
                <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4">
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => action.onClick(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              action.bgColor || 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            } ${action.color || ''}`}
                          >
                            {action.icon} {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 border-b bg-gradient-to-r from-slate-50 to-gray-50 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
    'bg-gradient-to-br from-amber-400 to-amber-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
  ];
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const colorIndex = name?.charCodeAt(0) || 0;
  
  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold ${colors[colorIndex % colors.length]}`}>
      {initials}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'error' | 'info' | 'default' }) {
  const variants = {
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer }: { 
  open: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode; 
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    success: 'bg-green-500 text-white hover:bg-green-600',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, type = 'text', required }: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options, placeholder }: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}