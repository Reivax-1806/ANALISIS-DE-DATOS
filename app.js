// app.js
document.addEventListener('DOMContentLoaded', () => {
    const PARTICIPANTS = ["P1", "P2", "P3", "P4", "P5"];
    const DAYS_COUNT = 14;
    const STORAGE_KEY = 'dailyStepsData';

    // Referencias DOM
    const stepForm = document.getElementById('step-form');
    const dataTable = document.getElementById('data-table');
    const participantStatsTableBody = document.querySelector('#participant-stats-table tbody');
    const globalStatsList = document.getElementById('global-stats-list');
    const messageDiv = document.getElementById('message');
    const ctxChart = document.getElementById('dailyStepsChart').getContext('2d');
    let dailyStepsChartInstance;

    // --- 1. Persistencia de Datos (LocalStorage) ---

    function loadData() {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                return JSON.parse(storedData);
            }
        } catch (e) {
            console.error("Error loading data from localStorage:", e);
        }
        // Inicializar estructura: 5 participantes, 14 días con 0 pasos
        return PARTICIPANTS.reduce((acc, p) => {
            acc[p] = new Array(DAYS_COUNT).fill(0);
            return acc;
        }, {});
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // --- 2. Manejo del Formulario ---

    stepForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const participant = document.getElementById('participante').value;
        const day = parseInt(document.getElementById('dia').value);
        const steps = parseInt(document.getElementById('pasos').value);

        if (!participant || day < 1 || day > DAYS_COUNT || steps < 0 || isNaN(steps)) {
            messageDiv.innerHTML = '<div class="alert alert-warning">Por favor, verifique los datos ingresados.</div>';
            return;
        }

        const data = loadData();
        const dayIndex = day - 1;

        if (data[participant]) {
            data[participant][dayIndex] = steps;
            saveData(data);
            messageDiv.innerHTML = `<div class="alert alert-success">Dato de ${participant} (Día ${day}) actualizado a ${steps} pasos.</div>`;
            updateUI(); // Refrescar toda la interfaz
        } else {
            messageDiv.innerHTML = '<div class="alert alert-danger">Error: Participante inválido.</div>';
        }
        
        // Mantener el participante seleccionado, pero limpiar día y pasos para siguiente ingreso rápido
        document.getElementById('dia').value = '';
        document.getElementById('pasos').value = '';
    });

    // --- 3. Lógica Estadística ---

    function calculateStatistics(data) {
        const allSteps = [];
        const dailyTotals = new Array(DAYS_COUNT).fill(0);
        const dailyCounts = new Array(DAYS_COUNT).fill(0);
        const stats = { participant_stats: {}, daily_averages: [], global_stats: {} };

        for (const participant of PARTICIPANTS) {
            const steps = data[participant] || new Array(DAYS_COUNT).fill(0);
            let sum = 0;
            let count = 0;
            let min = Infinity;
            let max = -Infinity;

            steps.forEach((s, dayIndex) => {
                // Solo contar días con pasos > 0 para min/max/std
                if (s >= 0) { 
                    sum += s;
                    count++;
                    min = Math.min(min, s);
                    max = Math.max(max, s);
                    
                    dailyTotals[dayIndex] += s;
                    dailyCounts[dayIndex]++;
                    allSteps.push(s);
                }
            });

            // Cálculo de Desviación Estándar (simple, muestral si count > 1)
            const mean = count > 0 ? sum / count : 0;
            let stdDev = 0;
            if (count > 1) {
                const variance = steps.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1);
                stdDev = Math.sqrt(variance);
            }

            stats.participant_stats[participant] = {
                media: mean.toFixed(2),
                std: stdDev.toFixed(2),
                min: min === Infinity ? 0 : min,
                max: max === -Infinity ? 0 : max
            };
        }

        // Estadísticas Diarias
        stats.daily_averages = dailyTotals.map((total, i) => 
            dailyCounts[i] > 0 ? parseFloat((total / dailyCounts[i]).toFixed(2)) : 0
        );

        // Estadísticas Globales
        allSteps.sort((a, b) => a - b);
        const globalSum = allSteps.reduce((a, b) => a + b, 0);
        const globalCount = allSteps.length;
        const globalMean = globalCount > 0 ? (globalSum / globalCount) : 0;
        
        let median = 0;
        if (globalCount > 0) {
            const mid = Math.floor(globalCount / 2);
            median = globalCount % 2 !== 0 ? allSteps[mid] : (allSteps[mid - 1] + allSteps[mid]) / 2;
        }

        stats.global_stats = {
            media_global: globalMean.toFixed(2),
            mediana_global: median.toFixed(2),
            total_pasos_general: globalSum
        };

        return stats;
    }

    // --- 4. Renderizado de la Interfaz ---

    function renderDataTable(data) {
        let html = '<thead><tr><th>Participante</th>';
        for (let i = 1; i <= DAYS_COUNT; i++) {
            html += `<th>Día ${i}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (const participant of PARTICIPANTS) {
            const steps = data[participant] || new Array(DAYS_COUNT).fill(0);
            html += `<tr><td>${participant}</td>`;
            steps.forEach(s => {
                html += `<td>${s}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody>';
        dataTable.innerHTML = html;
    }

    function renderStatistics(stats) {
        // Por Participante
        participantStatsTableBody.innerHTML = '';
        for (const participant of PARTICIPANTS) {
            const s = stats.participant_stats[participant];
            participantStatsTableBody.innerHTML += `
                <tr>
                    <td>${participant}</td>
                    <td>${s.media}</td>
                    <td>${s.std}</td>
                    <td>${s.min}</td>
                    <td>${s.max}</td>
                </tr>`;
        }

        // Globales
        const global = stats.global_stats;
        globalStatsList.innerHTML = `
            <li class="list-group-item">Media Global (Pasos/Día/Participante): <strong>${global.media_global}</strong></li>
            <li class="list-group-item">Mediana Global: <strong>${global.mediana_global}</strong></li>
            <li class="list-group-item">Total Pasos General (14 días, 5 P.): <strong>${global.total_pasos_general}</strong></li>
        `;
    }
    
    function renderChart(dailyAverages) {
        const labels = Array.from({ length: DAYS_COUNT }, (_, i) => `Día ${i + 1}`);

        if (dailyStepsChartInstance) {
            dailyStepsChartInstance.destroy();
        }

        dailyStepsChartInstance = new Chart(ctxChart, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pasos Promedio',
                    data: dailyAverages,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Pasos Promedio' } },
                    x: { title: { display: true, text: 'Día' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateUI() {
        const data = loadData();
        const stats = calculateStatistics(data);
        
        renderDataTable(data);
        renderStatistics(stats);
        renderChart(stats.daily_averages);
    }

    // Inicializar la aplicación
    updateUI();
});