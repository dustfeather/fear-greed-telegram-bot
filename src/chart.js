import QuickChart from 'quickchart-js';

/**
 * Generate a pie chart with the Fear and Greed Index data.
 * @param greedPercentage
 * @returns {Promise<*>}
 */
async function generatePieChart(greedPercentage) {
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
				formatter: function(value) {
					return value + '%';
				},
				bottomMarginPercentage: 10
			}
		}
	});

	chart.setWidth(400).setHeight(250);

	return chart.getUrl();
}

export { generatePieChart };
