import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Drawer({ open, onClose, title, children, width = "400px" }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative bg-white h-full shadow-2xl overflow-y-auto animate-slide-in"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
