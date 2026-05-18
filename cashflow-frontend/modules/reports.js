// modules/reports.js
import { api } from '../services/apiService.js';
import { companyService } from '../services/companyService.js';
import { reportService } from '../services/reportService.js';
import { pdfExportService } from '../services/pdfExportService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const reportsModule = {
    reportData: null,
    chartInstance: null,
    selectedCompanyId: null,
    companyInfo: null,

    async render(container) {
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // Cargar datos iniciales
        await reportService.loadAccounts();

        let companies = [];
        if (isSuperAdmin) {
            companies = await reportService.loadCompanies();
        } else {
            this.companyInfo = await reportService.loadUserCompany();
            this.selectedCompanyId = this.companyInfo?.id;
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
                                ${companies.map(c => `
                                    <option value="${c.id}" ${this.selectedCompanyId == c.id ? 'selected' : ''}>
                                        ${c.name} ${c.business_name ? `(${c.business_name})` : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        ` : ''}
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Fecha desde</label>
                            <input type="date" class="form-control" id="filterStartDate" value="${reportService.getDefaultStartDate()}">
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Fecha hasta</label>
                            <input type="date" class="form-control" id="filterEndDate" value="${reportService.getDefaultEndDate()}">
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">Agrupar por</label>
                            <select class="form-select" id="groupBy">
                                <option value="year">Año</option>
                                <option value="month" selected>Mes</option>
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

        this.setupEventListeners(isSuperAdmin);

        if (this.selectedCompanyId || !isSuperAdmin) {
            await this.generateReport();
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
            // ✅ Cargar información de la empresa si hay una seleccionada
            if (companyId && companyId !== '') {
                if (isSuperAdmin) {
                    // Para super_admin, cargar la empresa seleccionada
                    const companyResponse = await companyService.getById(parseInt(companyId));
                    if (companyResponse.success && companyResponse.data) {
                        this.companyInfo = companyResponse.data;
                    } else {
                        this.companyInfo = null;
                    }
                }
                // Para usuarios normales, ya tienen this.companyInfo cargado
            } else {
                // Si no hay empresa seleccionada (todas las empresas), no mostrar logo específico
                this.companyInfo = null;
            }

            this.reportData = await reportService.generateReportData({
                companyId,
                startDate,
                endDate,
                groupBy
            });

            this.renderReport(this.reportData, groupBy);
        } catch (error) {
            console.error('Error generating report:', error);
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error al generar el reporte</div>`;
        }
    },

    renderReport(data, groupBy) {
        const resultsDiv = document.getElementById('reportResults');

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = `<div class="alert alert-warning">No hay datos para el período seleccionado</div>`;
            return;
        }

        const totals = reportService.calculateTotals(data);
        const sortedData = [...data].sort((a, b) => {
            if (groupBy === 'year') return a.year - b.year;
            if (groupBy === 'month') return a.sortKey - b.sortKey;
            if (groupBy === 'quarter') return a.sortKey - b.sortKey;
            return 0;
        });

        let html = `
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Ingresos</h6>
                            <h3>${formatCurrency(totals.totalIncome)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-danger text-white">
                        <div class="card-body">
                            <h6 class="card-title">Total Egresos</h6>
                            <h3>${formatCurrency(totals.totalExpense)}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card ${totals.totalBalance >= 0 ? 'bg-primary' : 'bg-warning'} text-white">
                        <div class="card-body">
                            <h6 class="card-title">Balance Neto</h6>
                            <h3>${formatCurrency(totals.totalBalance)}</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;

        for (const period of sortedData) {
            const periodTitle = groupBy === 'year' ? `Año ${period.year}` :
                (groupBy === 'month' ? `${period.monthName} ${period.year}` :
                    `${period.quarterName} ${period.year}`);
            const balance = period.totalIncome - period.totalExpense;

            html += `
                <div class="card shadow-sm mb-4">
                    <div class="card-header bg-secondary text-white">
                        <h5 class="mb-0">📅 ${periodTitle}</h5>
                        <small class="d-block mt-1">
                            Ingresos: ${formatCurrency(period.totalIncome)} | 
                            Egresos: ${formatCurrency(period.totalExpense)} | 
                            Balance: ${formatCurrency(balance)}
                        </small>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-success mb-3">
                                    <div class="card-header bg-success text-white">
                                        <i class="bi bi-arrow-up-circle"></i> INGRESOS
                                    </div>
                                    <div class="card-body p-0">
                                        ${this.renderGroupedByCategory(period.incomeByAccount, period.totalIncome)}
                                    </div>
                                    <div class="card-footer bg-light">
                                        <strong>Total Ingresos: ${formatCurrency(period.totalIncome)}</strong>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-danger mb-3">
                                    <div class="card-header bg-danger text-white">
                                        <i class="bi bi-arrow-down-circle"></i> EGRESOS
                                    </div>
                                    <div class="card-body p-0">
                                        ${this.renderGroupedByCategory(period.expenseByAccount, period.totalExpense)}
                                    </div>
                                    <div class="card-footer bg-light">
                                        <strong>Total Egresos: ${formatCurrency(period.totalExpense)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        resultsDiv.innerHTML = html;
        this.renderChart(sortedData, groupBy);
    },

    renderGroupedByCategory(accountsByAccount, total) {
        const { groupedByCategory, sortedCategories } = reportService.getAccountsByCategory(accountsByAccount);

        if (sortedCategories.length === 0) {
            return '<div class="list-group-item text-center text-muted">No hay registros</div>';
        }

        let html = '<div class="list-group list-group-flush">';

        for (const category of sortedCategories) {
            const categoryData = groupedByCategory[category];
            const categoryPercent = total > 0 ? ((categoryData.total / total) * 100).toFixed(1) : 0;
            const categoryIcon = '📊';

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center category-header" 
                         style="cursor: pointer; background-color: #f8f9fa; margin: -5px -10px; padding: 8px 10px;"
                         onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <div>
                            <strong>${categoryIcon} ${this.escapeHtml(category)}</strong>
                            <span class="badge bg-secondary ms-2">${categoryPercent}%</span>
                        </div>
                        <div>
                            <strong>${formatCurrency(categoryData.total)}</strong>
                            <i class="bi bi-chevron-down ms-2"></i>
                        </div>
                    </div>
                    <div class="category-accounts mt-2" style="display: block;">
                        <table class="table table-sm table-borderless mb-0">
                            <tbody>
                                ${categoryData.accounts
                    .sort((a, b) => b.amount - a.amount)
                    .map(acc => {
                        const percent = total > 0 ? ((acc.amount / total) * 100).toFixed(1) : 0;
                        return `
                                            <tr>
                                                <td style="padding-left: 20px;">
                                                    <i class="bi bi-receipt"></i> ${this.escapeHtml(acc.name)}
                                                </td>
                                                <td class="text-end">
                                                    <strong>${formatCurrency(acc.amount)}</strong>
                                                    <span class="text-muted ms-2">(${percent}%)</span>
                                                </td>
                                            </tr>
                                        `;
                    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    },

    renderChart(data, groupBy) {
        const canvasId = 'financialChart';
        let canvas = document.getElementById(canvasId);

        if (!canvas) {
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

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const sortedData = [...data].sort((a, b) => {
            if (groupBy === 'year') return a.year - b.year;
            if (groupBy === 'month') return a.sortKey - b.sortKey;
            if (groupBy === 'quarter') return a.sortKey - b.sortKey;
            return 0;
        });

        let labels = [];
        let incomeData = [];
        let expenseData = [];

        if (groupBy === 'year') {
            labels = sortedData.map(d => `${d.year}`);
            incomeData = sortedData.map(d => d.totalIncome);
            expenseData = sortedData.map(d => d.totalExpense);
        } else if (groupBy === 'month') {
            labels = sortedData.map(d => `${d.monthName.substring(0, 3)} ${d.year}`);
            incomeData = sortedData.map(d => d.totalIncome);
            expenseData = sortedData.map(d => d.totalExpense);
        } else {
            labels = sortedData.map(d => `${d.quarterName} ${d.year}`);
            incomeData = sortedData.map(d => d.totalIncome);
            expenseData = sortedData.map(d => d.totalExpense);
        }

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
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => formatCurrency(value) }
                    }
                }
            }
        });
    },

    exportToExcel() {
        if (!this.reportData || this.reportData.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const groupBy = document.getElementById('groupBy').value;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const workbookData = [];

        const totals = reportService.calculateTotals(this.reportData);

        workbookData.push({
            name: 'Resumen General',
            data: [
                ['REPORTE FINANCIERO'],
                [`Período: ${startDate} al ${endDate}`],
                [`Generado: ${new Date().toLocaleString()}`],
                [],
                ['RESUMEN GENERAL'],
                ['Total Ingresos', totals.totalIncome],
                ['Total Egresos', totals.totalExpense],
                ['Balance Neto', totals.totalBalance]
            ]
        });

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
        if (!this.reportData || this.reportData.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const companyId = isSuperAdmin ? (document.getElementById('companySelect')?.value || '') : this.selectedCompanyId;
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const groupBy = document.getElementById('groupBy').value;

        // ✅ Asegurar que tenemos la información de la empresa antes de exportar
        let companyInfoForPdf = this.companyInfo;
        let companyLogoPdf = this.companyLogo;

        // Si es super_admin y hay una empresa seleccionada, cargar sus datos
        if (isSuperAdmin && companyId && companyId !== '') {
            try {
                const companyResponse = await companyService.getById(parseInt(companyId));
                if (companyResponse.success && companyResponse.data) {
                    companyInfoForPdf = companyResponse.data;
                    console.log('Empresa cargada para PDF:', companyInfoForPdf);
                }
            } catch (error) {
                console.error('Error loading company for PDF:', error);
                companyInfoForPdf = null;
            }
        }
        // Si es super_admin y hay una empresa seleccionada, del logo de la empresa
        if (isSuperAdmin && companyId && companyId !== '') {
            try {
                const logoResponse = await companyService.getLogo(parseInt(companyId));                
                if (logoResponse.url) {
                    companyLogoPdf = logoResponse.url;
                    console.log('Logo de  la Empresa cargada para PDF:', companyLogoPdf);
                }
            } catch (error) {
                console.error('Error loading company for PDF:', error);
                companyLogoPdf = null;
            }
        }

        // Si no hay empresa seleccionada (ver todas), usar null para mostrar solo FlowControl
        if (!companyId || companyId === '') {
            companyInfoForPdf = null;
            companyLogoPdf = null;
        }

        // Delegar toda la lógica de PDF al servicio
        pdfExportService.exportFinancialReportToPDF(
            this.reportData,
            { startDate, endDate, groupBy },
            companyInfoForPdf,  // ✅ Pasar la información correcta de la empresa
            companyLogoPdf, // ✅ Pasar el logo de la empresa
            reportService.accounts
        );

        const companyText = companyInfoForPdf?.name ? `de ${companyInfoForPdf.name}` : 'general';
        showAlert(`Generando PDF ${companyText}...`, 'success');
    },

    setupEventListeners(isSuperAdmin) {
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
        if (companySelect && isSuperAdmin) {
            companySelect.addEventListener('change', () => this.generateReport());
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};