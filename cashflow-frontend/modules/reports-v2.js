// modules/reports.js - Versión con reporte matricial
import { api } from '../services/apiService.js';
import { accountService } from '../services/accountService.js';
import { transactionService } from '../services/transactionService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

// Configuración al inicio del archivo

const PDF_CONFIG = {
    format: 'letter',
    width: 216,
    height: 279,
    marginTop: 25,
    marginBottom: 25,
    marginLeft: 20,
    marginRight: 20,
    headerHeight: 35,
    footerHeight: 15,
    get maxY() {
        return this.height - this.marginBottom - this.footerHeight;
    },
    get availableWidth() {
        return this.width - this.marginLeft - this.marginRight;
    }
};

export const reportsModule = {
    accounts: [],
    reportData: null,
    currentGroupBy: 'month',

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Reportes Financieros</h1>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                Reporte matricial que muestra ingresos y egresos por cuenta, desglosado por semanas dentro de cada mes.
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
                            <label class="form-label fw-semibold">Tipo</label>
                            <select class="form-select" id="reportType">
                                <option value="both">Ingresos y Egresos</option>
                                <option value="income">Solo Ingresos</option>
                                <option value="expense">Solo Egresos</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-primary w-100" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Generar Reporte
                            </button>
                        </div>
                    </div>
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
            
            <!-- Resultados del reporte -->
            <div id="reportResults"></div>
        `;

        await this.loadAccounts();
        this.setupEventListeners();
        await this.generateReport();
    },

    getDefaultStartDate() {
        const date = new Date();
        date.setMonth(date.getMonth() - 3);
        return date.toISOString().split('T')[0];
    },

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    },

    async loadAccounts() {
        try {
            const incomeResponse = await accountService.getAll('income');
            const expenseResponse = await accountService.getAll('expense');

            this.incomeAccounts = incomeResponse.success ? incomeResponse.data : [];
            this.expenseAccounts = expenseResponse.success ? expenseResponse.data : [];
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    },

    async generateReport() {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const reportType = document.getElementById('reportType').value;

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
                <p class="mt-2">Generando reporte matricial...</p>
            </div>
        `;

        try {
            // Obtener todas las transacciones
            let incomes = [];
            let expenses = [];

            if (reportType === 'both' || reportType === 'income') {
                const incomeResponse = await transactionService.getIncomes({ start_date: startDate, end_date: endDate });
                incomes = incomeResponse.success ? (incomeResponse.data.incomes || incomeResponse.data) : [];
            }

            if (reportType === 'both' || reportType === 'expense') {
                const expenseResponse = await transactionService.getExpenses({ start_date: startDate, end_date: endDate });
                expenses = expenseResponse.success ? (expenseResponse.data.expenses || expenseResponse.data) : [];
            }

            const reportData = this.buildMatrixReport(incomes, expenses, startDate, endDate);
            this.reportData = reportData;
            this.renderMatrixReport(reportData, reportType);

        } catch (error) {
            console.error('Error generating report:', error);
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error al generar el reporte</div>`;
        }
    },


    buildMatrixReport(incomes, expenses, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (!incomes) incomes = [];
        if (!expenses) expenses = [];

        // Validar fechas
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Fechas inválidas:', startDate, endDate);
            return { months: [] };
        }

        // Generar estructura de meses y semanas
        const months = [];
        let current = new Date(start);

        while (current <= end) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const monthKey = `${year}-${month + 1}`;
            const monthName = current.toLocaleString('es', { month: 'long', year: 'numeric' });

            // Obtener todas las semanas del mes (1-5 o 1-6)
            const weeksInMonth = this.getWeeksInMonth(year, month);

            // Crear estructura de semanas para este mes
            const weekData = [];
            for (let weekNum = 1; weekNum <= weeksInMonth; weekNum++) {
                const weekDates = this.getWeekDates(year, month, weekNum);
                weekData.push({
                    weekNumber: weekNum,
                    weekLabel: `Semana ${weekNum}`,
                    startDate: weekDates.start,
                    endDate: weekDates.end,
                    incomes: {},
                    expenses: {},
                    totalIncome: 0,
                    totalExpense: 0
                });
            }

            months.push({
                key: monthKey,
                name: monthName,
                year: year,
                month: month,
                weekCount: weeksInMonth,
                weekData: weekData
            });

            current.setMonth(current.getMonth() + 1);
        }

        // Procesar ingresos
        incomes.forEach(income => {
            const date = new Date(income.date);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthIndex = months.findIndex(m => m.year === year && m.month === month);

            if (monthIndex !== -1) {
                const weekNumber = this.getWeekOfMonth(date);
                const weekIndex = weekNumber - 1;

                if (weekIndex >= 0 && weekIndex < months[monthIndex].weekData.length) {
                    const accountName = income.account_name || `Cuenta ${income.account_id}`;
                    const amount = parseFloat(income.amount_base_currency || income.amount);

                    months[monthIndex].weekData[weekIndex].incomes[accountName] =
                        (months[monthIndex].weekData[weekIndex].incomes[accountName] || 0) + amount;
                    months[monthIndex].weekData[weekIndex].totalIncome += amount;
                }
            }
        });

        // Procesar egresos (misma lógica)
        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthIndex = months.findIndex(m => m.year === year && m.month === month);

            if (monthIndex !== -1) {
                const weekNumber = this.getWeekOfMonth(date);
                const weekIndex = weekNumber - 1;

                if (weekIndex >= 0 && weekIndex < months[monthIndex].weekData.length) {
                    const accountName = expense.account_name || `Cuenta ${expense.account_id}`;
                    const amount = parseFloat(expense.amount_base_currency || expense.amount);

                    months[monthIndex].weekData[weekIndex].expenses[accountName] =
                        (months[monthIndex].weekData[weekIndex].expenses[accountName] || 0) + amount;
                    months[monthIndex].weekData[weekIndex].totalExpense += amount;
                }
            }
        });

        return {
            months: months,
            allIncomeAccounts: [...new Set(incomes.map(i => i.account_name || `Cuenta ${i.account_id}`))],
            allExpenseAccounts: [...new Set(expenses.map(e => e.account_name || `Cuenta ${e.account_id}`))],
            totalIncome: incomes.reduce((sum, i) => sum + parseFloat(i.amount_base_currency || i.amount), 0),
            totalExpense: expenses.reduce((sum, e) => sum + parseFloat(e.amount_base_currency || e.amount), 0)
        };
    },

    getWeeksInMonth(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay() || 7; // 1=Lunes, 7=Domingo

        // Calcular número de semanas en el mes
        const daysInMonth = lastDay.getDate();
        const weeksCount = Math.ceil((daysInMonth + (firstDayOfWeek - 1)) / 7);

        return weeksCount;
    },

    getWeekOfMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay() || 7; // 1=Lunes, 7=Domingo

        const dayOfMonth = date.getDate();
        const weekNumber = Math.ceil((dayOfMonth + (firstDayOfWeek - 1)) / 7);

        return weekNumber;
    },

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    },

    getWeekDates(year, month, weekNumber) {
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay() || 7;

        const startDay = 1 + (weekNumber - 1) * 7 - (firstDayOfWeek - 1);
        const startDate = new Date(year, month, startDay);
        const endDate = new Date(year, month, startDay + 6);

        return { start: startDate, end: endDate };
    },

    renderMatrixReport(data, reportType) {
        const resultsDiv = document.getElementById('reportResults');

        // Validar que data existe
        if (!data || !data.months || !Array.isArray(data.months) || data.months.length === 0) {
            resultsDiv.innerHTML = `<div class="alert alert-warning">No hay datos para el período seleccionado</div>`;
            return;
        }


        let html = '';

        // Totales generales (igual que antes)
        let totalGeneralIncome = 0;
        let totalGeneralExpense = 0;

        data.months.forEach(month => {
            month.weekData.forEach(week => {
                totalGeneralIncome += week.totalIncome;
                totalGeneralExpense += week.totalExpense;
            });
        });

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

        // Renderizar cada mes
        for (const month of data.months) {
            // Obtener todas las cuentas únicas de este mes
            const allIncomeAccounts = new Set();
            const allExpenseAccounts = new Set();

            month.weekData.forEach(week => {
                Object.keys(week.incomes).forEach(acc => allIncomeAccounts.add(acc));
                Object.keys(week.expenses).forEach(acc => allExpenseAccounts.add(acc));
            });

            const incomeAccountsList = Array.from(allIncomeAccounts).sort();
            const expenseAccountsList = Array.from(allExpenseAccounts).sort();

            html += `
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-secondary text-white">
                    <h4 class="mb-0">${month.name}</h4>
                    <small>${month.weekCount} semanas en el mes</small>
                </div>
                <div class="card-body">
        `;

            // Tabla de Ingresos
            if (reportType === 'both' || reportType === 'income') {
                html += `
                <h5 class="text-success mt-2">Ingresos</h5>
                <div class="table-responsive mb-4">
                    <table class="table table-bordered table-sm">
                        <thead class="table-success">
                            <tr>
                                <th style="min-width: 180px;">Cuentas / Semanas</th>
                                ${month.weekData.map(week => `<th class="text-center" style="min-width: 100px;">${week.weekLabel}</th>`).join('')}
                                <th class="text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

                // Filas por cuenta
                for (const account of incomeAccountsList) {
                    let rowTotal = 0;
                    const weekValues = month.weekData.map(week => {
                        const amount = week.incomes[account] || 0;
                        rowTotal += amount;
                        return `<td class="text-end ${amount > 0 ? 'fw-bold' : 'text-muted'}">${amount > 0 ? formatCurrency(amount) : '-'}</td>`;
                    }).join('');

                    html += `
                    <tr>
                        <td><strong>${account}</strong></td>
                        ${weekValues}
                        <td class="text-end fw-bold bg-light">${formatCurrency(rowTotal)}</td>
                    </tr>
                `;
                }

                // Fila de totales
                html += `
                        <tr class="table-active">
                            <td><strong>TOTAL</strong></td>
                            ${month.weekData.map(week => `<td class="text-end fw-bold">${formatCurrency(week.totalIncome)}</td>`).join('')}
                            <td class="text-end fw-bold">${formatCurrency(month.weekData.reduce((sum, w) => sum + w.totalIncome, 0))}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            `;
            }

            // Tabla de Egresos
            if (reportType === 'both' || reportType === 'expense') {
                html += `
                <h5 class="text-danger mt-4">Egresos</h5>
                <div class="table-responsive">
                    <table class="table table-bordered table-sm">
                        <thead class="table-danger">
                            <tr>
                                <th style="min-width: 180px;">Cuentas / Semanas</th>
                                ${month.weekData.map(week => `<th class="text-center" style="min-width: 100px;">${week.weekLabel}</th>`).join('')}
                                <th class="text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

                // Filas por cuenta
                for (const account of expenseAccountsList) {
                    let rowTotal = 0;
                    const weekValues = month.weekData.map(week => {
                        const amount = week.expenses[account] || 0;
                        rowTotal += amount;
                        return `<td class="text-end ${amount > 0 ? 'fw-bold' : 'text-muted'}">${amount > 0 ? formatCurrency(amount) : '-'}</td>`;
                    }).join('');

                    html += `
                    <tr>
                        <td><strong>${account}</strong></td>
                        ${weekValues}
                        <td class="text-end fw-bold bg-light">${formatCurrency(rowTotal)}</td>
                    </tr>
                `;
                }

                // Fila de totales
                html += `
                        <tr class="table-active">
                            <td><strong>TOTAL</strong></td>
                            ${month.weekData.map(week => `<td class="text-end fw-bold">${formatCurrency(week.totalExpense)}</td>`).join('')}
                            <td class="text-end fw-bold">${formatCurrency(month.weekData.reduce((sum, w) => sum + w.totalExpense, 0))}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            `;
            }

            // Gráfica de barras para el mes
            html += `
            <div class="row mt-4">
                <div class="col-12">
                    <canvas id="chart-${month.key}" height="80"></canvas>
                </div>
            </div>
        `;

            html += `
                </div>
            </div>
        `;
        }

        resultsDiv.innerHTML = html;

        // Renderizar gráficas después de insertar el HTML
        this.renderAllCharts(data);
    },

    renderAllCharts(data) {// Verificar que data existe y tiene la estructura esperada
        if (!data || !data.months || !Array.isArray(data.months)) {
            console.warn('No hay datos válidos para renderizar gráficas');
            return;
        }

        for (const month of data.months) {
            // Verificar que el mes tiene la estructura esperada
            if (!month || !month.key || !month.weekData || !Array.isArray(month.weekData)) {
                console.warn(`Estructura inválida para el mes: ${month?.key}`);
                continue;
            }

            const canvas = document.getElementById(`chart-${month.key}`);
            if (!canvas) {
                console.warn(`Canvas no encontrado: chart-${month.key}`);
                continue;
            }

            const ctx = canvas.getContext('2d');
            const labels = month.weekData.map((week, idx) => week.weekLabel || `Semana ${idx + 1}`);
            const incomeData = month.weekData.map(w => w.totalIncome || 0);
            const expenseData = month.weekData.map(w => w.totalExpense || 0);

            // Destruir gráfica anterior si existe
            if (canvas.chart) {
                canvas.chart.destroy();
            }

            canvas.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: incomeData,
                            backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            borderColor: '#28a745',
                            borderWidth: 1
                        },
                        {
                            label: 'Egresos',
                            data: expenseData,
                            backgroundColor: 'rgba(220, 53, 69, 0.7)',
                            borderColor: '#dc3545',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                            }
                        },
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency(value)
                            },
                            title: {
                                display: true,
                                text: 'Monto (Bs.)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Semanas'
                            }
                        }
                    }
                }
            });
        }
    },

    exportToExcel2() {
        if (!this.reportData) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const reportType = document.getElementById('reportType').value;
        const wb = XLSX.utils.book_new();

        for (const month of this.reportData.months) {
            // Hoja de ingresos
            if (reportType === 'both' || reportType === 'income') {
                const incomeSheetData = this.buildSheetData(month, 'income');
                const wsIncome = XLSX.utils.aoa_to_sheet(incomeSheetData);
                XLSX.utils.book_append_sheet(wb, wsIncome, `${month.name}_Ingresos`);
            }

            // Hoja de egresos
            if (reportType === 'both' || reportType === 'expense') {
                const expenseSheetData = this.buildSheetData(month, 'expense');
                const wsExpense = XLSX.utils.aoa_to_sheet(expenseSheetData);
                XLSX.utils.book_append_sheet(wb, wsExpense, `${month.name}_Egresos`);
            }
        }

        const filename = `reporte_matricial_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(wb, filename);
    },

    // Método exportToExcel
    exportToExcel() {
        if (!this.reportData || !this.reportData.months || this.reportData.months.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const reportType = document.getElementById('reportType').value;
        const wb = XLSX.utils.book_new();

        // Crear hoja de resumen general
        const summaryData = this.buildSummarySheet();
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

        // Crear hoja por cada mes
        for (const month of this.reportData.months) {
            // Hoja de ingresos
            if (reportType === 'both' || reportType === 'income') {
                const incomeData = this.buildMonthSheet(month, 'income');
                const wsIncome = XLSX.utils.aoa_to_sheet(incomeData);
                XLSX.utils.book_append_sheet(wb, wsIncome, `${this.sanitizeSheetName(month.name)}_Ingresos`);
            }

            // Hoja de egresos
            if (reportType === 'both' || reportType === 'expense') {
                const expenseData = this.buildMonthSheet(month, 'expense');
                const wsExpense = XLSX.utils.aoa_to_sheet(expenseData);
                XLSX.utils.book_append_sheet(wb, wsExpense, `${this.sanitizeSheetName(month.name)}_Egresos`);
            }
        }

        const filename = `reporte_matricial_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
        XLSX.writeFile(wb, filename);
        showAlert('Reporte exportado a Excel exitosamente', 'success');
    },

    // Método exportToPdf
    async exportToPdf() {
        if (!this.reportData || !this.reportData.months || this.reportData.months.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: PDF_CONFIG.format
        });

        let yPos = PDF_CONFIG.marginTop;
        const reportType = document.getElementById('reportType').value;

        // Contador de páginas
        let pageData = {
            currentPage: 1,
            totalPages: 1  // Se actualizará al final
        };

        // Agregar encabezado a la primera página
        this.addHeader(doc, pageData.currentPage, pageData.totalPages);

        // ============================================
        // TÍTULO DEL REPORTE
        // ============================================
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte Matricial - Detalle por Semanas', PDF_CONFIG.marginLeft, yPos);
        yPos += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${document.getElementById('filterStartDate').value} al ${document.getElementById('filterEndDate').value}`,
            PDF_CONFIG.marginLeft, yPos);
        yPos += 6;
        doc.text(`Tipo: ${reportType === 'both' ? 'Ingresos y Egresos' : (reportType === 'income' ? 'Solo Ingresos' : 'Solo Egresos')}`,
            PDF_CONFIG.marginLeft, yPos);
        yPos += 15;

        // ============================================
        // RESUMEN GENERAL (tarjetas)
        // ============================================
        let totalIncome = 0;
        let totalExpense = 0;

        for (const month of this.reportData.months) {
            for (const week of month.weekData) {
                totalIncome += week.totalIncome;
                totalExpense += week.totalExpense;
            }
        }

        const cardWidth = (PDF_CONFIG.availableWidth - 20) / 3;

        doc.setFillColor(40, 167, 69);
        doc.roundedRect(PDF_CONFIG.marginLeft, yPos, cardWidth, 20, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('TOTAL INGRESOS', PDF_CONFIG.marginLeft + 5, yPos + 8);
        doc.setFontSize(10);
        doc.text(formatCurrency(totalIncome), PDF_CONFIG.marginLeft + 5, yPos + 16);

        doc.setFillColor(220, 53, 69);
        doc.roundedRect(PDF_CONFIG.marginLeft + cardWidth + 10, yPos, cardWidth, 20, 3, 3, 'F');
        doc.text('TOTAL EGRESOS', PDF_CONFIG.marginLeft + cardWidth + 15, yPos + 8);
        doc.text(formatCurrency(totalExpense), PDF_CONFIG.marginLeft + cardWidth + 15, yPos + 16);

        const balanceColor = (totalIncome - totalExpense) >= 0 ? [13, 110, 253] : [255, 193, 7];
        doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.roundedRect(PDF_CONFIG.marginLeft + (cardWidth + 10) * 2, yPos, cardWidth, 20, 3, 3, 'F');
        doc.text('BALANCE NETO', PDF_CONFIG.marginLeft + (cardWidth + 10) * 2 + 5, yPos + 8);
        doc.text(formatCurrency(totalIncome - totalExpense), PDF_CONFIG.marginLeft + (cardWidth + 10) * 2 + 5, yPos + 16);

        yPos += 30;

        // ============================================
        // DETALLE POR MES
        // ============================================
        for (const month of this.reportData.months) {
            // Verificar espacio para el mes completo (título + tablas)
            //const estimatedHeight = 80 + (Object.keys(month.incomeByAccount).length * 5) + (Object.keys(month.expenseByAccount).length * 5);

            // Calcular altura estimada de forma segura
            const getIncomeAccountCount = () => {
                if (month.incomeByAccount && typeof month.incomeByAccount === 'object') {
                    return Object.keys(month.incomeByAccount).length;
                }
                // Si no existe, calcular desde weekData
                const accounts = new Set();
                for (const week of month.weekData) {
                    Object.keys(week.incomes || {}).forEach(acc => accounts.add(acc));
                }
                return accounts.size;
            };

            const getExpenseAccountCount = () => {
                if (month.expenseByAccount && typeof month.expenseByAccount === 'object') {
                    return Object.keys(month.expenseByAccount).length;
                }
                // Si no existe, calcular desde weekData
                const accounts = new Set();
                for (const week of month.weekData) {
                    Object.keys(week.expenses || {}).forEach(acc => accounts.add(acc));
                }
                return accounts.size;
            };

            const incomeCount = getIncomeAccountCount();
            const expenseCount = getExpenseAccountCount();
            const estimatedHeight = 80 + (incomeCount * 5) + (expenseCount * 5);

            yPos = this.checkPageBreak(doc, yPos, estimatedHeight, pageData);

            // Título del mes
            doc.setFillColor(108, 117, 125);
            doc.roundedRect(PDF_CONFIG.marginLeft, yPos, PDF_CONFIG.availableWidth, 10, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(month.name, PDF_CONFIG.marginLeft + 5, yPos + 7);
            yPos += 15;

            // Gráfica del mes
            if (month.weekData.length > 0) {
                const chartHeight = 50;
                yPos = this.checkPageBreak(doc, yPos, chartHeight + 10, pageData);
                this.drawMonthChart(doc, month, yPos);
                yPos += chartHeight + 10;
            }

            // Tabla de ingresos
            if (reportType === 'both' || reportType === 'income') {
                yPos = this.renderPdfTable(doc, month, 'income', yPos, pageData);
                yPos += 8;
            }

            // Tabla de egresos
            if (reportType === 'both' || reportType === 'expense') {
                yPos = this.renderPdfTable(doc, month, 'expense', yPos, pageData);
                yPos += 10;
            }
        }

        // ============================================
        // GRÁFICA GENERAL AL FINAL
        // ============================================
        doc.addPage();
        pageData.currentPage++;
        this.addHeader(doc, pageData.currentPage, pageData.totalPages);
        yPos = PDF_CONFIG.marginTop;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Evolución General de Ingresos vs Egresos por Semana', PDF_CONFIG.marginLeft, yPos);
        yPos += 15;

        this.drawSimpleChart(doc, yPos);

        // ============================================
        // ACTUALIZAR TOTAL DE PÁGINAS Y AGREGAR PIES
        // ============================================
        pageData.totalPages = doc.internal.getNumberOfPages();

        // Re-generar todas las páginas con el número correcto
        for (let i = 1; i <= pageData.totalPages; i++) {
            doc.setPage(i);
            this.addHeader(doc, i, pageData.totalPages);
            this.addFooter(doc, i, pageData.totalPages);
        }

        doc.save(`reporte_matricial_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
        showAlert('Reporte exportado a PDF exitosamente', 'success');
    },

    // Método addHeader
    addHeader(doc, pageNumber, totalPages) {
        const startY = 10;

        // Fondo del encabezado
        doc.setFillColor(25, 42, 86);
        doc.rect(0, 0, PDF_CONFIG.width, PDF_CONFIG.headerHeight, 'F');

        // Logo (círculo con iniciales)
        doc.setFillColor(255, 193, 7);
        doc.circle(18, 18, 8, 'F');
        doc.setTextColor(25, 42, 86);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FC', 14.5, 22);

        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FlowControl', 32, 18);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema de Gestión Financiera', 32, 26);

        // Información del reporte
        doc.setFontSize(8);
        doc.text(`Reporte Matricial - ${document.getElementById('reportType').value === 'income' ? 'Ingresos' : document.getElementById('reportType').value === 'expense' ? 'Egresos' : 'Ingresos y Egresos'}`,
            PDF_CONFIG.width - 60, 18);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, PDF_CONFIG.width - 60, 26);

        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(PDF_CONFIG.marginLeft, PDF_CONFIG.headerHeight,
            PDF_CONFIG.width - PDF_CONFIG.marginRight, PDF_CONFIG.headerHeight);
    },

    // Método addFooter
    addFooter(doc, pageNumber, totalPages) {
        const footerY = PDF_CONFIG.height - PDF_CONFIG.footerHeight;

        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(PDF_CONFIG.marginLeft, footerY - 5,
            PDF_CONFIG.width - PDF_CONFIG.marginRight, footerY - 5);

        // Texto del pie de página
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('FlowControl - Sistema de Gestión Financiera',
            PDF_CONFIG.marginLeft, footerY);
        doc.text(`Página ${pageNumber} de ${totalPages}`,
            PDF_CONFIG.width - PDF_CONFIG.marginRight - 20, footerY);

        // Fecha y hora
        const now = new Date();
        doc.text(`Generado: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
            PDF_CONFIG.marginLeft, footerY + 5);
    },

    // Método checkPageBreak
    checkPageBreak(doc, yPos, neededSpace, pageData) {
        if (yPos + neededSpace > PDF_CONFIG.maxY) {
            // Agregar pie de página a la página actual
            this.addFooter(doc, pageData.currentPage, pageData.totalPages);

            // Crear nueva página
            doc.addPage();
            pageData.currentPage++;

            // Agregar encabezado a la nueva página
            this.addHeader(doc, pageData.currentPage, pageData.totalPages);

            return PDF_CONFIG.marginTop;
        }
        return yPos;
    },

    drawSimpleChart(doc, yPos) {
        // Recolectar datos de todas las semanas
        const weeks = [];
        const incomeData = [];
        const expenseData = [];

        for (const month of this.reportData.months) {
            for (let i = 0; i < month.weekData.length; i++) {
                weeks.push(`${month.name.substring(0, 3)} S${month.weekData[i].weekNumber}`);
                incomeData.push(month.weekData[i].totalIncome);
                expenseData.push(month.weekData[i].totalExpense);
            }
        }

        if (weeks.length === 0) return;

        const maxValue = Math.max(...incomeData, ...expenseData, 1);
        const chartWidth = 160;
        const chartHeight = 60;
        const chartX = 25;
        const chartY = yPos;

        // Dibujar recuadro de la gráfica
        doc.setDrawColor(150, 150, 150);
        doc.rect(chartX, chartY, chartWidth, chartHeight, 'S');

        // Dibujar líneas de cuadrícula horizontales (valores del eje Y)
        doc.setDrawColor(220, 220, 220);
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = chartY + (chartHeight / ySteps) * i;
            doc.line(chartX, y, chartX + chartWidth, y);

            // Etiquetas del eje Y
            const value = maxValue - (maxValue / ySteps) * i;
            doc.setFontSize(6);
            doc.setTextColor(100, 100, 100);
            if (value >= 1000) {
                doc.text(`${(value / 1000).toFixed(0)}k`, chartX - 12, y + 1.5);
            } else {
                const formatted = formatCurrency(value).replace('Bs.', '').trim();
                doc.text(formatted, chartX - 12, y + 1.5);
            }
        }

        // Dibujar líneas de cuadrícula verticales (valores del eje X)
        doc.setDrawColor(220, 220, 220);
        const xSteps = Math.min(weeks.length, 10);
        for (let i = 0; i <= xSteps; i++) {
            const x = chartX + (chartWidth / xSteps) * i;
            doc.line(x, chartY, x, chartY + chartHeight);
        }

        // Escalas
        const scaleY = chartHeight / maxValue;
        const stepX = chartWidth / (weeks.length - 1 || 1);

        // Dibujar línea de ingresos
        if (incomeData.length > 0 && incomeData.some(v => v > 0)) {
            doc.setDrawColor(40, 167, 69);
            doc.setLineWidth(0.5);
            let prevX = chartX;
            let prevY = chartY + chartHeight - (incomeData[0] * scaleY);

            for (let i = 1; i < incomeData.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartHeight - (incomeData[i] * scaleY);
                doc.line(prevX, prevY, x, y);

                // Dibujar puntos
                doc.setFillColor(40, 167, 69);
                doc.circle(prevX, prevY, 1.5, 'F');
                doc.circle(x, y, 1.5, 'F');

                prevX = x;
                prevY = y;
            }
        }

        // Dibujar línea de egresos
        if (expenseData.length > 0 && expenseData.some(v => v > 0)) {
            doc.setDrawColor(220, 53, 69);
            doc.setLineWidth(0.5);
            let prevX = chartX;
            let prevY = chartY + chartHeight - (expenseData[0] * scaleY);

            for (let i = 1; i < expenseData.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartHeight - (expenseData[i] * scaleY);
                doc.line(prevX, prevY, x, y);

                // Dibujar puntos
                doc.setFillColor(220, 53, 69);
                doc.circle(prevX, prevY, 1.5, 'F');
                doc.circle(x, y, 1.5, 'F');

                prevX = x;
                prevY = y;
            }
        }

        // Etiquetas del eje X (semanas)
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        const labelStep = Math.max(1, Math.floor(weeks.length / 8));
        for (let i = 0; i < weeks.length; i += labelStep) {
            const x = chartX + (i * stepX);
            if (x >= chartX && x <= chartX + chartWidth) {
                doc.text(weeks[i], x - 6, chartY + chartHeight + 5);
            }
        }

        // Título del eje X
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text('Semanas', chartX + chartWidth / 2 - 10, chartY + chartHeight + 12);

        // Título del eje Y (texto horizontal)
        doc.text('Monto (Bs.)', chartX - 18, chartY + chartHeight / 2);

        // Leyenda
        doc.setFillColor(40, 167, 69);
        doc.circle(150, chartY - 8, 2.5, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text('Ingresos', 156, chartY - 6);

        doc.setFillColor(220, 53, 69);
        doc.circle(150, chartY - 1, 2.5, 'F');
        doc.text('Egresos', 156, chartY + 1);
    },

    drawMonthChart(doc, month, yPos) {
        const weeks = month.weekData.map(w => `S${w.weekNumber}`);
        const incomeData = month.weekData.map(w => w.totalIncome);
        const expenseData = month.weekData.map(w => w.totalExpense);

        if (incomeData.length === 0 && expenseData.length === 0) return;

        const maxValue = Math.max(...incomeData, ...expenseData, 1);
        const chartWidth = 150;
        const chartHeight = 45;
        const chartX = 30;
        const chartY = yPos;

        // Dibujar recuadro de la gráfica
        doc.setDrawColor(150, 150, 150);
        doc.rect(chartX, chartY, chartWidth, chartHeight, 'S');

        // Líneas de cuadrícula horizontales
        doc.setDrawColor(220, 220, 220);
        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = chartY + (chartHeight / ySteps) * i;
            doc.line(chartX, y, chartX + chartWidth, y);

            // Etiquetas del eje Y
            const value = maxValue - (maxValue / ySteps) * i;
            doc.setFontSize(5);
            doc.setTextColor(100, 100, 100);
            if (value >= 1000) {
                doc.text(`${(value / 1000).toFixed(0)}k`, chartX - 10, y + 1.5);
            } else {
                const formatted = formatCurrency(value).replace('Bs.', '').trim();
                doc.text(formatted, chartX - 10, y + 1.5);
            }
        }

        const scaleY = chartHeight / maxValue;
        const stepX = chartWidth / (weeks.length - 1 || 1);

        // Línea de ingresos
        if (incomeData.length > 0 && incomeData.some(v => v > 0)) {
            doc.setDrawColor(40, 167, 69);
            doc.setLineWidth(0.5);
            let prevX = chartX;
            let prevY = chartY + chartHeight - (incomeData[0] * scaleY);

            for (let i = 1; i < incomeData.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartHeight - (incomeData[i] * scaleY);
                doc.line(prevX, prevY, x, y);
                doc.setFillColor(40, 167, 69);
                doc.circle(prevX, prevY, 1.5, 'F');
                doc.circle(x, y, 1.5, 'F');
                prevX = x;
                prevY = y;
            }
        }

        // Línea de egresos
        if (expenseData.length > 0 && expenseData.some(v => v > 0)) {
            doc.setDrawColor(220, 53, 69);
            doc.setLineWidth(0.5);
            let prevX = chartX;
            let prevY = chartY + chartHeight - (expenseData[0] * scaleY);

            for (let i = 1; i < expenseData.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartHeight - (expenseData[i] * scaleY);
                doc.line(prevX, prevY, x, y);
                doc.setFillColor(220, 53, 69);
                doc.circle(prevX, prevY, 1.5, 'F');
                doc.circle(x, y, 1.5, 'F');
                prevX = x;
                prevY = y;
            }
        }

        // Etiquetas del eje X
        doc.setFontSize(5);
        doc.setTextColor(80, 80, 80);
        for (let i = 0; i < weeks.length; i++) {
            const x = chartX + (i * stepX);
            if (i % 2 === 0 || weeks.length <= 5) {
                doc.text(weeks[i], x - 3, chartY + chartHeight + 4);
            }
        }

        // Título del eje X
        doc.setFontSize(6);
        doc.setTextColor(0, 0, 0);
        doc.text('Semanas', chartX + chartWidth / 2 - 8, chartY + chartHeight + 9);

        // Título del eje Y
        doc.text('Monto (Bs.)', chartX - 16, chartY + chartHeight / 2);

        // Leyenda
        doc.setFillColor(40, 167, 69);
        doc.circle(chartX + chartWidth - 35, chartY - 5, 2, 'F');
        doc.setFontSize(5);
        doc.text('Ingresos', chartX + chartWidth - 28, chartY - 3);

        doc.setFillColor(220, 53, 69);
        doc.circle(chartX + chartWidth - 35, chartY + 1, 2, 'F');
        doc.text('Egresos', chartX + chartWidth - 28, chartY + 3);
    },

    // Método renderPdfTable modificado
    renderPdfTable(doc, month, type, startY, pageData) {
        const isIncome = type === 'income';
        let yPos = startY;
        const colWidths = this.calculateColumnWidths(month.weekData.length);

        // Encabezado de la tabla
        yPos = this.checkPageBreak(doc, yPos, 20, pageData);

        doc.setFillColor(isIncome ? 40 : 220, isIncome ? 167 : 53, isIncome ? 69 : 69);
        doc.roundedRect(PDF_CONFIG.marginLeft, yPos, PDF_CONFIG.availableWidth, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(`${isIncome ? 'INGRESOS' : 'EGRESOS'}`, PDF_CONFIG.marginLeft + 5, yPos + 6);
        yPos += 8;

        // Encabezados de columnas
        let xPos = PDF_CONFIG.marginLeft;
        const headers = ['Cuenta', ...month.weekData.map(w => w.weekLabel || `Semana ${w.weekNumber}`), 'Total'];
        const widths = [35, ...colWidths, 25];

        for (let i = 0; i < headers.length; i++) {
            doc.setFillColor(240, 240, 240);
            doc.rect(xPos, yPos, widths[i], 6, 'FD');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(6);
            doc.text(headers[i], xPos + 2, yPos + 4);
            xPos += widths[i];
        }
        yPos += 6;

        // Obtener cuentas
        const allAccounts = new Set();
        for (const week of month.weekData) {
            const data = isIncome ? week.incomes : week.expenses;
            Object.keys(data).forEach(acc => allAccounts.add(acc));
        }
        const accountsList = Array.from(allAccounts).sort();

        // Filas de datos
        for (const account of accountsList) {
            yPos = this.checkPageBreak(doc, yPos, 5, pageData);

            let rowTotal = 0;
            xPos = PDF_CONFIG.marginLeft;
            const weekAmounts = [];

            for (let i = 0; i < month.weekData.length; i++) {
                const amount = month.weekData[i][isIncome ? 'incomes' : 'expenses'][account] || 0;
                weekAmounts.push(amount);
                rowTotal += amount;
            }

            for (let i = 0; i < headers.length; i++) {
                doc.setFillColor(255, 255, 255);
                doc.rect(xPos, yPos, widths[i], 5, 'FD');
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(6);

                if (i === 0) {
                    const shortAccount = account.length > 22 ? account.substring(0, 19) + '...' : account;
                    doc.text(shortAccount, xPos + 2, yPos + 3);
                } else if (i === headers.length - 1) {
                    doc.text(formatCurrency(rowTotal), xPos + 2, yPos + 3);
                } else {
                    const amount = weekAmounts[i - 1];
                    if (amount > 0) {
                        doc.text(formatCurrency(amount), xPos + 2, yPos + 3);
                    } else {
                        doc.text('-', xPos + 2, yPos + 3);
                    }
                }
                xPos += widths[i];
            }
            yPos += 5;
        }

        // Fila de totales
        yPos = this.checkPageBreak(doc, yPos, 6, pageData);

        xPos = PDF_CONFIG.marginLeft;
        const totalRow = ['TOTAL'];
        let grandTotal = 0;

        for (let i = 0; i < month.weekData.length; i++) {
            const weekTotal = month.weekData[i][isIncome ? 'totalIncome' : 'totalExpense'];
            totalRow.push(weekTotal);
            grandTotal += weekTotal;
        }
        totalRow.push(grandTotal);

        for (let i = 0; i < headers.length; i++) {
            doc.setFillColor(isIncome ? 230 : 255, isIncome ? 255 : 230, isIncome ? 230 : 230);
            doc.rect(xPos, yPos, widths[i], 6, 'FD');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);

            if (i === 0) {
                doc.text('TOTAL', xPos + 2, yPos + 4);
            } else if (i === headers.length - 1) {
                doc.text(formatCurrency(grandTotal), xPos + 2, yPos + 4);
            } else {
                doc.text(formatCurrency(totalRow[i]), xPos + 2, yPos + 4);
            }
            xPos += widths[i];
        }
        yPos += 8;

        return yPos;
    },

    calculateColumnWidths(weekCount) {
        // Calcular anchos de columna según el número de semanas
        const baseWidth = 170 - 40 - 25; // 170 total - ancho cuenta - ancho total
        const weekWidth = baseWidth / weekCount;
        return Array(weekCount).fill(Math.min(weekWidth, 22));
    },

    buildSummarySheet() {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const reportType = document.getElementById('reportType').value;

        let totalIncome = 0;
        let totalExpense = 0;

        for (const month of this.reportData.months) {
            for (const week of month.weekData) {
                totalIncome += week.totalIncome;
                totalExpense += week.totalExpense;
            }
        }

        const sheetData = [
            ['REPORTE MATRICIAL - RESUMEN GENERAL'],
            [],
            ['Parámetros del Reporte'],
            ['Fecha desde', startDate],
            ['Fecha hasta', endDate],
            ['Tipo', reportType === 'both' ? 'Ingresos y Egresos' : (reportType === 'income' ? 'Solo Ingresos' : 'Solo Egresos')],
            ['Fecha de generación', new Date().toLocaleString()],
            [],
            ['Totales Generales'],
            ['Total Ingresos', totalIncome],
            ['Total Egresos', totalExpense],
            ['Balance Neto', totalIncome - totalExpense],
            [],
            ['Resumen por Mes'],
            ['Mes', 'Total Ingresos', 'Total Egresos', 'Balance']
        ];

        for (const month of this.reportData.months) {
            let monthIncome = 0;
            let monthExpense = 0;

            for (const week of month.weekData) {
                monthIncome += week.totalIncome;
                monthExpense += week.totalExpense;
            }

            sheetData.push([month.name, monthIncome, monthExpense, monthIncome - monthExpense]);
        }

        return sheetData;
    },

    buildMonthSheet(month, type) {
        const isIncome = type === 'income';
        const weekLabels = month.weekData.map((week, idx) => week.weekLabel || `Semana ${idx + 1}`);

        // Obtener todas las cuentas
        const allAccounts = new Set();
        for (const week of month.weekData) {
            const data = isIncome ? week.incomes : week.expenses;
            Object.keys(data).forEach(acc => allAccounts.add(acc));
        }

        const accountsList = Array.from(allAccounts).sort();

        // Construir matriz
        const sheetData = [
            [`${month.name} - ${isIncome ? 'INGRESOS' : 'EGRESOS'}`],
            [],
            ['Cuentas / Semanas', ...weekLabels, 'Total']
        ];

        // Filas por cuenta
        for (const account of accountsList) {
            const row = [account];
            let rowTotal = 0;

            for (let idx = 0; idx < month.weekData.length; idx++) {
                const amount = month.weekData[idx][isIncome ? 'incomes' : 'expenses'][account] || 0;
                row.push(amount);
                rowTotal += amount;
            }
            row.push(rowTotal);
            sheetData.push(row);
        }

        // Fila de totales
        const totalRow = ['TOTAL'];
        let grandTotal = 0;

        for (let idx = 0; idx < month.weekData.length; idx++) {
            const weekTotal = month.weekData[idx][isIncome ? 'totalIncome' : 'totalExpense'];
            totalRow.push(weekTotal);
            grandTotal += weekTotal;
        }
        totalRow.push(grandTotal);
        sheetData.push(totalRow);

        return sheetData;
    },

    sanitizeSheetName(name) {
        // Eliminar caracteres no permitidos en nombres de hojas de Excel
        return name.replace(/[\\/*?:\[\]]/g, '').substring(0, 31);
    },

    buildSheetData(month, type) {
        const isIncome = type === 'income';
        const weekLabels = month.weeks.map((week, idx) => `Semana ${week.weekNumber}`);

        // Obtener todas las cuentas
        const allAccounts = new Set();
        month.weekData.forEach(week => {
            const data = isIncome ? week.incomes : week.expenses;
            Object.keys(data).forEach(acc => allAccounts.add(acc));
        });

        const accountsList = Array.from(allAccounts).sort();

        // Construir matriz
        const sheetData = [
            [`${month.name} - ${isIncome ? 'INGRESOS' : 'EGRESOS'}`],
            [],
            ['Cuentas / Semanas', ...weekLabels, 'Total']
        ];

        let totalRow = ['TOTAL', ...weekLabels.map((_, idx) => month.weekData[idx][isIncome ? 'totalIncome' : 'totalExpense']),
            month.weekData.reduce((sum, w) => sum + w[isIncome ? 'totalIncome' : 'totalExpense'], 0)];

        for (const account of accountsList) {
            const row = [account];
            let rowTotal = 0;

            for (let idx = 0; idx < month.weeks.length; idx++) {
                const amount = month.weekData[idx][isIncome ? 'incomes' : 'expenses'][account] || 0;
                row.push(amount);
                rowTotal += amount;
            }
            row.push(rowTotal);
            sheetData.push(row);
        }

        sheetData.push(totalRow);

        return sheetData;
    },

    // modules/reports.js - En setupEventListeners

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