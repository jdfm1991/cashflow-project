import { api } from '../services/apiService.js';
import { accountService } from '../services/accountService.js';
import { transactionService } from '../services/transactionService.js';
import { companyService } from '../services/companyService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const reportsModule = {
    accounts: [],
    reportData: null,
    currentYear: null,
    chartInstance: null,
    companies: [],
    selectedCompanyId: null,
    companyInfo: null,

    async render(container) {
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // Cargar empresas si es super_admin
        if (isSuperAdmin) {
            await this.loadCompanies();
        } else {
            // Cargar información de la empresa del usuario
            await this.loadUserCompany();
        }

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
                        ${isSuperAdmin ? `
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-building"></i> Empresa
                            </label>
                            <select class="form-select" id="companySelect">
                                <option value="">Todas las empresas</option>
                                ${this.companies.map(c => `
                                    <option value="${c.id}" ${this.selectedCompanyId == c.id ? 'selected' : ''}>
                                        ${c.name} ${c.business_name ? `(${c.business_name})` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        ` : ''}
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Fecha desde</label>
                            <input type="date" class="form-control" id="filterStartDate" value="${this.getDefaultStartDate()}">
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Fecha hasta</label>
                            <input type="date" class="form-control" id="filterEndDate" value="${this.getDefaultEndDate()}">
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Agrupar por</label>
                            <select class="form-select" id="groupBy">
                                <option value="year">Año</option>
                                <option value="month">Mes</option>
                                <option value="quarter">Trimestre</option>
                            </select>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <button class="btn btn-primary" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Generar Reporte
                            </button>
                            <button class="btn btn-success ms-2" id="exportExcelBtn">
                                <i class="bi bi-file-excel"></i> Exportar a Excel
                            </button>
                            <button class="btn btn-danger ms-2" id="exportPdfBtn">
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

        // Si hay una empresa seleccionada, generar reporte automáticamente
        if (this.selectedCompanyId || !isSuperAdmin) {
            await this.generateReport();
        }
    },

    async loadCompanies() {
        try {
            const response = await companyService.getAll();
            if (response.success && response.data) {
                this.companies = response.data;
            }
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    },

    async loadUserCompany() {
        try {
            const response = await companyService.getMyCompany();
            if (response.success && response.data) {
                this.companyInfo = response.data;
                this.selectedCompanyId = this.companyInfo.id;
            }
        } catch (error) {
            console.error('Error loading user company:', error);
        }
    },

    async loadCompanyInfo(companyId) {
        try {
            const response = await companyService.getById(companyId);
            if (response.success && response.data) {
                this.companyInfo = response.data;
            }
        } catch (error) {
            console.error('Error loading company info:', error);
        }
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
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const companyId = isSuperAdmin ? (document.getElementById('companySelect')?.value || '') : this.selectedCompanyId;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const groupBy = document.getElementById('groupBy').value;

        if (!startDate || !endDate) {
            showAlert('Seleccione un rango de fechas', 'warning');
            return;
        }

        // Si es super_admin y seleccionó una empresa, cargar su información
        if (isSuperAdmin && companyId) {
            await this.loadCompanyInfo(companyId);
        } else if (!isSuperAdmin && this.companyInfo) {
            // Ya tiene la información de su empresa
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
            // Construir filtros
            const filters = { start_date: startDate, end_date: endDate };
            if (companyId && companyId !== '') {
                filters.company_id = companyId;
            }

            const incomeResponse = await transactionService.getIncomes(filters);
            const expenseResponse = await transactionService.getExpenses(filters);

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

        // ============================================
        // 1. CARGAR LOGO ANTES DE GENERAR EL PDF
        // ============================================
        let logoImage = null;

        if (this.companyInfo?.id && this.companyInfo?.logo) {
            try {
                const logoUrl = companyService.getLogoUrl(this.companyInfo.id);
                console.log('Cargando logo desde:', logoUrl);

                const response = await fetch(logoUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    logoImage = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    console.log('Logo cargado correctamente');
                } else {
                    console.warn('No se pudo cargar el logo:', response.status);
                }
            } catch (error) {
                console.error('Error cargando logo:', error);
            }
        }

        // ============================================
        // 2. GENERAR PDF CON EL LOGO (si está disponible)
        // ============================================
        const doc = new jsPDF('p', 'mm', 'a4');

        // Configuración de márgenes
        const MARGIN = {
            left: 20,
            right: 190,
            top: 55,
            bottom: 280
        };

        const groupBy = document.getElementById('groupBy').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        const companyName = this.companyInfo?.name || 'FlowControl';
        const businessName = this.companyInfo?.business_name || '';
        const taxId = this.companyInfo?.tax_id || '';

        // ============================================
        // FUNCIÓN PARA DIBUJAR ENCABEZADO (usa el logo precargado)
        // ============================================
        const drawHeader = (pageNumber) => {
            doc.setPage(pageNumber);

            // Fondo del encabezado
            doc.setFillColor(25, 42, 86);
            doc.rect(0, 0, 210, 50, 'F');

            // Logo (usar el precargado o dibujar por defecto)
            if (logoImage) {
                try {
                    doc.addImage(logoImage, 'PNG', 15, 15, 25, 25);
                } catch (error) {
                    console.error('Error al agregar logo al PDF:', error);
                    drawDefaultLogo(doc);
                }
            } else {
                drawDefaultLogo(doc);
            }

            // Información de la empresa
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 50, 22);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');

            let infoY = 28;
            if (businessName) {
                doc.text(businessName, 50, infoY);
                infoY += 5;
            }
            if (taxId) {
                doc.text(`RIF: ${taxId}`, 50, infoY);
            }

            // Información del reporte
            doc.setFontSize(8);
            doc.setTextColor(200, 200, 200);
            doc.text('REPORTE FINANCIERO', 190, 18, { align: 'right' });
            doc.text(`Período: ${startDate} al ${endDate}`, 190, 23, { align: 'right' });
            doc.text(`Agrupado por: ${groupBy === 'year' ? 'Año' : groupBy === 'month' ? 'Mes' : 'Trimestre'}`, 190, 28, { align: 'right' });
            doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 190, 33, { align: 'right' });

            // Línea separadora
            doc.setDrawColor(200, 200, 200);
            doc.line(MARGIN.left, 52, MARGIN.right, 52);

            return MARGIN.top;
        };

        const drawDefaultLogo = (doc) => {
            doc.setFillColor(255, 193, 7);
            doc.circle(25, 25, 12, 'F');
            doc.setTextColor(25, 42, 86);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('FC', 21, 30);
        };

        const drawFooter = (pageNumber, totalPages) => {
            doc.setPage(pageNumber);
            doc.setDrawColor(200, 200, 200);
            doc.line(MARGIN.left, 285, MARGIN.right, 285);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`${companyName} - Sistema de Gestión Financiera`, MARGIN.left, 292);
            doc.text(`Página ${pageNumber} de ${totalPages}`, MARGIN.right, 292, { align: 'right' });
        };

        let currentY = MARGIN.top;
        let currentPage = 1;
        let totalPages = 1;

        const checkPageBreak = (additionalHeight = 0) => {
            if (currentY + additionalHeight > MARGIN.bottom) {
                drawFooter(currentPage, totalPages);
                currentPage++;
                totalPages++;
                doc.addPage();
                currentY = drawHeader(currentPage);
            }
            return currentY;
        };

        // Dibujar primera página
        currentY = drawHeader(1);

        // ============================================
        // RESUMEN GENERAL
        // ============================================
        const totalIncome = this.reportData.reduce((sum, p) => sum + p.totalIncome, 0);
        const totalExpense = this.reportData.reduce((sum, p) => sum + p.totalExpense, 0);
        const totalBalance = totalIncome - totalExpense;

        // Tarjeta Ingresos
        doc.setFillColor(40, 167, 69);
        doc.roundedRect(MARGIN.left, currentY, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('TOTAL INGRESOS', MARGIN.left + 5, currentY + 10);
        doc.setFontSize(12);
        doc.text(formatCurrency(totalIncome), MARGIN.left + 5, currentY + 23);

        // Tarjeta Egresos
        doc.setFillColor(220, 53, 69);
        doc.roundedRect(MARGIN.left + 57, currentY, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('TOTAL EGRESOS', MARGIN.left + 62, currentY + 10);
        doc.setFontSize(12);
        doc.text(formatCurrency(totalExpense), MARGIN.left + 62, currentY + 23);

        // Tarjeta Balance
        const balanceColor = totalBalance >= 0 ? [13, 110, 253] : [255, 193, 7];
        doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.roundedRect(MARGIN.left + 114, currentY, 55, 28, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('BALANCE NETO', MARGIN.left + 119, currentY + 10);
        doc.setFontSize(12);
        doc.text(formatCurrency(totalBalance), MARGIN.left + 119, currentY + 23);

        currentY += 38;

        // ============================================
        // DETALLE POR PERÍODO
        // ============================================
        for (const period of this.reportData) {
            currentY = checkPageBreak(50);

            let periodTitle = '';
            if (groupBy === 'year') {
                periodTitle = `Año ${period.year}`;
            } else if (groupBy === 'month') {
                periodTitle = `${period.monthName} ${period.year}`;
            } else {
                periodTitle = `${period.quarterName} ${period.year}`;
            }

            doc.setFillColor(52, 58, 64);
            doc.roundedRect(MARGIN.left, currentY, 170, 12, 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text(periodTitle, MARGIN.left + 5, currentY + 9);
            currentY += 16;

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.text(`Ingresos: ${formatCurrency(period.totalIncome)}`, MARGIN.left, currentY);
            doc.text(`Egresos: ${formatCurrency(period.totalExpense)}`, MARGIN.left + 70, currentY);
            doc.text(`Balance: ${formatCurrency(period.totalIncome - period.totalExpense)}`, MARGIN.left + 140, currentY);
            currentY += 10;

            const incomeEntries = Object.entries(period.incomeByAccount);
            const expenseEntries = Object.entries(period.expenseByAccount);
            const maxRows = Math.max(incomeEntries.length, expenseEntries.length, 3);
            const tableHeight = (maxRows + 2) * 6 + 16;

            currentY = checkPageBreak(tableHeight);

            // Tabla INGRESOS
            const startYIncome = currentY;

            doc.setFillColor(40, 167, 69);
            doc.roundedRect(MARGIN.left, currentY, 80, 8, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('INGRESOS POR CUENTA', MARGIN.left + 5, currentY + 6);
            currentY += 8;

            doc.setFillColor(240, 240, 240);
            doc.rect(MARGIN.left, currentY, 80, 6, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.rect(MARGIN.left, currentY, 80, 6, 'S');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.text('Cuenta', MARGIN.left + 5, currentY + 4);
            doc.text('Monto', MARGIN.left + 50, currentY + 4);
            doc.text('%', MARGIN.left + 72, currentY + 4);
            currentY += 6;

            if (incomeEntries.length === 0) {
                doc.setFillColor(255, 255, 255);
                doc.rect(MARGIN.left, currentY, 80, 6, 'F');
                doc.rect(MARGIN.left, currentY, 80, 6, 'S');
                doc.text('No hay ingresos', MARGIN.left + 5, currentY + 4);
                currentY += 6;
            } else {
                for (const [account, amount] of incomeEntries) {
                    const percent = period.totalIncome > 0 ? ((amount / period.totalIncome) * 100).toFixed(1) : 0;
                    const shortAccount = account.length > 20 ? account.substring(0, 17) + '...' : account;

                    doc.setFillColor(255, 255, 255);
                    doc.rect(MARGIN.left, currentY, 80, 6, 'F');
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(MARGIN.left, currentY, 80, 6, 'S');
                    doc.setTextColor(0, 0, 0);
                    doc.text(shortAccount, MARGIN.left + 5, currentY + 4);
                    doc.text(formatCurrency(amount), MARGIN.left + 50, currentY + 4);
                    doc.text(`${percent}%`, MARGIN.left + 72, currentY + 4);
                    currentY += 6;
                }
            }

            for (let i = 0; i < maxRows - (incomeEntries.length || 1); i++) {
                doc.setFillColor(255, 255, 255);
                doc.rect(MARGIN.left, currentY, 80, 6, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(MARGIN.left, currentY, 80, 6, 'S');
                doc.setTextColor(200, 200, 200);
                doc.text('-', MARGIN.left + 5, currentY + 4);
                currentY += 6;
            }

            doc.setFillColor(40, 167, 69);
            doc.rect(MARGIN.left, currentY, 80, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('TOTAL', MARGIN.left + 5, currentY + 5);
            doc.text(formatCurrency(period.totalIncome), MARGIN.left + 50, currentY + 5);
            doc.text('100%', MARGIN.left + 72, currentY + 5);

            const endYIncome = currentY + 7;
            currentY = startYIncome;

            // Tabla EGRESOS
            doc.setFillColor(220, 53, 69);
            doc.roundedRect(MARGIN.left + 85, currentY, 85, 8, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('EGRESOS POR CUENTA', MARGIN.left + 90, currentY + 6);
            currentY += 8;

            doc.setFillColor(240, 240, 240);
            doc.rect(MARGIN.left + 85, currentY, 85, 6, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.rect(MARGIN.left + 85, currentY, 85, 6, 'S');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.text('Cuenta', MARGIN.left + 90, currentY + 4);
            doc.text('Monto', MARGIN.left + 135, currentY + 4);
            doc.text('%', MARGIN.left + 160, currentY + 4);
            currentY += 6;

            if (expenseEntries.length === 0) {
                doc.setFillColor(255, 255, 255);
                doc.rect(MARGIN.left + 85, currentY, 85, 6, 'F');
                doc.rect(MARGIN.left + 85, currentY, 85, 6, 'S');
                doc.text('No hay egresos', MARGIN.left + 90, currentY + 4);
                currentY += 6;
            } else {
                for (const [account, amount] of expenseEntries) {
                    const percent = period.totalExpense > 0 ? ((amount / period.totalExpense) * 100).toFixed(1) : 0;
                    const shortAccount = account.length > 20 ? account.substring(0, 17) + '...' : account;

                    doc.setFillColor(255, 255, 255);
                    doc.rect(MARGIN.left + 85, currentY, 85, 6, 'F');
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(MARGIN.left + 85, currentY, 85, 6, 'S');
                    doc.setTextColor(0, 0, 0);
                    doc.text(shortAccount, MARGIN.left + 90, currentY + 4);
                    doc.text(formatCurrency(amount), MARGIN.left + 135, currentY + 4);
                    doc.text(`${percent}%`, MARGIN.left + 160, currentY + 4);
                    currentY += 6;
                }
            }

            for (let i = 0; i < maxRows - (expenseEntries.length || 1); i++) {
                doc.setFillColor(255, 255, 255);
                doc.rect(MARGIN.left + 85, currentY, 85, 6, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(MARGIN.left + 85, currentY, 85, 6, 'S');
                doc.setTextColor(200, 200, 200);
                doc.text('-', MARGIN.left + 90, currentY + 4);
                currentY += 6;
            }

            doc.setFillColor(220, 53, 69);
            doc.rect(MARGIN.left + 85, currentY, 85, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('TOTAL', MARGIN.left + 90, currentY + 5);
            doc.text(formatCurrency(period.totalExpense), MARGIN.left + 135, currentY + 5);
            doc.text('100%', MARGIN.left + 160, currentY + 5);

            const endYExpense = currentY + 7;
            currentY = Math.max(endYIncome, endYExpense) + 10;
        }

        // ============================================
        // GRÁFICA
        // ============================================
        const chartCanvas = document.getElementById('financialChart');
        if (chartCanvas && this.reportData.length > 0) {
            currentPage++;
            totalPages++;
            doc.addPage();
            drawHeader(currentPage);

            doc.setFillColor(52, 58, 64);
            doc.roundedRect(MARGIN.left, MARGIN.top, 170, 12, 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text('Evolución de Ingresos vs Egresos', MARGIN.left + 5, MARGIN.top + 9);

            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(MARGIN.left, MARGIN.top + 18, 170, 85, 5, 5, 'S');

            try {
                await new Promise(resolve => setTimeout(resolve, 200));
                const chartImage = chartCanvas.toDataURL('image/png');
                doc.addImage(chartImage, 'PNG', MARGIN.left + 5, MARGIN.top + 23, 160, 75);

                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('* Valores expresados en moneda base del sistema', MARGIN.left, MARGIN.top + 115);
                doc.text(`Generado automáticamente por FlowControl - ${new Date().toLocaleString('es-ES')}`, MARGIN.left, MARGIN.top + 123);
            } catch (error) {
                console.error('Error capturing chart:', error);
                doc.setTextColor(0, 0, 0);
                doc.text('No se pudo capturar la gráfica', MARGIN.left + 5, MARGIN.top + 50);
            }
        }

        // Pies de página
        for (let i = 1; i <= totalPages; i++) {
            drawFooter(i, totalPages);
        }

        const fileName = `reporte_financiero_${companyName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
        doc.save(fileName);
    },

    drawDefaultLogo(doc) {
        doc.setFillColor(255, 193, 7);
        doc.circle(25, 27, 12, 'F');
        doc.setTextColor(25, 42, 86);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FC', 21, 32);
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

        const companySelect = document.getElementById('companySelect');
        if (companySelect) {
            companySelect.addEventListener('change', () => this.generateReport());
        }
    }
};