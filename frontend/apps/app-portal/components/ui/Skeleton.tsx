interface SkeletonProps {
  className?: string;
  count?: number;
}

export default function Skeleton({ className = "", count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading">
      {items.map((i) => (
        <div
          key={i}
          className={`bg-gray-200 rounded-lg ${className || "h-4 w-full"}`}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
