// Chart management for dashboard
export default class ChartManager {
    constructor() {
        this.reservationsChartInstance = null;
        this.occupancyChartInstance = null;
    }

    async initDashboardCharts(chartData = null) {
        // Wait for DOM to be ready and Chart.js to load
        await new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });

        // Wait a bit more for Chart.js to be available
        let retries = 0;
        while (typeof Chart === 'undefined' && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        try {
            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                console.log('Chart.js not available, loading fallback charts');
                this.loadFallbackCharts();
                return;
            }

            // Destroy existing charts if they exist to prevent memory leaks
            if (this.reservationsChartInstance) {
                this.reservationsChartInstance.destroy();
            }
            if (this.occupancyChartInstance) {
                this.occupancyChartInstance.destroy();
            }

            // Reservations Chart
            const reservationsCtx = document.getElementById('reservationsChart');
            if (reservationsCtx && chartData && chartData.reservationsTrendData) {
                this.reservationsChartInstance = new Chart(reservationsCtx, {
                    type: 'line',
                    data: {
                        labels: chartData.reservationsTrendData.labels,
                        datasets: [{
                            label: 'Rezervasiyalar',
                            data: chartData.reservationsTrendData.data,
                            borderColor: '#cb0c9f',
                            backgroundColor: 'rgba(203, 12, 159, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#cb0c9f',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#cb0c9f'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        }
                    }
                });
            }

            // Occupancy Chart
            const occupancyCtx = document.getElementById('occupancyChart');
            if (occupancyCtx && chartData && chartData.occupancyData) {
                this.occupancyChartInstance = new Chart(occupancyCtx, {
                    type: 'doughnut',
                    data: {
                        labels: chartData.occupancyData.labels,
                        datasets: [{
                            data: chartData.occupancyData.data,
                            backgroundColor: ['#f5365c', '#2dce89', '#fb6340'],
                            borderColor: 'transparent'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 20,
                                    boxWidth: 12,
                                    font: {
                                        size: 14
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });
            }
        } catch (error) {
            console.log('Charts could not be loaded:', error);
            this.loadFallbackCharts();
        }
    }

    loadFallbackCharts() {
        // Load simple fallback charts when Chart.js is not available
        const reservationsCtx = document.getElementById('reservationsChart');
        if (reservationsCtx) {
            reservationsCtx.style.display = 'flex';
            reservationsCtx.style.alignItems = 'center';
            reservationsCtx.style.justifyContent = 'center';
            reservationsCtx.style.color = '#64748b';
            reservationsCtx.innerHTML = '<div style="text-align: center;"><i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>Qrafik yüklənir...</div>';
        }

        const occupancyCtx = document.getElementById('occupancyChart');
        if (occupancyCtx) {
            occupancyCtx.style.display = 'flex';
            occupancyCtx.style.alignItems = 'center';
            occupancyCtx.style.justifyContent = 'center';
            occupancyCtx.style.color = '#64748b';
            occupancyCtx.innerHTML = '<div style="text-align: center;"><i class="fas fa-chart-pie" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>Qrafik yüklənir...</div>';
        }
    }
}