import QuickChart from 'quickchart-js';

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
          data: [25, 45, 55, 75, 100],
          backgroundColor: ['#f06c00ff', '#ffb9a180', '#e6e6e6', '#b9ede9', '#8cd6c3'],
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

  chart.setWidth(400).setHeight(250);

  return chart.getUrl();
}

