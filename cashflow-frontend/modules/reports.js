// modules/reports.js - Agregar gráficas al reporte

import { api } from '../services/apiService.js';
import { accountService } from '../services/accountService.js';
import { transactionService } from '../services/transactionService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const reportsModule = {
    accounts: [],
    reportData: null,
    currentYear: null,
    chartInstance: null,

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Reportes Financieros</h1>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                Genere reportes detallados de ingresos y egresos. Si el período abarca múltiples años, 
                se mostrará un resumen por año con desglose por cuentas.
            </div>
            
            <!-- Filtros -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-funnel"></i> Filtros de Reporte</h5>
                </div>
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Fecha desde</label>
                            <input type="date" class="form-control" id="filterStartDate" value="${this.getDefaultStartDate()}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Fecha hasta</label>
                            <input type="date" class="form-control" id="filterEndDate" value="${this.getDefaultEndDate()}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Agrupar por</label>
                            <select class="form-select" id="groupBy">
                                <option value="year">Año</option>
                                <option value="month">Mes</option>
                                <option value="quarter">Trimestre</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-primary w-100" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Generar Reporte
                            </button>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <button class="btn btn-success" id="exportExcelBtn">
                                <i class="bi bi-file-excel"></i> Exportar a Excel
                            </button>
                            <button class="btn btn-danger" id="exportPdfBtn">
                                <i class="bi bi-file-pdf"></i> Exportar a PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Resultados del reporte -->
            <div id="reportResults"></div>
        `;

        await this.loadAccounts();
        this.setupEventListeners();
        await this.generateReport();
    },

    getDefaultStartDate() {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        return date.toISOString().split('T')[0];
    },

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    },

    async loadAccounts() {
        try {
            const response = await accountService.getAll();
            if (response.success && response.data) {
                this.accounts = response.data;
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    },

    async generateReport() {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const groupBy = document.getElementById('groupBy').value;

        if (!startDate || !endDate) {
            showAlert('Seleccione un rango de fechas', 'warning');
            return;
        }

        // Mostrar loading
        const resultsDiv = document.getElementById('reportResults');
        resultsDiv.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2">Generando reporte...</p>
            </div>
        `;

        try {
            // Obtener todas las transacciones
            const incomeResponse = await transactionService.getIncomes({ start_date: startDate, end_date: endDate });
            const expenseResponse = await transactionService.getExpenses({ start_date: startDate, end_date: endDate });

            let incomes = incomeResponse.success ? (incomeResponse.data.incomes || incomeResponse.data) : [];
            let expenses = expenseResponse.success ? (expenseResponse.data.expenses || expenseResponse.data) : [];

            // Procesar datos según agrupación
            let reportData;
            if (groupBy === 'year') {
                reportData = this.groupByYear(incomes, expenses);
            } else if (groupBy === 'month') {
                reportData = this.groupByMonth(incomes, expenses, startDate, endDate);
            } else {
                reportData = this.groupByQuarter(incomes, expenses, startDate, endDate);
            }

            this.reportData = reportData;
            this.renderReport(reportData, groupBy);

        } catch (error) {
            console.error('Error generating report:', error);
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error al generar el reporte</div>`;
        }
    },

    groupByYear(incomes, expenses) {
        const years = {};

        // Procesar ingresos
        incomes.forEach(income => {
            const year = new Date(income.date).getFullYear();
            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0
                };
            }

            years[year].incomes.push(income);
            years[year].totalIncome += parseFloat(income.amount_base_currency || income.amount);

            const accountName = income.account_name || 'Sin cuenta';
            if (!years[year].incomeByAccount[accountName]) {
                years[year].incomeByAccount[accountName] = 0;
            }
            years[year].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
        });

        // Procesar egresos
        expenses.forEach(expense => {
            const year = new Date(expense.date).getFullYear();
            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0
                };
            }

            years[year].expenses.push(expense);
            years[year].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);

            const accountName = expense.account_name || 'Sin cuenta';
            if (!years[year].expenseByAccount[accountName]) {
                years[year].expenseByAccount[accountName] = 0;
            }
            years[year].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
        });

        // Ordenar por año
        return Object.values(years).sort((a, b) => a.year - b.year);
    },

    groupByMonth(incomes, expenses, startDate, endDate) {
        const months = {};
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Generar todos los meses en el rango
        const current = new Date(start);
        while (current <= end) {
            const key = `${current.getFullYear()}-${current.getMonth() + 1}`;
            months[key] = {
                year: current.getFullYear(),
                month: current.getMonth() + 1,
                monthName: current.toLocaleString('es', { month: 'long' }),
                incomes: [],
                expenses: [],
                incomeByAccount: {},
                expenseByAccount: {},
                totalIncome: 0,
                totalExpense: 0
            };
            current.setMonth(current.getMonth() + 1);
        }

        // Procesar ingresos
        incomes.forEach(income => {
            const date = new Date(income.date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (months[key]) {
                months[key].incomes.push(income);
                months[key].totalIncome += parseFloat(income.amount_base_currency || income.amount);

                const accountName = income.account_name || 'Sin cuenta';
                if (!months[key].incomeByAccount[accountName]) {
                    months[key].incomeByAccount[accountName] = 0;
                }
                months[key].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
            }
        });

        // Procesar egresos
        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (months[key]) {
                months[key].expenses.push(expense);
                months[key].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);

                const accountName = expense.account_name || 'Sin cuenta';
                if (!months[key].expenseByAccount[accountName]) {
                    months[key].expenseByAccount[accountName] = 0;
                }
                months[key].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
            }
        });

        return Object.values(months);
    },

    groupByQuarter(incomes, expenses, startDate, endDate) {
        const quarters = {};
        const start = new Date(startDate);
        const end = new Date(endDate);

        const current = new Date(start);
        while (current <= end) {
            const quarter = Math.floor(current.getMonth() / 3) + 1;
            const key = `${current.getFullYear()}-Q${quarter}`;
            if (!quarters[key]) {
                quarters[key] = {
                    year: current.getFullYear(),
                    quarter: quarter,
                    quarterName: `${quarter}° Trimestre`,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0
                };
            }
            current.setMonth(current.getMonth() + 3);
        }

        // Procesar ingresos
        incomes.forEach(income => {
            const date = new Date(income.date);
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const key = `${date.getFullYear()}-Q${quarter}`;
            if (quarters[key]) {
                quarters[key].incomes.push(income);
                quarters[key].totalIncome += parseFloat(income.amount_base_currency || income.amount);

                const accountName = income.account_name || 'Sin cuenta';
                if (!quarters[key].incomeByAccount[accountName]) {
                    quarters[key].incomeByAccount[accountName] = 0;
                }
                quarters[key].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
            }
        });

        // Procesar egresos
        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const key = `${date.getFullYear()}-Q${quarter}`;
            if (quarters[key]) {
                quarters[key].expenses.push(expense);
                quarters[key].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);

                const accountName = expense.account_name || 'Sin cuenta';
                if (!quarters[key].expenseByAccount[accountName]) {
                    quarters[key].expenseByAccount[accountName] = 0;
                }
                quarters[key].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
            }
        });

        return Object.values(quarters);
    },

    renderChart(data, groupBy) {
        const canvasId = 'financialChart';

        // Verificar si el canvas existe
        let canvas = document.getElementById(canvasId);
        if (!canvas) {
            // Crear contenedor para la gráfica
            const resultsDiv = document.getElementById('reportResults');
            const chartContainer = document.createElement('div');
            chartContainer.className = 'card shadow-sm mb-4';
            chartContainer.innerHTML = `
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-graph-up"></i> Evolución de Ingresos vs Egresos</h5>
                </div>
                <div class="card-body">
                    <canvas id="${canvasId}" height="100"></canvas>
                </div>
            `;
            resultsDiv.insertBefore(chartContainer, resultsDiv.firstChild);
            canvas = document.getElementById(canvasId);
        }

        // Destruir gráfica anterior si existe
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Preparar datos para la gráfica
        let labels = [];
        let incomeData = [];
        let expenseData = [];

        if (groupBy === 'year') {
            labels = data.map(d => `${d.year}`);
            incomeData = data.map(d => d.totalIncome);
            expenseData = data.map(d => d.totalExpense);
        } else if (groupBy === 'month') {
            labels = data.map(d => `${d.monthName.substring(0, 3)} ${d.year}`);
            incomeData = data.map(d => d.totalIncome);
            expenseData = data.map(d => d.totalExpense);
        } else {
            labels = data.map(d => `${d.quarterName} ${d.year}`);
            incomeData = data.map(d => d.totalIncome);
            expenseData = data.map(d => d.totalExpense);
        }

        // Crear nueva gráfica
        this.chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: incomeData,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#28a745',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Egresos',
                        data: expenseData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#dc3545',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    },

    renderReport(data, groupBy) {
        const resultsDiv = document.getElementById('reportResults');

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = `<div class="alert alert-warning">No hay datos para el período seleccionado</div>`;
            return;
        }

        // Renderizar gráfica primero
        this.renderChart(data, groupBy);

        let html = '';

        // Totales generales
        const totalGeneralIncome = data.reduce((sum, item) => sum + item.totalIncome, 0);
        const totalGeneralExpense = data.reduce((sum, item) => sum + item.totalExpense, 0);
        const totalGeneralBalance = totalGeneralIncome - totalGeneralExpense;

        html += `
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Ingresos</h6>
                            <h3>${formatCurrency(totalGeneralIncome)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-danger text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Egresos</h6>
                            <h3>${formatCurrency(totalGeneralExpense)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card ${totalGeneralBalance >= 0 ? 'bg-primary' : 'bg-warning'} text-white">
                        <div class="card-body">
                            <h6 class="card-title">Balance Neto</h6>
                            <h3>${formatCurrency(totalGeneralBalance)}</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Tablas por período
        for (const period of data) {
            const periodTitle = groupBy === 'year' ? `Año ${period.year}` :
                (groupBy === 'month' ? `${period.monthName} ${period.year}` :
                    `${period.quarterName} ${period.year}`);

            const balance = period.totalIncome - period.totalExpense;

            html += `
                <div class="card shadow-sm mb-4">
                    <div class="card-header bg-secondary text-white">
                        <h5 class="mb-0">${periodTitle}</h5>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <strong>Ingresos:</strong> ${formatCurrency(period.totalIncome)}
                            </div>
                            <div class="col-md-4">
                                <strong>Egresos:</strong> ${formatCurrency(period.totalExpense)}
                            </div>
                            <div class="col-md-4">
                                <strong>Balance:</strong> ${formatCurrency(balance)}
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-success">Ingresos por Cuenta</h6>
                                <table class="table table-sm table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Cuenta</th>
                                            <th class="text-end">Monto</th>
                                            <th class="text-end">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(period.incomeByAccount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([account, amount]) => `
                                                <tr>
                                                    <td>${account}</td>
                                                    <td class="text-end">${formatCurrency(amount)}</td>
                                                    <td class="text-end">${period.totalIncome > 0 ? ((amount / period.totalIncome) * 100).toFixed(2) : 0}%</td>
                                                </tr>
                                            `).join('')}
                                        ${Object.keys(period.incomeByAccount).length === 0 ? '<tr><td colspan="3" class="text-center">Sin ingresos</td>' : ''}
                                    </tbody>
                                    <tfoot>
                                        <tr class="table-active">
                                            <td><strong>TOTAL</strong></td>
                                            <td class="text-end"><strong>${formatCurrency(period.totalIncome)}</strong></td>
                                            <td class="text-end"><strong>100%</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-danger">Egresos por Cuenta</h6>
                                <table class="table table-sm table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Cuenta</th>
                                            <th class="text-end">Monto</th>
                                            <th class="text-end">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(period.expenseByAccount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([account, amount]) => `
                                                <tr>
                                                    <td>${account}</td>
                                                    <td class="text-end">${formatCurrency(amount)}</td>
                                                    <td class="text-end">${period.totalExpense > 0 ? ((amount / period.totalExpense) * 100).toFixed(2) : 0}%</td>
                                                </tr>
                                            `).join('')}
                                        ${Object.keys(period.expenseByAccount).length === 0 ? '<tr><td colspan="3" class="text-center">Sin egresos</td>' : ''}
                                    </tbody>
                                    <tfoot>
                                        <tr class="table-active">
                                            <td><strong>TOTAL</strong></td>
                                            <td class="text-end"><strong>${formatCurrency(period.totalExpense)}</strong></td>
                                            <td class="text-end"><strong>100%</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        resultsDiv.innerHTML = html;
        // Re-insertar la gráfica al inicio
        const chartContainer = document.createElement('div');
        chartContainer.className = 'card shadow-sm mb-4';
        chartContainer.innerHTML = `
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="bi bi-graph-up"></i> Evolución de Ingresos vs Egresos</h5>
            </div>
            <div class="card-body">
                <canvas id="financialChart" height="100"></canvas>
            </div>
        `;
        resultsDiv.insertBefore(chartContainer, resultsDiv.firstChild);

        // Volver a renderizar la gráfica
        this.renderChart(data, groupBy);
    },

    exportToExcel() {
        if (!this.reportData) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const groupBy = document.getElementById('groupBy').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        const workbookData = [];

        // Hoja de resumen general
        const generalSummary = [
            ['REPORTE FINANCIERO'],
            [`Período: ${startDate} al ${endDate}`],
            [`Generado: ${new Date().toLocaleString()}`],
            [],
            ['RESUMEN GENERAL'],
            ['Total Ingresos', this.reportData.reduce((sum, p) => sum + p.totalIncome, 0)],
            ['Total Egresos', this.reportData.reduce((sum, p) => sum + p.totalExpense, 0)],
            ['Balance Neto', this.reportData.reduce((sum, p) => sum + p.totalIncome - p.totalExpense, 0)]
        ];
        workbookData.push({ name: 'Resumen General', data: generalSummary });

        // Hoja por cada período
        for (const period of this.reportData) {
            const periodTitle = groupBy === 'year' ? `Año_${period.year}` :
                (groupBy === 'month' ? `${period.monthName}_${period.year}` :
                    `Trimestre_${period.quarter}_${period.year}`);

            const sheetData = [
                [`${periodTitle}`],
                [],
                ['INGRESOS POR CUENTA'],
                ['Cuenta', 'Monto', 'Porcentaje']
            ];

            for (const [account, amount] of Object.entries(period.incomeByAccount)) {
                const percent = period.totalIncome > 0 ? ((amount / period.totalIncome) * 100).toFixed(2) : 0;
                sheetData.push([account, amount, `${percent}%`]);
            }
            sheetData.push(['TOTAL INGRESOS', period.totalIncome, '100%']);
            sheetData.push([]);
            sheetData.push(['EGRESOS POR CUENTA']);
            sheetData.push(['Cuenta', 'Monto', 'Porcentaje']);

            for (const [account, amount] of Object.entries(period.expenseByAccount)) {
                const percent = period.totalExpense > 0 ? ((amount / period.totalExpense) * 100).toFixed(2) : 0;
                sheetData.push([account, amount, `${percent}%`]);
            }
            sheetData.push(['TOTAL EGRESOS', period.totalExpense, '100%']);
            sheetData.push([]);
            sheetData.push(['RESUMEN DEL PERÍODO']);
            sheetData.push(['Total Ingresos', period.totalIncome]);
            sheetData.push(['Total Egresos', period.totalExpense]);
            sheetData.push(['Balance', period.totalIncome - period.totalExpense]);

            workbookData.push({ name: periodTitle.substring(0, 31), data: sheetData });
        }

        this.exportToExcelFile(workbookData);
    },

    exportToExcelFile(workbookData) {
        const wb = XLSX.utils.book_new();

        for (const sheet of workbookData) {
            const ws = XLSX.utils.aoa_to_sheet(sheet.data);
            ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        }

        const filename = `reporte_financiero_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(wb, filename);
    },

    async exportToPdf() {
        if (!this.reportData) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        let yPos = 20;
        const groupBy = document.getElementById('groupBy').value;

        // ============================================
        // ENCABEZADO CON LOGO
        // ============================================
        doc.setFillColor(25, 42, 86);
        doc.rect(0, 0, 210, 55, 'F');

        // Logo
        doc.setFillColor(255, 193, 7);
        doc.circle(25, 27, 12, 'F');
        doc.setTextColor(25, 42, 86);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('FC', 21, 32);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('FlowControl', 45, 30);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Gestión Financiera', 45, 40);

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(8);
        doc.text(`Reporte Financiero`, 155, 25);
        doc.text(`Período: ${document.getElementById('filterStartDate').value} al ${document.getElementById('filterEndDate').value}`, 155, 35);
        doc.text(`Agrupado por: ${groupBy === 'year' ? 'Año' : groupBy === 'month' ? 'Mes' : 'Trimestre'}`, 155, 45);

        yPos = 70;

        // ============================================
        // RESUMEN GENERAL
        // ============================================
        const totalIncome = this.reportData.reduce((sum, p) => sum + p.totalIncome, 0);
        const totalExpense = this.reportData.reduce((sum, p) => sum + p.totalExpense, 0);
        const totalBalance = totalIncome - totalExpense;

        // Tarjeta Ingresos
        doc.setFillColor(40, 167, 69);
        doc.roundedRect(20, yPos, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('TOTAL INGRESOS', 25, yPos + 10);
        doc.setFontSize(14);
        doc.text(formatCurrency(totalIncome), 25, yPos + 23);

        // Tarjeta Egresos
        doc.setFillColor(220, 53, 69);
        doc.roundedRect(77, yPos, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('TOTAL EGRESOS', 82, yPos + 10);
        doc.setFontSize(14);
        doc.text(formatCurrency(totalExpense), 82, yPos + 23);

        // Tarjeta Balance
        let r, g, b;
        if (totalBalance >= 0) {
            r = 13; g = 110; b = 253;
        } else {
            r = 255; g = 193; b = 7;
        }
        doc.setFillColor(r, g, b);
        doc.roundedRect(134, yPos, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('BALANCE NETO', 139, yPos + 10);
        doc.setFontSize(14);
        doc.text(formatCurrency(totalBalance), 139, yPos + 23);

        yPos += 38;

        // ============================================
        // DETALLE POR PERÍODO
        // ============================================
        for (const period of this.reportData) {
            if (yPos > 230) {
                doc.addPage();
                yPos = 20;
            }

            let periodTitle = '';
            if (groupBy === 'year') {
                periodTitle = `Año ${period.year}`;
            } else if (groupBy === 'month') {
                periodTitle = `${period.monthName} ${period.year}`;
            } else {
                periodTitle = `${period.quarterName} ${period.year}`;
            }

            doc.setFillColor(52, 58, 64);
            doc.roundedRect(20, yPos, 170, 12, 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(periodTitle, 25, yPos + 9);
            yPos += 16;

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.text(`Ingresos: ${formatCurrency(period.totalIncome)}`, 25, yPos);
            doc.text(`Egresos: ${formatCurrency(period.totalExpense)}`, 85, yPos);
            doc.text(`Balance: ${formatCurrency(period.totalIncome - period.totalExpense)}`, 145, yPos);
            yPos += 10;

            const incomeRows = Object.entries(period.incomeByAccount).length;
            const expenseRows = Object.entries(period.expenseByAccount).length;
            const maxRows = Math.max(incomeRows, expenseRows, 3);

            // Tabla INGRESOS
            const startYIncome = yPos;

            doc.setFillColor(40, 167, 69);
            doc.roundedRect(20, yPos, 80, 8, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('INGRESOS POR CUENTA', 25, yPos + 6);
            yPos += 8;

            doc.setFillColor(240, 240, 240);
            doc.rect(20, yPos, 80, 6, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.rect(20, yPos, 80, 6, 'S');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.text('Cuenta', 25, yPos + 4);
            doc.text('Monto', 70, yPos + 4);
            doc.text('%', 92, yPos + 4);
            yPos += 6;

            const incomeEntries = Object.entries(period.incomeByAccount);
            if (incomeEntries.length === 0) {
                doc.setFillColor(255, 255, 255);
                doc.rect(20, yPos, 80, 6, 'F');
                doc.rect(20, yPos, 80, 6, 'S');
                doc.text('No hay ingresos', 25, yPos + 4);
                yPos += 6;
            } else {
                for (const [account, amount] of incomeEntries) {
                    const percent = period.totalIncome > 0 ? ((amount / period.totalIncome) * 100).toFixed(1) : 0;
                    const shortAccount = account.length > 22 ? account.substring(0, 19) + '...' : account;

                    doc.setFillColor(255, 255, 255);
                    doc.rect(20, yPos, 80, 6, 'F');
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(20, yPos, 80, 6, 'S');
                    doc.setTextColor(0, 0, 0);
                    doc.text(shortAccount, 25, yPos + 4);
                    doc.text(formatCurrency(amount), 70, yPos + 4);
                    doc.text(`${percent}%`, 92, yPos + 4);
                    yPos += 6;
                }
            }

            const currentIncomeRows = incomeEntries.length === 0 ? 1 : incomeEntries.length;
            for (let i = 0; i < maxRows - currentIncomeRows; i++) {
                doc.setFillColor(255, 255, 255);
                doc.rect(20, yPos, 80, 6, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(20, yPos, 80, 6, 'S');
                doc.setTextColor(200, 200, 200);
                doc.text('-', 25, yPos + 4);
                yPos += 6;
            }

            doc.setFillColor(40, 167, 69);
            doc.rect(20, yPos, 80, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('TOTAL', 25, yPos + 5);
            doc.text(formatCurrency(period.totalIncome), 70, yPos + 5);
            doc.text('100%', 92, yPos + 5);

            const endYIncome = yPos + 7;
            yPos = startYIncome;

            // Tabla EGRESOS
            doc.setFillColor(220, 53, 69);
            doc.roundedRect(105, yPos, 85, 8, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('EGRESOS POR CUENTA', 110, yPos + 6);
            yPos += 8;

            doc.setFillColor(240, 240, 240);
            doc.rect(105, yPos, 85, 6, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.rect(105, yPos, 85, 6, 'S');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.text('Cuenta', 110, yPos + 4);
            doc.text('Monto', 155, yPos + 4);
            doc.text('%', 180, yPos + 4);
            yPos += 6;

            const expenseEntries = Object.entries(period.expenseByAccount);
            if (expenseEntries.length === 0) {
                doc.setFillColor(255, 255, 255);
                doc.rect(105, yPos, 85, 6, 'F');
                doc.rect(105, yPos, 85, 6, 'S');
                doc.text('No hay egresos', 110, yPos + 4);
                yPos += 6;
            } else {
                for (const [account, amount] of expenseEntries) {
                    const percent = period.totalExpense > 0 ? ((amount / period.totalExpense) * 100).toFixed(1) : 0;
                    const shortAccount = account.length > 22 ? account.substring(0, 19) + '...' : account;

                    doc.setFillColor(255, 255, 255);
                    doc.rect(105, yPos, 85, 6, 'F');
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(105, yPos, 85, 6, 'S');
                    doc.setTextColor(0, 0, 0);
                    doc.text(shortAccount, 110, yPos + 4);
                    doc.text(formatCurrency(amount), 155, yPos + 4);
                    doc.text(`${percent}%`, 180, yPos + 4);
                    yPos += 6;
                }
            }

            const currentExpenseRows = expenseEntries.length === 0 ? 1 : expenseEntries.length;
            for (let i = 0; i < maxRows - currentExpenseRows; i++) {
                doc.setFillColor(255, 255, 255);
                doc.rect(105, yPos, 85, 6, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(105, yPos, 85, 6, 'S');
                doc.setTextColor(200, 200, 200);
                doc.text('-', 110, yPos + 4);
                yPos += 6;
            }

            doc.setFillColor(220, 53, 69);
            doc.rect(105, yPos, 85, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('TOTAL', 110, yPos + 5);
            doc.text(formatCurrency(period.totalExpense), 155, yPos + 5);
            doc.text('100%', 180, yPos + 5);

            const endYExpense = yPos + 7;
            yPos = Math.max(endYIncome, endYExpense) + 8;
        }

        // ============================================
        // GRÁFICA
        // ============================================
        const chartCanvas = document.getElementById('financialChart');
        if (chartCanvas && this.reportData.length > 0) {
            doc.addPage();

            doc.setFillColor(25, 42, 86);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.text('Evolución de Ingresos vs Egresos', 20, 23);

            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(15, 45, 180, 90, 5, 5, 'S');

            try {
                await new Promise(resolve => setTimeout(resolve, 200));
                const chartImage = chartCanvas.toDataURL('image/png');
                doc.addImage(chartImage, 'PNG', 20, 50, 170, 80);

                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('* Valores expresados en moneda base del sistema', 20, 145);
                doc.text(`Generado automáticamente por FlowControl - ${new Date().toLocaleString()}`, 20, 153);
            } catch (error) {
                console.error('Error capturing chart:', error);
                doc.setTextColor(0, 0, 0);
                doc.text('No se pudo capturar la gráfica', 20, 70);
            }
        }

        // ============================================
        // PIE DE PÁGINA
        // ============================================
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setDrawColor(200, 200, 200);
            doc.line(20, 280, 190, 280);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`FlowControl - Sistema de Gestión Financiera`, 20, 287);
            doc.text(`Página ${i} de ${totalPages}`, 170, 287);
        }

        // ============================================
        // MARCA DE AGUA (sin rotate)
        // ============================================
        /* for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(45);
            doc.setTextColor(230, 230, 230);
            doc.setFont('helvetica', 'italic');
            doc.text('FlowControl', 55, 150);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
        } */

        doc.save(`reporte_financiero_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
    },


    setupEventListeners() {
        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.generateReport());
        }

        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }

        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPdf());
        }
    }
};