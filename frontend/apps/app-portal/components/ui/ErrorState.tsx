import { AlertCircle } from "lucide-react";

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
      <p className="text-red-500 font-medium mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-indigo-600 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
