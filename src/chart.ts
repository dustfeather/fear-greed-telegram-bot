import QuickChart from 'quickchart-js';
import { CHART_CONFIG } from './constants.js';

/**
 * Generate a pie chart with the Fear and Greed Index data.
 * @param greedPercentage - The greed percentage value (0-100)
 * @returns Promise resolving to the chart URL
 */
export async function generatePieChart(greedPercentage: string | number): Promise<string> {
  const chart = new QuickChart();
  chart.setConfig({
    type: 'gauge',
    data: {
      datasets: [
        {
          value: greedPercentage,
          data: CHART_CONFIG.GAUGE_SEGMENTS,
          backgroundColor: CHART_CONFIG.GAUGE_COLORS,
          borderWidth: 0
        }
      ]
    },
    options: {
      valueLabel: {
        fontSize: 22,
        backgroundColor: 'transparent',
        color: '#000',
        formatter: function(value: number): string {
          return value + '%';
        },
        bottomMarginPercentage: 10
      }
    }
  });

  chart.setWidth(CHART_CONFIG.WIDTH).setHeight(CHART_CONFIG.HEIGHT);

  return chart.getUrl();
}

