'use client';

interface RankingEntry {
  rank: number;
  name: string;
  value: number;
  change?: 'up' | 'down' | 'same';
  secondaryValue?: string;
}

interface RankingTableProps {
  data: RankingEntry[];
  title?: string;
  valueLabel?: string;
  maxItems?: number;
  loading?: boolean;
}

export default function RankingTable({ data, title, valueLabel = 'Score', maxItems = 10, loading }: RankingTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  const items = data.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{valueLabel}</th>
                {items[0]?.secondaryValue !== undefined && (
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Detail</th>
                )}
                {items[0]?.change !== undefined && (
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-12">Δ</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.rank} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {entry.rank}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-medium text-gray-900 text-sm">{entry.name}</td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900">{entry.value.toFixed(1)}</td>
                  {entry.secondaryValue !== undefined && (
                    <td className="py-3 px-2 text-right text-sm text-gray-500">{entry.secondaryValue}</td>
                  )}
                  {entry.change !== undefined && (
                    <td className="py-3 px-2 text-center">
                      {entry.change === 'up' && <span className="text-green-500">↑</span>}
                      {entry.change === 'down' && <span className="text-red-500">↓</span>}
                      {entry.change === 'same' && <span className="text-gray-400">–</span>}
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
