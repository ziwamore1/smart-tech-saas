export class ChartRenderer {
  generateBarChartSvg(
    labels: string[],
    data: number[],
    width = 600,
    height = 300,
    barColor = '#1a56db',
  ): string {
    const maxVal = Math.max(...data, 1);
    const padding = { top: 20, right: 20, bottom: 50, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barW = chartW / labels.length - 8;

    const bars = labels
      .map((label, i) => {
        const barH = (data[i] / maxVal) * chartH;
        const x = padding.left + i * (chartW / labels.length) + 4;
        const y = padding.top + chartH - barH;
        return `
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${barColor}" rx="3" />
          <text x="${x + barW / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#374151">${label}</text>
          <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10" fill="#6b7280">${data[i]}</text>
        `;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white" />
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="#e5e7eb" stroke-width="1" />
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#e5e7eb" stroke-width="1" />
      ${bars}
    </svg>`;
  }

  generateDistributionCurveSvg(
    data: Array<{ label: string; value: number }>,
    width = 600,
    height = 250,
    color = '#1a56db',
  ): string {
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const stepX = chartW / (data.length - 1 || 1);

    const points = data
      .map((d, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - (d.value / maxVal) * chartH;
        return `${x},${y}`;
      })
      .join(' ');

    const bars = data
      .map((d, i) => {
        const x = padding.left + i * stepX - stepX / 4;
        const w = stepX / 2;
        const barH = (d.value / maxVal) * chartH;
        const y = padding.top + chartH - barH;
        return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" fill="${color}22" rx="2" />`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white" />
      ${bars}
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" />
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#e5e7eb" stroke-width="1" />
      ${data
        .map(
          (d, i) =>
            `<text x="${padding.left + i * stepX}" y="${height - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${d.label}</text>`,
        )
        .join('')}
    </svg>`;
  }

  generateRadarChartSvg(
    labels: string[],
    datasets: Array<{ label: string; data: number[]; color: string }>,
    width = 400,
    height = 400,
  ): string {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    const angleStep = (2 * Math.PI) / labels.length;
    const levels = 5;

    const grid = Array.from({ length: levels }, (_, level) => {
      const r = (radius * (level + 1)) / levels;
      const pts = labels
        .map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return `${x},${y}`;
        })
        .join(' ');
      return `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="1" />`;
    }).join('');

    const axes = labels
      .map((label, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const lx = cx + (radius + 18) * Math.cos(angle);
        const ly = cy + (radius + 18) * Math.sin(angle);
        return `
          <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
          <text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" fill="#374151" dominant-baseline="middle">${label}</text>
        `;
      })
      .join('');

    const ds = datasets
      .map((dataset) => {
        const pts = dataset.data
          .map((val, i) => {
            const r = (val / 100) * radius;
            const angle = angleStep * i - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            return `${x},${y}`;
          })
          .join(' ');
        return `<polygon points="${pts}" fill="${dataset.color}33" stroke="${dataset.color}" stroke-width="2" />`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white" />
      ${grid}
      ${axes}
      ${ds}
      ${datasets
        .map(
          (ds, di) =>
            `<rect x="${10}" y="${height - 20 - di * 18}" width="12" height="12" fill="${ds.color}" rx="2" /><text x="${28}" y="${height - 10 - di * 18}" font-size="10" fill="#374151">${ds.label}</text>`,
        )
        .join('')}
    </svg>`;
  }

  generateHeatmapSvg(
    data: Array<{ row: string; col: string; value: number }>,
    width = 700,
    height = 400,
  ): string {
    const rows = [...new Set(data.map((d) => d.row))];
    const cols = [...new Set(data.map((d) => d.col))];
    const cellW = Math.min(80, (width - 100) / cols.length);
    const cellH = Math.min(30, (height - 60) / rows.length);
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    const getColor = (val: number) => {
      const intensity = val / maxVal;
      const r = Math.round(255 - intensity * 200);
      const g = Math.round(255 - intensity * 100);
      const b = Math.round(255 - intensity * 50);
      return `rgb(${r},${g},${b})`;
    };

    const cells = data
      .map((d) => {
        const rowIdx = rows.indexOf(d.row);
        const colIdx = cols.indexOf(d.col);
        const x = 100 + colIdx * cellW;
        const y = 40 + rowIdx * cellH;
        return `
          <rect x="${x}" y="${y}" width="${cellW - 2}" height="${cellH - 2}" fill="${getColor(d.value)}" rx="2" />
          <text x="${x + cellW / 2}" y="${y + cellH / 2}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${d.value > maxVal / 2 ? 'white' : '#374151'}">${d.value.toFixed(1)}</text>
        `;
      })
      .join('');

    const rowLabels = rows
      .map(
        (row, i) =>
          `<text x="90" y="${40 + i * cellH + cellH / 2}" text-anchor="end" dominant-baseline="central" font-size="10" fill="#374151">${row}</text>`,
      )
      .join('');

    const colLabels = cols
      .map(
        (col, i) =>
          `<text x="${100 + i * cellW + cellW / 2}" y="30" text-anchor="middle" font-size="10" fill="#374151">${col}</text>`,
      )
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white" />
      ${rowLabels}
      ${colLabels}
      ${cells}
    </svg>`;
  }

  generateTrendLineSvg(
    dataPoints: Array<{ label: string; value: number }>,
    width = 600,
    height = 250,
    lineColor = '#1a56db',
    fillColor = '#1a56db',
  ): string {
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...dataPoints.map((d) => d.value), 1);
    const stepX = chartW / (dataPoints.length - 1 || 1);

    if (dataPoints.length < 2) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#9ca3af">Insufficient data</text></svg>`;
    }

    const points = dataPoints
      .map((d, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - (d.value / maxVal) * chartH;
        return `${x},${y}`;
      })
      .join(' ');

    const areaPoints = `${padding.left},${padding.top + chartH} ${points} ${padding.left + (dataPoints.length - 1) * stepX},${padding.top + chartH}`;

    const dots = dataPoints
      .map((d, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH - (d.value / maxVal) * chartH;
        return `<circle cx="${x}" cy="${y}" r="3.5" fill="${lineColor}" stroke="white" stroke-width="1.5" />`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="white" />
      <polygon points="${areaPoints}" fill="${fillColor}15" />
      <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" />
      ${dots}
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#e5e7eb" stroke-width="1" />
      ${dataPoints
        .map(
          (d, i) =>
            `<text x="${padding.left + i * stepX}" y="${height - 5}" text-anchor="middle" font-size="9" fill="#6b7280">${d.label}</text>`,
        )
        .join('')}
      ${dataPoints
        .map((d, i) => {
          const x = padding.left + i * stepX;
          const y = padding.top + chartH - (d.value / maxVal) * chartH;
          return `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="9" fill="#6b7280">${d.value}</text>`;
        })
        .join('')}
    </svg>`;
  }
}
