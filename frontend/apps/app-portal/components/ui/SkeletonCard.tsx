export default function SkeletonCard() {
  return (
    <div className="animate-pulse border rounded-lg p-4">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}
