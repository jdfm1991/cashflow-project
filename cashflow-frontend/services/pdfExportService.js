
export const pdfExportService = {
    // Configuración de colores según tipo de transacción
    getTheme(type) {
        const isExpense = type === 'expense';
        return {
            // Colores principales
            primary: isExpense ? '#dc3545' : '#28a745',
            primaryDark: isExpense ? '#c82333' : '#218838',
            primaryLight: isExpense ? '#f8d7da' : '#d4edda',
            secondary: '#6c757d',
            textColor: '#495057',

            // Textos
            title: isExpense ? 'REPORTE DE EGRESOS' : 'REPORTE DE INGRESOS',
            icon: isExpense ? '📊' : '💰',
            badgeCash: isExpense ? 'Efectivo' : 'Efectivo',
            badgeBank: 'Banco',

            // Estilos de badges
            badgeCashClass: isExpense ? 'badge-cash-expense' : 'badge-cash-income',
            badgeBankClass: 'badge-bank'
        };
    },

    /**
     * Exportar transacciones a PDF
     * @param {Array} transactions - Lista de transacciones
     * @param {Object} filters - Filtros aplicados
     * @param {string} groupBy - Tipo de agrupación: 'week', 'month', 'quarter', 'semester', 'year'
     * @param {boolean} isSuperAdmin - Si es super_admin
     * @param {boolean} showAllCompanies - Si está mostrando todas las empresas
     * @param {boolean} includeDetailedTables - Si incluir tablas detalladas
     * @param {string} type - Tipo de transacción: 'expense' o 'income'
     */
    exportToPDF(transactions, filters, groupBy = 'month', isSuperAdmin = false, showAllCompanies = false, includeDetailedTables = true, type = 'expense') {
        if (!transactions || transactions.length === 0) {
            console.warn('No hay datos para exportar');
            return;
        }

        const theme = this.getTheme(type);

        let groupedData;

        if (isSuperAdmin && showAllCompanies) {
            groupedData = this.groupByCompanyThenPeriod(transactions, groupBy);
        } else {
            groupedData = this.groupByPeriod(transactions, groupBy);
        }

        const reportHtml = this.generateReportHTML(groupedData, filters, groupBy, isSuperAdmin, showAllCompanies, includeDetailedTables, type, theme);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permite las ventanas emergentes para generar el PDF');
            return;
        }

        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 1500);
    },

    /**
     * Método específico para egresos (mantiene compatibilidad)
     */
    exportExpensesToPDF(expenses, filters, groupBy = 'month', isSuperAdmin = false, showAllCompanies = false, includeDetailedTables = true) {
        return this.exportToPDF(expenses, filters, groupBy, isSuperAdmin, showAllCompanies, includeDetailedTables, 'expense');
    },

    /**
     * Método específico para ingresos (mantiene compatibilidad)
     */
    exportIncomesToPDF(incomes, filters, groupBy = 'month', isSuperAdmin = false, showAllCompanies = false, includeDetailedTables = true) {
        return this.exportToPDF(incomes, filters, groupBy, isSuperAdmin, showAllCompanies, includeDetailedTables, 'income');
    },

    /**
     * Exportar reporte financiero a PDF
     * @param {Array} reportData - Datos del reporte (agrupados por período)
     * @param {Object} filters - Filtros aplicados { startDate, endDate, groupBy }
     * @param {Object} companyInfo - Información de la empresa { name, business_name, tax_id, logo }
     * @param {Array} accounts - Lista de cuentas para obtener categorías
     */
    exportFinancialReportToPDF(reportData, filters, companyInfo = null, companyLogo = null, accounts = [], bankBalances = [], latestExchangeRate = null, preCalculatedTotals = null) {
        if (!reportData || reportData.length === 0) {
            console.warn('No hay datos para exportar');
            return;
        }

        const { startDate, endDate, groupBy } = filters;

        // ✅ Asegurar que companyInfo tenga valores por defecto
        const companyName = companyInfo?.name || 'FlowControl';
        const businessName = companyInfo?.business_name || '';
        const taxId = companyInfo?.tax_id || '';

        // ✅ Para el logo, puede venir como companyLogo o dentro de companyInfo.logo
        let logo = companyLogo || companyInfo?.logo || null;

        // ✅ Si el logo es una ruta relativa, convertir a URL absoluta
        if (logo && !logo.startsWith('http') && !logo.startsWith('data:')) {
            const baseUrl = window.location.origin;
            logo = `${baseUrl}/cashflow-project/cashflow-backend/public/${logo}`;
        }

        // ✅ LOG para depuración
        console.log('=== exportFinancialReportToPDF ===');
        console.log('companyInfo recibido:', companyInfo);
        console.log('companyLogo recibido:', companyLogo);
        console.log('Logo final:', logo);
        console.log('Company Name:', companyName);
        console.log('Business Name:', businessName);
        console.log('Tax ID:', taxId);

        // ✅ Obtener tasa de cambio real
        const exchangeRate = latestExchangeRate?.rate || 1;
        const baseCurrency = latestExchangeRate?.from_currency_code || 'VES';
        const defaultCurrency = latestExchangeRate?.to_currency_code || 'USD';

        // ✅ Usar totales precalculados o calcular desde cero
        let totals;
        if (preCalculatedTotals) {
            totals = preCalculatedTotals;
        } else {
            totals = this.calculateRealTotals(reportData);
        }

        // ✅ Ordenar datos
        const sortedData = [...reportData].sort((a, b) => {
            if (groupBy === 'year') return a.year - b.year;
            if (groupBy === 'month') return a.sortKey - b.sortKey;
            if (groupBy === 'quarter') return a.sortKey - b.sortKey;
            return 0;
        });

        // ✅ Calcular resumen mensual con montos reales
        const monthlySummary = this.calculateMonthlySummaryWithCurrency(sortedData, groupBy, defaultCurrency);

        // ✅ Calcular ganancias/pérdidas mensuales
        const monthlyProfitLoss = monthlySummary.map(month => ({
            period: month.period,
            income: month.totalIncome,
            expense: month.totalExpense,
            profitLoss: month.totalIncome - month.totalExpense,
            incomeDivisa: month.totalIncomeDivisa || 0,
            expenseDivisa: month.totalExpenseDivisa || 0,
            profitLossDivisa: (month.totalIncomeDivisa || 0) - (month.totalExpenseDivisa || 0)
        }));

        // ✅ Calcular totales de saldos bancarios
        const totalBankBase = bankBalances.reduce((sum, b) => sum + (parseFloat(b.current_balance) || 0), 0);
        const totalBankDivisa = totalBankBase / exchangeRate;

        const reportHtml = this.generateFinancialReportHTMLImproved(sortedData, {
            startDate,
            endDate,
            groupBy,
            companyName,
            businessName,
            taxId,
            logo,
            totals,
            monthlySummary,
            monthlyProfitLoss,
            bankBalances,
            exchangeRate,
            baseCurrency,
            defaultCurrency,
            totalBankBase,
            totalBankDivisa
        }, accounts);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permite las ventanas emergentes para generar el PDF');
            return;
        }

        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 1500);
    },

    generateFinancialReportHTMLImproved(reportData, metadata, accounts) {
        const {
            startDate,
            endDate,
            groupBy,
            companyName,
            businessName,
            taxId,
            logo,
            totals,
            monthlySummary,
            monthlyProfitLoss,
            bankBalances,
            exchangeRate,
            baseCurrency,
            defaultCurrency,
            totalBankBase,
            totalBankDivisa
        } = metadata;

        const groupByText = groupBy === 'year' ? 'Año' : (groupBy === 'month' ? 'Mes' : 'Trimestre');
        const periodData = reportData;

        // Función helper para formatear números
        const formatNumberFn = (value) => {
            if (value === null || value === undefined || isNaN(value)) return '0.00';
            return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte Financiero - ${this.escapeHtml(companyName)}</title>
                <meta charset="UTF-8">
                <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
    
                    @media print {
                        body { margin: 0; padding: 0; }
                        .no-print { display: none; }
                        .period-section, .chart-container { page-break-inside: avoid; }
                        @page { margin: 1.5cm; }
                    }
                    
                    @media screen {
                        body { background: #f0f2f5; padding: 20px; }
                        .report-container { 
                            max-width: 1200px; 
                            margin: 0 auto; 
                            background: white; 
                            box-shadow: 0 0 20px rgba(0,0,0,0.1); 
                            border-radius: 8px;
                        }
                        .print-button { 
                            position: fixed; 
                            bottom: 20px; 
                            right: 20px; 
                            background: #007bff; 
                            color: white; 
                            border: none; 
                            padding: 12px 24px; 
                            border-radius: 8px; 
                            cursor: pointer; 
                            font-size: 16px; 
                            font-weight: bold; 
                            z-index: 1000; 
                        }
                        .print-button:hover { background: #0056b3; }
                    }
                    
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.5; }
                    
                    /* Header - solo en primera página */
                    .pdf-header {
                        display: grid;
                        grid-template-columns: 10% 60% 20%;
                        gap: 15px;
                        align-items: center;
                        padding: 15px 25px;
                        background: white;
                        border-bottom: 3px solid #007bff;
                        margin-bottom: 25px;
                    }
                    
                    .header-logo { text-align: center; padding: 5px; }
                    .header-logo img { max-width: 100px; max-height: 85px; object-fit: contain; }
                    .default-logo {
                        width: 100px; height: 100px;
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        border-radius: 50%;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 22px;
                        font-weight: bold;
                        margin: 0 auto;
                    }
                    
                    .header-company { text-align: left; }
                    .header-company h1 { font-size: 18px; margin: 0 0 5px 0; color: #007bff; }
                    .header-company .company-name { font-size: 13px; font-weight: bold; margin: 0; color: #333; }
                    .header-company .business-name { font-size: 10px; color: #6c757d; margin: 3px 0; }
                    .header-company .tax-id { font-size: 10px; color: #6c757d; margin: 2px 0; }
                    
                    .header-dates { text-align: right; font-size: 10px; color: #495057; }
                    .header-dates p { margin: 3px 0; }
                    .header-dates .report-title { font-weight: bold; font-size: 18px; color: #007bff; margin-bottom: 5px; }
                    
                    /* Tarjetas de resumen */
                    .summary-cards { display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
                    .card { flex: 1; min-width: 150px; padding: 15px; border-radius: 8px; text-align: center; color: white; }
                    .card-success { background: #28a745; }
                    .card-danger { background: #dc3545; }
                    .card-primary { background: #007bff; }
                    .card-warning { background: #ffc107; color: #333; }
                    .card-title { font-size: 12px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; }
                    .card-value { font-size: 22px; font-weight: bold; }
                    .dual-currency { font-size: 18px; color: rgba(255,255,255,0.9); margin-top: 8px; }
                    
                    /* Gráficas */
                    .chart-container { margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
                    .chart-container h3 { margin-bottom: 15px; color: #333; font-size: 18px; }
                    
                    /* Tablas */
                    .section-title {
                        background: #343a40;
                        color: white;
                        padding: 10px 15px;
                        margin: 25px 0 15px 0;
                        border-radius: 6px;
                        font-size: 18px;
                    }
                    
                    .summary-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0 20px 0;
                        font-size: 18px;
                    }
                    .summary-table th, .summary-table td {
                        padding: 10px 8px;
                        border: 1px solid #dee2e6;
                    }
                    .summary-table th {
                        background: #343a40;
                        color: white;
                        text-align: center;
                        font-size: 12px;
                    }
                    .summary-table td { text-align: right; }
                    .summary-table td:first-child { text-align: left; font-weight: bold; }
                    .summary-table tfoot td { background: #e9ecef; font-weight: bold; }
                    
                    /* Períodos */
                    .period-section { 
                        margin-bottom: 30px; 
                        border: 1px solid #dee2e6; 
                        border-radius: 8px; 
                        overflow: hidden; 
                        break-inside: avoid; 
                    }
                    .period-header { 
                        background: #343a40; 
                        color: white; 
                        padding: 15px 20px;  /* Aumentado */
                    }
                    .period-header h2 { 
                        margin: 0 0 5px; 
                        font-size: 20px;  /* Aumentado de 16px */
                    }
                    .period-summary { 
                        font-size: 15px;  /* Aumentado */
                        opacity: 0.9; 
                    }
                    .period-content { display: flex; flex-wrap: wrap; }
                    .income-section, .expense-section { 
                        flex: 1; 
                        min-width: 300px; 
                        padding: 20px 25px;  /* Aumentado */
                    }
                    .income-section { border-right: 1px solid #dee2e6; }
                    .expense-section { border-left: 1px solid #dee2e6; }
                    .income-title { 
                        color: #28a745; 
                        font-size: 20px;  /* Aumentado de 16px */
                        margin-bottom: 15px; 
                        padding-bottom: 8px; 
                        border-bottom: 3px solid #28a745; 
                        font-weight: bold; 
                    }
                    .expense-title { 
                        color: #dc3545; 
                        font-size: 20px;  /* Aumentado de 16px */
                        margin-bottom: 15px; 
                        padding-bottom: 8px; 
                        border-bottom: 3px solid #dc3545; 
                        font-weight: bold; 
                    }
                    
                    /* Categorías y cuentas */
                    .category-group { 
                        margin-bottom: 18px;  /* Aumentado */
                    }
                    .category-header { 
                        background: #f8f9fa; 
                        padding: 12px 16px;  /* Aumentado */
                        border-radius: 8px; 
                        display: flex; 
                        justify-content: space-between; 
                        font-size: 16px;  /* Aumentado de 13px */
                        font-weight: bold;
                        border-left: 4px solid #007bff;
                    }
                    .percent-badge { 
                        background: #e9ecef; 
                        padding: 2px 8px; 
                        border-radius: 12px; 
                        font-size: 18px; 
                        margin-left: 8px; 
                        font-weight: normal;
                    }
                    .category-accounts { 
                        padding-left: 25px;  /* Aumentado */
                        margin-top: 10px; 
                    }
                    .account-row { 
                        display: flex; 
                        justify-content: space-between; 
                        padding: 8px 0;  /* Aumentado */
                        font-size: 14px;  /* Aumentado de 12px */
                        border-bottom: 1px dashed #e9ecef;
                    }
                    .account-row span:first-child { color: #495057; }
                    .account-row span:last-child { font-weight: 500; }
                    .section-total { 
                        margin-top: 18px; 
                        padding-top: 12px; 
                        text-align: right; 
                        font-weight: bold; 
                        font-size: 16px;  /* Aumentado de 13px */
                        border-top: 2px solid #dee2e6;
                    }
                    .empty-message { text-align: center; color: #6c757d; padding: 20px; font-style: italic; font-size: 12px; }
                    
                    /* Saldos bancarios */
                    .bank-balances-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 14px;  /* Aumentado */
                    }
                    .bank-balances-table th {
                        background: #007bff;
                        color: white;
                        padding: 12px;  /* Aumentado */
                        text-align: left;
                        font-size: 14px;
                    }
                    .bank-balances-table td {
                        padding: 10px;  /* Aumentado */
                        border-bottom: 1px solid #dee2e6;
                        font-size: 14px;
                    }
                    .bank-balances-table td.text-right { text-align: right; }
                    
                    /* Utilidades */
                    .profit-positive { color: #28a745; font-weight: bold; }
                    .profit-negative { color: #dc3545; font-weight: bold; }
                    .text-right { text-align: right; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 9px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
                    
                    <!-- Header (solo primera página) -->
                    <div class="pdf-header">
                        <div class="header-logo">
                            ${logo ? `<img src="${logo}" class="logo" alt="Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"><div class="default-logo" style="display: none;">FC</div>` : `<div class="default-logo">FC</div>`}
                        </div>
                        <div class="header-company">
                            <h1>Reporte de Flujo de Caja</h1>
                            <div class="company-name">${this.escapeHtml(companyName)}</div>
                            ${businessName ? `<div class="business-name">${this.escapeHtml(businessName)}</div>` : ''}
                            ${taxId ? `<div class="tax-id">RIF: ${this.escapeHtml(taxId)}</div>` : ''}
                        </div>
                        <div class="header-dates">
                            <p class="report-title">Reporte Financiero</p>
                            <p>Período: ${startDate} al ${endDate}</p>
                            <p>Agrupado por: ${groupByText}</p>
                            <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
                        </div>
                    </div>
                    
                    <div class="report-content">
                        <!-- Tarjetas de resumen -->
                        <div class="summary-cards">
                            <div class="card card-success">
                                <div class="card-title">Total Ingresos</div>
                                <div class="card-value">${formatNumberFn(totals.totalIncomeBase)} ${baseCurrency}</div>
                                <div class="dual-currency">≈ ${formatNumberFn(totals.totalIncomeDivisa)} ${defaultCurrency}</div>
                            </div>
                            <div class="card card-danger">
                                <div class="card-title">Total Egresos</div>
                                <div class="card-value">${formatNumberFn(totals.totalExpenseBase)} ${baseCurrency}</div>
                                <div class="dual-currency">≈ ${formatNumberFn(totals.totalExpenseDivisa)} ${defaultCurrency}</div>
                            </div>
                            <div class="card ${totals.totalBalanceBase >= 0 ? 'card-primary' : 'card-warning'}">
                                <div class="card-title">Balance Neto</div>
                                <div class="card-value">${formatNumberFn(totals.totalBalanceBase)} ${baseCurrency}</div>
                                <div class="dual-currency">≈ ${formatNumberFn(totals.totalBalanceDivisa)} ${defaultCurrency}</div>
                            </div>
                        </div>
                        
                        <!-- Gráfica de tendencia -->
                        <div class="chart-container">
                            <h3>📈 Evolución de Ingresos vs Egresos</h3>
                            <canvas id="trendChart" height="100"></canvas>
                        </div>
                        
                        <!-- Tabla Resumen por Período -->
                        <div class="section-title">📊 Resumen de Ingresos y Egresos por Período</div>
                        <table class="summary-table">
                            <thead>
                                <tr>
                                    <th>Período</th>
                                    <th>Ingresos (${baseCurrency})</th>
                                    <th>Ingresos (${defaultCurrency})</th>
                                    <th>Egresos (${baseCurrency})</th>
                                    <th>Egresos (${defaultCurrency})</th>
                                    <th>Balance (${baseCurrency})</th>
                                    <th>Balance (${defaultCurrency})</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlySummary.map(month => {
            const balance = month.totalIncome - month.totalExpense;
            const balanceDivisa = (month.totalIncomeDivisa || 0) - (month.totalExpenseDivisa || 0);
            return `
                                    <tr>
                                        <td><strong>${month.period}</strong></td>
                                        <td class="text-right">${formatNumberFn(month.totalIncome)}</td>
                                        <td class="text-right">${formatNumberFn(month.totalIncomeDivisa)}</td>
                                        <td class="text-right">${formatNumberFn(month.totalExpense)}</td>
                                        <td class="text-right">${formatNumberFn(month.totalExpenseDivisa)}</td>
                                        <td class="text-right ${balance >= 0 ? 'profit-positive' : 'profit-negative'}">${formatNumberFn(balance)}</td>
                                        <td class="text-right ${balanceDivisa >= 0 ? 'profit-positive' : 'profit-negative'}">${formatNumberFn(balanceDivisa)}</td>
                                    </tr>
                                    `;
        }).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td><strong>TOTAL GENERAL</strong></td>
                                    <td class="text-right"><strong>${formatNumberFn(totals.totalIncomeBase)}</strong></td>
                                    <td class="text-right"><strong>${formatNumberFn(totals.totalIncomeDivisa)}</strong></td>
                                    <td class="text-right"><strong>${formatNumberFn(totals.totalExpenseBase)}</strong></td>
                                    <td class="text-right"><strong>${formatNumberFn(totals.totalExpenseDivisa)}</strong></td>
                                    <td class="text-right ${totals.totalBalanceBase >= 0 ? 'profit-positive' : 'profit-negative'}"><strong>${formatNumberFn(totals.totalBalanceBase)}</strong></td>
                                    <td class="text-right ${totals.totalBalanceDivisa >= 0 ? 'profit-positive' : 'profit-negative'}"><strong>${formatNumberFn(totals.totalBalanceDivisa)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <!-- Gráfica de Ganancias/Pérdidas -->
                        <div class="chart-container">
                            <h3>📊 Evolución de Ganancias / Pérdidas por Período</h3>
                            <canvas id="profitLossChart" height="80"></canvas>
                        </div>
                        
                        <!-- Detalle por período -->
                        <div class="section-title">📋 Detalle de Transacciones por Período</div>
                        ${periodData.map(period => this.generatePeriodHTMLImproved(period, groupBy, accounts, baseCurrency, defaultCurrency)).join('')}
                        
                        <!-- Saldos Bancarios -->
                        <div class="section-title">🏦 Saldos Bancarios Actuales</div>
                        <div class="bank-balances-container">
                            ${bankBalances && bankBalances.length > 0 ? `
                            <table class="bank-balances-table">
                                <thead>
                                    <tr>
                                        <th>Banco</th>
                                        <th>Número de Cuenta</th>
                                        <th>Tipo</th>
                                        <th>Moneda</th>
                                        <th>Saldo Actual (${baseCurrency})</th>
                                        <th>Saldo Actual (${defaultCurrency})*</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bankBalances.map(bank => {
            const saldoDivisa = (parseFloat(bank.current_balance) || 0) / exchangeRate;
            return `
                                        <tr>
                                            <td>${this.escapeHtml(bank.bank_name)}</td>
                                            <td>${bank.account_number}</td>
                                            <td>${this.getAccountTypeLabel(bank.account_type)}</td>
                                            <td>${bank.currency_code || baseCurrency}</td>
                                            <td class="text-right">${formatNumberFn(parseFloat(bank.current_balance))}</td>
                                            <td class="text-right">${formatNumberFn(saldoDivisa)}</td>
                                        </tr>
                                        `;
        }).join('')}
                                </tbody>
                                <tfoot style="background: #e9ecef; font-weight: bold;">
                                    <tr>
                                        <td colspan="4"><strong>TOTAL SALDOS</strong></td>
                                        <td class="text-right"><strong>${formatNumberFn(totalBankBase)}</strong></td>
                                        <td class="text-right"><strong>${formatNumberFn(totalBankDivisa)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div class="dual-currency" style="margin-top: 10px; font-size: 10px; color: #6c757d;">
                                * Conversión realizada utilizando tasa de cambio vigente: 1 ${baseCurrency} = ${exchangeRate.toFixed(4)} ${defaultCurrency}
                            </div>
                            ` : `<div class="alert alert-info">No hay cuentas bancarias configuradas o activas.</div>`}
                        </div>
                        
                        <div class="footer">
                            <p>Este reporte fue generado automáticamente por el Sistema de Flujo de Caja</p>
                            <p>© ${new Date().getFullYear()} - Todos los derechos reservados</p>
                        </div>
                    </div>
                    
                    <script>
                        // Formatear número de forma segura
                        function formatNumberSafe(value) {
                            if (value === null || value === undefined || isNaN(value)) return '0.00';
                            return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        
                        window.addEventListener('load', function() {
                            // Gráfica de tendencia
                            const ctx = document.getElementById('trendChart').getContext('2d');
                            const data = ${JSON.stringify(monthlySummary)};
                            const labels = data.map(d => d.period);
                            const incomeData = data.map(d => d.totalIncome);
                            const expenseData = data.map(d => d.totalExpense);
                            
                            new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: labels,
                                    datasets: [
                                        { label: 'Ingresos', data: incomeData, borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#28a745', pointBorderColor: '#fff', pointRadius: 4, pointHoverRadius: 6 },
                                        { label: 'Egresos', data: expenseData, borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#dc3545', pointBorderColor: '#fff', pointRadius: 4, pointHoverRadius: 6 }
                                    ]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: true,
                                    plugins: { tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + formatNumberSafe(context.raw); } } } },
                                    scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return formatNumberSafe(value); } } } }
                                }
                            });
                            
                            // Gráfica de Ganancias/Pérdidas
                            const profitLossCtx = document.getElementById('profitLossChart').getContext('2d');
                            const profitLossData = ${JSON.stringify(monthlyProfitLoss)};
                            const profitLossLabels = profitLossData.map(m => m.period);
                            const profitLossValues = profitLossData.map(m => m.profitLoss);
                            
                            new Chart(profitLossCtx, {
                                type: 'bar',
                                data: {
                                    labels: profitLossLabels,
                                    datasets: [{
                                        label: 'Ganancia / Pérdida',
                                        data: profitLossValues,
                                        backgroundColor: profitLossValues.map(v => v >= 0 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)'),
                                        borderColor: profitLossValues.map(v => v >= 0 ? '#28a745' : '#dc3545'),
                                        borderWidth: 1
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: true,
                                    plugins: { tooltip: { callbacks: { label: function(context) { return (context.raw >= 0 ? '💰 Ganancia: ' : '⚠️ Pérdida: ') + formatNumberSafe(Math.abs(context.raw)); } } } },
                                    scales: { y: { ticks: { callback: function(value) { return formatNumberSafe(value); } } } }
                                }
                            });
                        });
                    <\/script>
                </div>
            </body>
            </html>
        `;
    },

    generatePeriodHTMLImproved(period, groupBy, accounts, baseCurrency, defaultCurrency) {
        const periodTitle = groupBy === 'year' ? `Año ${period.year}` :
            (groupBy === 'month' ? `${period.monthName} ${period.year}` :
                `${period.quarterName} ${period.year}`);

        const balance = period.totalIncome - period.totalExpense;
        const balanceDivisa = (period.incomeByCurrency?.[defaultCurrency] || 0) - (period.expenseByCurrency?.[defaultCurrency] || 0);

        // Función para agrupar por categoría incluyendo montos en divisa
        const getGroupedByCategory = (accountsByAccount, isIncome) => {
            const grouped = {};
            for (const [accountName, amountBase] of Object.entries(accountsByAccount)) {
                const accountInfo = accounts.find(a => a.name === accountName);
                const category = accountInfo?.category || 'Otros';

                // ✅ Obtener el monto en divisa para esta cuenta (usando los datos reales)
                let amountDivisa = 0;
                if (isIncome && period.incomeByCurrencyDetails?.[accountName]) {
                    amountDivisa = period.incomeByCurrencyDetails[accountName][defaultCurrency] || 0;
                } else if (!isIncome && period.expenseByCurrencyDetails?.[accountName]) {
                    amountDivisa = period.expenseByCurrencyDetails[accountName][defaultCurrency] || 0;
                }

                // ✅ Si no hay detalle por moneda, usar el monto original de la transacción
                // Buscar en las transacciones originales
                if (amountDivisa === 0) {
                    const transactions = isIncome ? period.incomes : period.expenses;
                    const accountTransactions = transactions.filter(t => (t.account_name || 'Sin cuenta') === accountName);
                    amountDivisa = accountTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
                }

                if (!grouped[category]) {
                    grouped[category] = { totalBase: 0, totalDivisa: 0, accounts: [] };
                }
                grouped[category].totalBase += amountBase;
                grouped[category].totalDivisa += amountDivisa;
                grouped[category].accounts.push({ name: accountName, amountBase, amountDivisa });
            }
            return grouped;
        };

        const incomeGrouped = getGroupedByCategory(period.incomeByAccount, true);
        const expenseGrouped = getGroupedByCategory(period.expenseByAccount, false);

        const totalIncomeDivisa = period.incomeByCurrency?.[defaultCurrency] ||
            period.incomes?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;
        const totalExpenseDivisa = period.expenseByCurrency?.[defaultCurrency] ||
            period.expenses?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

        const renderCategorySection = (groupedData, totalBase, totalDivisa, type) => {
            const sortedCategories = Object.keys(groupedData).sort((a, b) => groupedData[b].totalBase - groupedData[a].totalBase);

            if (sortedCategories.length === 0) {
                return '<div class="empty-message">No hay registros</div>';
            }

            let html = '';
            for (const category of sortedCategories) {
                const categoryData = groupedData[category];
                const categoryPercentBase = totalBase > 0 ? ((categoryData.totalBase / totalBase) * 100).toFixed(1) : 0;
                const categoryPercentDivisa = totalDivisa > 0 ? ((categoryData.totalDivisa / totalDivisa) * 100).toFixed(1) : 0;

                html += `
            <div class="category-group">
                <div class="category-header">
                    <span><strong>${this.escapeHtml(category)}</strong> 
                        <span class="percent-badge">${categoryPercentBase}% / ${categoryPercentDivisa}%</span>
                    </span>
                    <span><strong>${categoryData.totalBase.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency}</strong> 
                        / ${categoryData.totalDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency}</span>
                </div>
                <div class="category-accounts">
                    ${categoryData.accounts
                        .sort((a, b) => b.amountBase - a.amountBase)
                        .map(acc => {
                            const accPercentBase = totalBase > 0 ? ((acc.amountBase / totalBase) * 100).toFixed(1) : 0;
                            const accPercentDivisa = totalDivisa > 0 ? ((acc.amountDivisa / totalDivisa) * 100).toFixed(1) : 0;
                            return `
                            <div class="account-row">
                                <span>${this.escapeHtml(acc.name)}</span>
                                <span>${acc.amountBase.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} (${accPercentBase}%) / 
                                      ${acc.amountDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency} (${accPercentDivisa}%)</span>
                            </div>
                            `;
                        }).join('')}
                </div>
            </div>
            `;
            }
            return html;
        };

        return `
    <div class="period-section">
        <div class="period-header">
            <h2>📅 ${periodTitle}</h2>
            <div class="period-summary">
                Ingresos: ${period.totalIncome.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} / 
                ${totalIncomeDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency} | 
                Egresos: ${period.totalExpense.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} / 
                ${totalExpenseDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency} | 
                Balance: ${balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} / 
                ${balanceDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency}
            </div>
        </div>
        <div class="period-content">
            <div class="income-section">
                <h3 class="income-title">📈 INGRESOS</h3>
                ${renderCategorySection(incomeGrouped, period.totalIncome, totalIncomeDivisa, 'income')}
                <div class="section-total">Total Ingresos: ${period.totalIncome.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} / 
                    ${totalIncomeDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency}</div>
            </div>
            <div class="expense-section">
                <h3 class="expense-title">📉 EGRESOS</h3>
                ${renderCategorySection(expenseGrouped, period.totalExpense, totalExpenseDivisa, 'expense')}
                <div class="section-total">Total Egresos: ${period.totalExpense.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${baseCurrency} / 
                    ${totalExpenseDivisa.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${defaultCurrency}</div>
            </div>
        </div>
    </div>
    `;
    },

    /**
     * Calcular totales reales desde los datos (sin división manual)
     */
    calculateRealTotals(reportData) {
        let totalIncomeBase = 0;
        let totalIncomeDivisa = 0;
        let totalExpenseBase = 0;
        let totalExpenseDivisa = 0;

        for (const period of reportData) {
            totalIncomeBase += period.totalIncome || 0;
            totalExpenseBase += period.totalExpense || 0;

            // Sumar divisas por moneda
            if (period.incomeByCurrency) {
                for (const [currency, amount] of Object.entries(period.incomeByCurrency)) {
                    totalIncomeDivisa += amount || 0;
                }
            }
            if (period.expenseByCurrency) {
                for (const [currency, amount] of Object.entries(period.expenseByCurrency)) {
                    totalExpenseDivisa += amount || 0;
                }
            }
        }

        return {
            totalIncomeBase,
            totalIncomeDivisa,
            totalExpenseBase,
            totalExpenseDivisa,
            totalBalanceBase: totalIncomeBase - totalExpenseBase,
            totalBalanceDivisa: totalIncomeDivisa - totalExpenseDivisa
        };
    },

    /**
     * Calcular resumen mensual con montos en divisa
     */
    calculateMonthlySummaryWithCurrency(reportData, groupBy, defaultCurrency) {
        if (groupBy !== 'month') {
            const monthlyData = new Map();

            reportData.forEach(period => {
                if (period.month && period.year) {
                    const key = `${period.year}-${period.month}`;
                    const monthName = period.monthName;

                    if (!monthlyData.has(key)) {
                        monthlyData.set(key, {
                            period: monthName,
                            year: period.year,
                            month: period.month,
                            totalIncome: 0,
                            totalExpense: 0,
                            totalIncomeDivisa: 0,
                            totalExpenseDivisa: 0
                        });
                    }
                    const month = monthlyData.get(key);
                    month.totalIncome += period.totalIncome || 0;
                    month.totalExpense += period.totalExpense || 0;
                    month.totalIncomeDivisa += period.incomeByCurrency?.[defaultCurrency] || 0;
                    month.totalExpenseDivisa += period.expenseByCurrency?.[defaultCurrency] || 0;
                }
            });

            return Array.from(monthlyData.values()).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });
        }

        return reportData.map(month => ({
            period: month.monthName,
            year: month.year,
            month: month.month,
            totalIncome: month.totalIncome || 0,
            totalExpense: month.totalExpense || 0,
            totalIncomeDivisa: month.incomeByCurrency?.[defaultCurrency] || 0,
            totalExpenseDivisa: month.expenseByCurrency?.[defaultCurrency] || 0
        }));
    },

    /**
     * Calcular totales para el reporte financiero
     */
    calculateTotals(reportData) {
        const totalIncome = reportData.reduce((sum, p) => sum + p.totalIncome, 0);
        const totalExpense = reportData.reduce((sum, p) => sum + p.totalExpense, 0);
        const totalBalance = totalIncome - totalExpense;
        return { totalIncome, totalExpense, totalBalance };
    },

    /**
     * Generar HTML para reporte financiero
     */
    generateFinancialReportHTML(reportData, metadata, accounts) {
        const { startDate, endDate, groupBy, companyName, businessName, taxId, logo, totals, monthlySummary, monthlyProfitLoss, bankBalances } = metadata;
        const groupByText = groupBy === 'year' ? 'Año' : (groupBy === 'month' ? 'Mes' : 'Trimestre');

        // Determinar la moneda base y por defecto (esto debería venir de currencyService)
        const baseCurrency = 'VES';
        const defaultCurrency = 'USD';

        return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Reporte Financiero - ${this.escapeHtml(companyName)}</title>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <style>
            ${this.getFinancialReportStyles()}
            
            /* Estilos adicionales para nuevas secciones */
            .dual-currency {
                font-size: 18px;
                color: #6c757d;
            }
            .dual-currency .base {
                color: #007bff;
            }
            .dual-currency .default {
                color: #28a745;
            }
            .summary-table th, .summary-table td {
                padding: 8px;
                text-align: right;
            }
            .summary-table th:first-child, .summary-table td:first-child {
                text-align: left;
            }
            .profit-positive {
                color: #28a745;
                font-weight: bold;
            }
            .profit-negative {
                color: #dc3545;
                font-weight: bold;
            }
            .bank-balances-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .bank-balances-table th {
                background: #007bff;
                color: white;
                padding: 8px;
                text-align: left;
            }
            .bank-balances-table td {
                padding: 6px;
                border-bottom: 1px solid #dee2e6;
            }
            .bank-balances-table tr:hover {
                background: #f8f9fa;
            }
            .section-title {
                background: #343a40;
                color: white;
                padding: 10px 15px;
                margin: 20px 0 15px 0;
                border-radius: 6px;
                font-size: 18px;
            }
            .profit-loss-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .profit-loss-card h4 {
                margin: 0 0 10px 0;
                font-size: 18px;
            }
            .profit-loss-card .total {
                font-size: 24px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
            
            <!-- Header de 3 columnas -->
            <div class="pdf-header" id="repeatingHeader">
                <div class="header-logo">
                    ${logo ?
                `<img src="${logo}" class="logo" alt="Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                             <div class="default-logo" style="display: none;">FC</div>` :
                `<div class="default-logo">FC</div>`
            }
                </div>
                <div class="header-company">
                    <h1>Reporte de Flujo de Caja</h1>
                    <div class="company-name">${this.escapeHtml(companyName)}</div>
                    ${businessName ? `<div class="business-name">${this.escapeHtml(businessName)}</div>` : ''}
                    ${taxId ? `<div class="tax-id">RIF: ${this.escapeHtml(taxId)}</div>` : ''}
                </div>
                <div class="header-dates">
                    <p class="report-title">Reporte Financiero</p>
                    <p>Período: ${startDate} al ${endDate}</p>
                    <p>Agrupado por: ${groupByText}</p>
                    <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
                </div>
            </div>
            
            <div class="report-content">
                <!-- Tarjetas de resumen con doble moneda -->
                <div class="summary-cards">
                    <div class="card card-success">
                        <div class="card-title">Total Ingresos</div>
                        <div class="card-value">${this.formatCurrency(totals.totalIncome)}</div>
                        <div class="dual-currency">
                            <span class="base">💰 ${baseCurrency}: ${this.formatNumber(totals.totalIncome)}</span><br>
                            <span class="default">💵 ${defaultCurrency}: ${this.formatNumber(totals.totalIncome / 36.50)}</span>
                        </div>
                    </div>
                    <div class="card card-danger">
                        <div class="card-title">Total Egresos</div>
                        <div class="card-value">${this.formatCurrency(totals.totalExpense)}</div>
                        <div class="dual-currency">
                            <span class="base">💰 ${baseCurrency}: ${this.formatNumber(totals.totalExpense)}</span><br>
                            <span class="default">💵 ${defaultCurrency}: ${this.formatNumber(totals.totalExpense / 36.50)}</span>
                        </div>
                    </div>
                    <div class="card ${totals.totalBalance >= 0 ? 'card-primary' : 'card-warning'}">
                        <div class="card-title">Balance Neto</div>
                        <div class="card-value">${this.formatCurrency(totals.totalBalance)}</div>
                        <div class="dual-currency">
                            <span class="base">💰 ${baseCurrency}: ${this.formatNumber(totals.totalBalance)}</span><br>
                            <span class="default">💵 ${defaultCurrency}: ${this.formatNumber(totals.totalBalance / 36.50)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Gráfica de tendencia -->
                <div class="chart-container">
                    <h3>📈 Evolución de Ingresos vs Egresos</h3>
                    <canvas id="trendChart" height="100"></canvas>
                </div>
                
                <!-- Tabla Resumen por Período (Ingresos vs Egresos) -->
                <div class="section-title">📊 Resumen de Ingresos y Egresos por Período</div>
                <table class="summary-table" style="width: 100%; margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th>Período</th>
                            <th>Ingresos (${baseCurrency})</th>
                            <th>Ingresos (${defaultCurrency})</th>
                            <th>Egresos (${baseCurrency})</th>
                            <th>Egresos (${defaultCurrency})</th>
                            <th>Balance (${baseCurrency})</th>
                            <th>Balance (${defaultCurrency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlySummary.map(month => {
                const ingresosUSD = month.totalIncome / 36.50;
                const egresosUSD = month.totalExpense / 36.50;
                const balance = month.totalIncome - month.totalExpense;
                const balanceUSD = balance / 36.50;
                return `
                            <tr>
                                <td><strong>${month.period}</strong></td>
                                <td class="text-right">${this.formatNumber(month.totalIncome)}</td>
                                <td class="text-right">${this.formatNumber(ingresosUSD)}</td>
                                <td class="text-right">${this.formatNumber(month.totalExpense)}</td>
                                <td class="text-right">${this.formatNumber(egresosUSD)}</td>
                                <td class="text-right ${balance >= 0 ? 'profit-positive' : 'profit-negative'}">
                                    ${this.formatNumber(balance)}
                                </td>
                                <td class="text-right ${balanceUSD >= 0 ? 'profit-positive' : 'profit-negative'}">
                                    ${this.formatNumber(balanceUSD)}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                    <tfoot style="background: #f8f9fa; font-weight: bold;">
                        <tr>
                            <td><strong>TOTAL GENERAL</strong></td>
                            <td class="text-right">${this.formatNumber(totals.totalIncome)}</td>
                            <td class="text-right">${this.formatNumber(totals.totalIncome / 36.50)}</td>
                            <td class="text-right">${this.formatNumber(totals.totalExpense)}</td>
                            <td class="text-right">${this.formatNumber(totals.totalExpense / 36.50)}</td>
                            <td class="text-right ${totals.totalBalance >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${this.formatNumber(totals.totalBalance)}
                            </td>
                            <td class="text-right ${totals.totalBalance >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${this.formatNumber(totals.totalBalance / 36.50)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Gráfica de Ganancias/Pérdidas -->
                <div class="chart-container">
                    <h3>📊 Evolución de Ganancias / Pérdidas por Período</h3>
                    <canvas id="profitLossChart" height="80"></canvas>
                </div>
                
                <!-- Detalle por período (ingresos y egresos por categoría) -->
                <div class="section-title">📋 Detalle de Transacciones por Período</div>
                ${reportData.map(period => this.generatePeriodHTML(period, groupBy, accounts)).join('')}
                
                <!-- Saldos Bancarios -->
                <div class="section-title">🏦 Saldos Bancarios Actuales</div>
                <div class="bank-balances-container">
                    ${bankBalances && bankBalances.length > 0 ? `
                    <table class="bank-balances-table">
                        <thead>
                            <tr>
                                <th>Banco</th>
                                <th>Número de Cuenta</th>
                                <th>Tipo</th>
                                <th>Moneda</th>
                                <th>Saldo Actual (${baseCurrency})</th>
                                <th>Saldo Actual (${defaultCurrency})*</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bankBalances.map(bank => {
                    const saldoUSD = bank.current_balance / 36.50;
                    return `
                                <tr>
                                    <td>${this.escapeHtml(bank.bank_name)}</td>
                                    <td>${bank.account_number}</td>
                                    <td>${this.getAccountTypeLabel(bank.account_type)}</td>
                                    <td>${bank.currency_code || baseCurrency}</td>
                                    <td class="text-right">${this.formatNumber(bank.current_balance)}</td>
                                    <td class="text-right">${this.formatNumber(saldoUSD)}</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                        <tfoot style="background: #e9ecef; font-weight: bold;">
                            <tr>
                                <td colspan="4"><strong>TOTAL SALDOS</strong></td>
                                <td class="text-right">${this.formatNumber(bankBalances.reduce((sum, b) => sum + b.current_balance, 0))}</td>
                                <td class="text-right">${this.formatNumber(bankBalances.reduce((sum, b) => sum + (b.current_balance / 36.50), 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div class="dual-currency" style="margin-top: 10px; font-size: 10px;">
                        * Conversión realizada utilizando tasa de cambio referencial del día (${baseCurrency} 1 = ${defaultCurrency} ${(1 / 36.50).toFixed(4)})
                    </div>
                    ` : `
                    <div class="alert alert-info">No hay cuentas bancarias configuradas o activas.</div>
                    `}
                </div>
                
                <div class="footer">
                    <p>Este reporte fue generado automáticamente por el Sistema de Flujo de Caja</p>
                    <p>© ${new Date().getFullYear()} - Todos los derechos reservados</p>
                </div>
            </div>
            
            <script>
                window.addEventListener('load', function() {
                    // Header fijo para impresión
                    const header = document.getElementById('repeatingHeader');
                    if (header) {
                        const style = document.createElement('style');
                        style.textContent = \`
                            @media print {
                                .pdf-header {
                                    position: fixed;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    background: white;
                                    z-index: 1000;
                                }
                                body {
                                    margin-top: 120px;
                                }
                            }
                        \`;
                        document.head.appendChild(style);
                    }
                    
                    // Gráfica de tendencia
                    const ctx = document.getElementById('trendChart').getContext('2d');
                    const groupBy = '${groupBy}';
                    const data = ${JSON.stringify(reportData)};
                    
                    let labels = [];
                    let incomeData = [];
                    let expenseData = [];
                    
                    if (groupBy === 'year') {
                        labels = data.map(d => d.year);
                        incomeData = data.map(d => d.totalIncome);
                        expenseData = data.map(d => d.totalExpense);
                    } else if (groupBy === 'month') {
                        labels = data.map(d => d.monthName.substring(0, 3) + ' ' + d.year);
                        incomeData = data.map(d => d.totalIncome);
                        expenseData = data.map(d => d.totalExpense);
                    } else {
                        labels = data.map(d => d.quarterName + ' ' + d.year);
                        incomeData = data.map(d => d.totalIncome);
                        expenseData = data.map(d => d.totalExpense);
                    }
                    
                    new Chart(ctx, {
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
                                        label: function(context) {
                                            return context.dataset.label + ': ' + new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(context.raw);
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: function(value) {
                                            return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
                                        }
                                    }
                                }
                            }
                        }
                    });
                    
                    // Gráfica de Ganancias/Pérdidas
                    const profitLossCtx = document.getElementById('profitLossChart').getContext('2d');
                    const monthlyData = ${JSON.stringify(monthlyProfitLoss)};
                    const profitLossLabels = monthlyData.map(m => m.period);
                    const profitLossData = monthlyData.map(m => m.profitLoss);
                    
                    new Chart(profitLossCtx, {
                        type: 'bar',
                        data: {
                            labels: profitLossLabels,
                            datasets: [{
                                label: 'Ganancia / Pérdida',
                                data: profitLossData,
                                backgroundColor: profitLossData.map(value => 
                                    value >= 0 ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)'
                                ),
                                borderColor: profitLossData.map(value => 
                                    value >= 0 ? '#28a745' : '#dc3545'
                                ),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            const value = context.raw;
                                            const prefix = value >= 0 ? '💰 Ganancia: ' : '⚠️ Pérdida: ';
                                            return prefix + new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(Math.abs(value));
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: false,
                                    ticks: {
                                        callback: function(value) {
                                            return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
                                        }
                                    }
                                }
                            }
                        }
                    });
                });
            <\/script>
        </div>
    </body>
    </html>
    `;
    },

    /**
     * Generar HTML para un período específico
     */
    generatePeriodHTML(period, groupBy, accounts) {
        const periodTitle = groupBy === 'year' ? `Año ${period.year}` :
            (groupBy === 'month' ? `${period.monthName} ${period.year}` :
                `${period.quarterName} ${period.year}`);

        const balance = period.totalIncome - period.totalExpense;

        // Función para agrupar por categoría
        const getGroupedByCategory = (accountsByAccount) => {
            const grouped = {};
            for (const [accountName, amount] of Object.entries(accountsByAccount)) {
                const accountInfo = accounts.find(a => a.name === accountName);
                const category = accountInfo?.category || 'Otros';
                if (!grouped[category]) {
                    grouped[category] = { total: 0, accounts: [] };
                }
                grouped[category].total += amount;
                grouped[category].accounts.push({ name: accountName, amount });
            }
            return grouped;
        };

        const incomeGrouped = getGroupedByCategory(period.incomeByAccount);
        const expenseGrouped = getGroupedByCategory(period.expenseByAccount);

        const renderCategorySection = (groupedData, total) => {
            const sortedCategories = Object.keys(groupedData).sort((a, b) => groupedData[b].total - groupedData[a].total);

            if (sortedCategories.length === 0) {
                return '<div class="empty-message">No hay registros</div>';
            }

            let html = '';
            for (const category of sortedCategories) {
                const categoryData = groupedData[category];
                const categoryPercent = total > 0 ? ((categoryData.total / total) * 100).toFixed(1) : 0;

                html += `
                <div class="category-group">
                    <div class="category-header">
                        <span><strong>${this.escapeHtml(category)}</strong> <span class="percent-badge">${categoryPercent}%</span></span>
                        <span><strong>${this.formatCurrency(categoryData.total)}</strong></span>
                    </div>
                    <div class="category-accounts">
                        ${categoryData.accounts
                        .sort((a, b) => b.amount - a.amount)
                        .map(acc => {
                            const accPercent = total > 0 ? ((acc.amount / total) * 100).toFixed(1) : 0;
                            return `
                                    <div class="account-row">
                                        <span>${this.escapeHtml(acc.name)}</span>
                                        <span>${this.formatCurrency(acc.amount)} (${accPercent}%)</span>
                                    </div>
                                `;
                        }).join('')}
                    </div>
                </div>
            `;
            }
            return html;
        };

        return `
        <div class="period-section">
            <div class="period-header">
                <h2>📅 ${periodTitle}</h2>
                <div class="period-summary">
                    Ingresos: ${this.formatCurrency(period.totalIncome)} | 
                    Egresos: ${this.formatCurrency(period.totalExpense)} | 
                    Balance: ${this.formatCurrency(balance)}
                </div>
            </div>
            <div class="period-content">
                <div class="income-section">
                    <h3 class="income-title">📈 INGRESOS</h3>
                    ${renderCategorySection(incomeGrouped, period.totalIncome)}
                    <div class="section-total">Total Ingresos: ${this.formatCurrency(period.totalIncome)}</div>
                </div>
                <div class="expense-section">
                    <h3 class="expense-title">📉 EGRESOS</h3>
                    ${renderCategorySection(expenseGrouped, period.totalExpense)}
                    <div class="section-total">Total Egresos: ${this.formatCurrency(period.totalExpense)}</div>
                </div>
            </div>
        </div>
    `;
    },

    /**
     * Estilos para el reporte financiero
     */
    getFinancialReportStyles() {
        return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @media print {
            body { 
                margin: 0; 
                padding: 0; 
                margin-top: 100px !important;
            }
            .no-print { display: none; }
            .period-section, .chart-container { page-break-inside: avoid; }
            
            /* ✅ Asegurar que el header se repite en cada página */
            .pdf-header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: white;
                z-index: 1000;
                border-bottom: 2px solid #007bff;
            }
            
            .report-content {
                margin-top: 100px;
            }
        }
        
        @media screen {
            body { background: #f0f2f5; padding: 20px; }
            .report-container { 
                max-width: 1200px; 
                margin: 0 auto; 
                background: white; 
                box-shadow: 0 0 20px rgba(0,0,0,0.1); 
                border-radius: 8px;
            }
            .print-button { 
                position: fixed; 
                bottom: 20px; 
                right: 20px; 
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                cursor: pointer; 
                font-size: 18px; 
                font-weight: bold; 
                z-index: 1000; 
            }
            .print-button:hover { background: #0056b3; }
        }
        
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; }
        
        /* ✅ Estilos del header fijo */
        .pdf-header {
            display: grid;
            grid-template-columns: 10% 60% 20%;
            gap: 15px;
            align-items: center;
            padding: 12px 20px;
            background: white;
            border-bottom: 3px solid #007bff;
            margin-bottom: 20px;
        }
        
        .header-logo {
            text-align: center;
            padding: 5px;
        }
        
        .header-logo img {
            max-width: 100px;
            max-height: 85px;
            object-fit: contain;
        }
        
        .default-logo {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #007bff, #0056b3);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 22px;
            font-weight: bold;
            margin: 0 auto;
        }
        
        .header-company {
            text-align: left;
        }
        
        .header-company h1 {
            font-size: 18px;
            margin: 0 0 5px 0;
            color: #007bff;
        }
        
        .header-company .company-name {
            font-size: 13px;
            font-weight: bold;
            margin: 0;
            color: #333;
        }
        
        .header-company .business-name {
            font-size: 10px;
            color: #6c757d;
            margin: 3px 0;
        }
        
        .header-company .tax-id {
            font-size: 10px;
            color: #6c757d;
            margin: 2px 0;
        }
        
        .header-dates {
            text-align: right;
            font-size: 10px;
            color: #495057;
        }
        
        .header-dates p {
            margin: 3px 0;
        }
        
        .header-dates .report-title {
            font-weight: bold;
            font-size: 18px;
            color: #007bff;
            margin-bottom: 5px;
        }
        
        /* Resto de los estilos existentes */
        .summary-cards { display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap; }
        .card { flex: 1; min-width: 150px; padding: 15px; border-radius: 8px; text-align: center; color: white; }
        .card-success { background: #28a745; }
        .card-danger { background: #dc3545; }
        .card-primary { background: #007bff; }
        .card-warning { background: #ffc107; color: #333; }
        .card-title { font-size: 18px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; }
        .card-value { font-size: 18px; font-weight: bold; }
        .chart-container { margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .chart-container h3 { margin-bottom: 15px; color: #333; font-size: 18px; }
        .period-section { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
        .period-header { background: #343a40; color: white; padding: 12px 15px; }
        .period-header h2 { margin: 0 0 5px; font-size: 18px; }
        .period-summary { font-size: 18px; opacity: 0.8; }
        .period-content { display: flex; flex-wrap: wrap; }
        .income-section, .expense-section { flex: 1; min-width: 250px; padding: 15px; }
        .income-section { border-right: 1px solid #dee2e6; }
        .expense-section { border-left: 1px solid #dee2e6; }
        .income-title { color: #28a745; font-size: 18px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 2px solid #28a745; }
        .expense-title { color: #dc3545; font-size: 18px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 2px solid #dc3545; }
        .category-group { margin-bottom: 12px; }
        .category-header { background: #f8f9fa; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 18px; }
        .percent-badge { background: #e9ecef; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-left: 5px; }
        .category-accounts { padding-left: 15px; margin-top: 5px; }
        .account-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px; border-bottom: 1px dashed #e9ecef; }
        .section-total { margin-top: 15px; padding-top: 10px; text-align: right; font-weight: bold; font-size: 12px; border-top: 2px solid #dee2e6; }
        .empty-message { text-align: center; color: #6c757d; padding: 20px; font-style: italic; }
        .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 9px; color: #6c757d; }
    `;
    },

    /**
     * Agrupar primero por empresa, luego por período
     */
    groupByCompanyThenPeriod(transactions, groupBy) {
        const companiesMap = new Map();

        transactions.forEach(transaction => {
            const companyId = transaction.company_id;
            const companyName = transaction.company_name || 'Sin empresa';

            if (!companiesMap.has(companyId)) {
                companiesMap.set(companyId, {
                    company_id: companyId,
                    company_name: companyName,
                    items: [],
                    total_general: 0
                });
            }

            const company = companiesMap.get(companyId);
            company.items.push(transaction);
            company.total_general += parseFloat(transaction.amount_base_currency || transaction.amount);
        });

        const result = [];

        for (const company of companiesMap.values()) {
            const periodGroups = this.groupByPeriod(company.items, groupBy);

            result.push({
                type: 'company',
                company_id: company.company_id,
                company_name: company.company_name,
                total_general: company.total_general,
                periods: periodGroups,
                total_items: company.items.length
            });
        }

        result.sort((a, b) => a.company_name.localeCompare(b.company_name));

        return result;
    },

    /**
     * Agrupar solo por período (sin empresa)
     */
    groupByPeriod(transactions, groupBy) {
        const groups = new Map();
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            let key, label;

            switch (groupBy) {
                case 'week':
                    const weekNumber = this.getWeekNumber(date);
                    const year = date.getFullYear();
                    key = `${year}-W${weekNumber}`;
                    label = `Semana ${weekNumber} (${year})`;
                    break;
                case 'month':
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    key = `${date.getFullYear()}-${date.getMonth() + 1}`;
                    label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    break;
                case 'quarter':
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    key = `${date.getFullYear()}-Q${quarter}`;
                    label = `${this.getQuarterName(quarter)} ${date.getFullYear()}`;
                    break;
                case 'semester':
                    const semester = date.getMonth() < 6 ? 1 : 2;
                    key = `${date.getFullYear()}-S${semester}`;
                    label = `${semester === 1 ? '1er' : '2do'} Semestre ${date.getFullYear()}`;
                    break;
                case 'year':
                    key = `${date.getFullYear()}`;
                    label = `Año ${date.getFullYear()}`;
                    break;
                default:
                    key = `${date.getFullYear()}-${date.getMonth() + 1}`;
                    label = `${date.toLocaleString('es', { month: 'long', year: 'numeric' })}`;
            }

            if (!groups.has(key)) {
                groups.set(key, {
                    label: label,
                    key: key,
                    items: [],
                    total: 0
                });
            }

            const group = groups.get(key);
            group.items.push(transaction);
            group.total += parseFloat(transaction.amount_base_currency || transaction.amount);
        });

        return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
    },

    /**
     * Generar HTML del reporte
     */
    generateReportHTML(groupedData, filters, groupBy, isSuperAdmin, showAllCompanies, includeDetailedTables, type, theme) {
        const isGroupedByCompany = showAllCompanies && isSuperAdmin && groupedData.length > 0 && groupedData[0].type === 'company';

        let totalGeneral = 0;
        let totalTransacciones = 0;

        if (isGroupedByCompany) {
            totalGeneral = groupedData.reduce((sum, company) => sum + company.total_general, 0);
            totalTransacciones = groupedData.reduce((sum, company) => sum + company.total_items, 0);
        } else {
            totalGeneral = groupedData.reduce((sum, group) => sum + group.total, 0);
            totalTransacciones = groupedData.reduce((sum, group) => sum + group.items.length, 0);
        }

        const chartData = this.prepareChartData(groupedData, isGroupedByCompany);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${theme.title} - Sistema de Flujo de Caja</title>
                <meta charset="UTF-8">
                <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                <style>
                    ${this.getStyles(theme)}
                </style>
            </head>
            <body>
                <div class="report-container">
                    <button class="print-button no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
                    
                    <div class="header">
                        <h1>${theme.icon} ${theme.title}</h1>
                        <div class="subtitle">Sistema de Flujo de Caja</div>
                        <div class="subtitle">Generado: ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' })}</div>
                    </div>
                    
                    <div class="filters-info">
                        <strong>📌 Filtros aplicados:</strong> ${this.getFilterText(filters)}<br>
                        <strong>📂 Agrupado por:</strong> ${this.getGroupByText(groupBy)}${isGroupedByCompany ? ' (por empresa y luego por período)' : ''}<br>
                        <strong>📋 Formato:</strong> ${includeDetailedTables ? 'Reporte completo (tablas detalladas + resumen + gráficos)' : 'Reporte ejecutivo (solo resumen + gráficos)'}
                    </div>
                    
                    ${includeDetailedTables ? (isGroupedByCompany ? this.generateCompanyGroupedHTML(groupedData, groupBy, theme) : this.generateSimpleGroupedHTML(groupedData, groupBy, theme)) : `<div class="alert-info" style="background: ${theme.primaryLight}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;"><i class="bi bi-info-circle"></i> Las tablas detalladas fueron omitidas por preferencia del usuario. Se muestra solo el resumen ejecutivo y gráficos.</div>`}
                    
                    <div class="summary">
                        <h3>📈 RESUMEN EJECUTIVO</h3>
                        ${isGroupedByCompany ? this.generateCompanySummaryHTML(groupedData, totalGeneral, totalTransacciones, theme) : this.generateSimpleSummaryHTML(groupedData, totalGeneral, totalTransacciones, theme)}
                    </div>
                    
                    <div class="charts-dashboard">
                        ${this.generateChartsHTML(chartData, isGroupedByCompany, groupBy, theme)}
                    </div>
                    
                    <div class="total-general">
                        💵 Total General de ${type === 'expense' ? 'Egresos' : 'Ingresos'}: ${this.formatCurrency(totalGeneral)}
                    </div>
                    
                    <div class="footer">
                        <p>Este reporte fue generado automáticamente por el Sistema de Flujo de Caja</p>
                        <p>© ${new Date().getFullYear()} - Todos los derechos reservados</p>
                    </div>
                </div>
                
                <script>
                    window.addEventListener('load', function() {
                        ${this.generateChartInitializationScript(chartData, isGroupedByCompany, theme)}
                    });
                <\/script>
            </body>
            </html>
        `;
    },

    /**
     * Estilos CSS dinámicos según tema
     */
    getStyles(theme) {
        return `
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @media print {
                body { margin: 0; padding: 0.5cm; }
                .page-break { page-break-before: always; }
                .no-break, .company-section, .period-section, .group-section { page-break-inside: avoid; }
                button, .no-print { display: none; }
                canvas { max-width: 100%; height: auto; }
            }
            @media screen {
                body { margin: 0; padding: 20px; background: #f0f2f5; }
                .report-container { max-width: 1200px; margin: 0 auto; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
                .print-button { position: fixed; bottom: 20px; right: 20px; background: ${theme.primary}; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 1000; }
                .print-button:hover { background: ${theme.primaryDark}; }
            }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; }
            .report-container { background: white; padding: 20px; }
            .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid ${theme.primary}; }
            .header h1 { color: ${theme.primary}; font-size: 24px; margin: 0 0 8px 0; }
            .header .subtitle { color: #6c757d; font-size: 18px; }
            .filters-info { background: #f8f9fa; padding: 12px; margin-bottom: 20px; border-radius: 6px; border-left: 4px solid ${theme.primary}; font-size: 18px; }
            .filters-info strong { color: ${theme.primary}; }
            .alert-info { background: ${theme.primaryLight}; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0; }
            .charts-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
            .chart-card { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .chart-card h4 { color: #495057; font-size: 18px; margin-bottom: 15px; text-align: center; padding-bottom: 8px; border-bottom: 2px solid ${theme.primary}; }
            .chart-container { position: relative; height: 300px; }
            canvas { max-height: 280px; width: 100%; }
            .company-section { margin-bottom: 35px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
            .company-header { background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%); color: white; padding: 12px 15px; }
            .company-header h2 { margin: 0; font-size: 18px; }
            .company-header .company-total { font-size: 13px; margin-top: 5px; opacity: 0.9; }
            .period-section { margin: 0; border-bottom: 1px solid #e9ecef; }
            .period-section:last-child { border-bottom: none; }
            .period-title { background: #f8f9fa; padding: 10px 15px; border-left: 4px solid ${theme.primary}; margin: 0; }
            .period-title h3 { margin: 0; font-size: 18px; color: #495057; }
            .period-total { font-size: 12px; font-weight: bold; margin: 8px 15px 12px 15px; color: ${theme.primary}; text-align: right; }
            .group-section { margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
            .group-title { background: ${theme.primary}; color: white; padding: 10px 15px; margin: 20px 0 10px 0; border-radius: 6px; }
            .group-title h3 { margin: 0; font-size: 15px; }
            .group-total { font-size: 13px; font-weight: bold; margin: 8px 0 12px 0; color: ${theme.primary}; text-align: right; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #343a40; color: white; padding: 8px 6px; text-align: left; border: 1px solid #454d55; }
            td { padding: 6px; border: 1px solid #dee2e6; }
            tr:nth-child(even) { background: #f8f9fa; }
            .summary { margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 6px; break-inside: avoid; page-break-inside: avoid; }
            .summary h3 { margin: 0 0 15px 0; color: ${theme.primary}; font-size: 18px; }
            .summary-table { width: 100%; margin-top: 10px; }
            .summary-table th { background: #6c757d; }
            .total-general { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; padding-top: 10px; border-top: 2px solid ${theme.primary}; }
            .footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #dee2e6; font-size: 9px; color: #6c757d; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 3px; }
            .badge-bank { background: #6c757d; color: white; }
            .badge-cash-expense { background: #dc3545; color: white; }
            .badge-cash-income { background: #28a745; color: white; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
        `;
    },

    /**
     * Generar HTML para agrupación por empresa
     */
    generateCompanyGroupedHTML(groupedData, groupBy, theme) {
        return groupedData.map(company => `
            <div class="company-section">
                <div class="company-header">
                    <h2>🏢 ${this.escapeHtml(company.company_name)}</h2>
                    <div class="company-total">
                        Total general: ${this.formatCurrency(company.total_general)} | 
                        Transacciones: ${company.total_items}
                    </div>
                </div>
                
                ${company.periods.map(period => `
                    <div class="period-section">
                        <div class="period-title">
                            <h3>📅 ${period.label}</h3>
                        </div>
                        <div class="period-total">
                            Subtotal del período: ${this.formatCurrency(period.total)}
                        </div>
                        <table class="company-table">
                            <thead>
                                <tr>
                                    <th width="5%">ID</th>
                                    <th width="10%">Fecha</th>
                                    <th width="15%">Cuenta</th>
                                    <th width="8%">Origen</th>
                                    <th width="7%">Moneda</th>
                                    <th width="15%">Monto Original</th>
                                    <th width="15%">Monto (Base)</th>
                                    <th width="25%">Descripción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${period.items.map(transaction => `
                                    <tr>
                                        <td class="text-center">${transaction.id}</td>
                                        <td class="text-center">${this.formatDate(transaction.date)}</td>
                                        <td>${this.truncate(transaction.account_name || '-', 25)}</td>
                                        <td class="text-center">
                                            <span class="badge ${transaction.payment_method === 'bank' ? 'badge-bank' : `badge-cash-${theme.primary === '#dc3545' ? 'expense' : 'income'}`}">
                                                ${transaction.payment_method === 'bank' ? '🏦 Banco' : '💵 Efectivo'}
                                            </span>
                                        </td>
                                        <td class="text-center">${transaction.currency_code || 'VES'}</td>
                                        <td class="text-right">${this.formatNumber(transaction.amount)} ${transaction.currency_code || 'VES'}</td>
                                        <td class="text-right">${this.formatCurrency(transaction.amount_base_currency || transaction.amount)}</td>
                                        <td>${this.truncate(transaction.description || '-', 50)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        `).join('');
    },

    /**
     * Generar HTML para agrupación simple (solo período)
     */
    generateSimpleGroupedHTML(groupedData, groupBy, theme) {
        return groupedData.map(group => `
            <div class="group-section">
                <div class="group-title">
                    <h3>📅 ${group.label}</h3>
                </div>
                <div class="group-total">
                    💰 Total del período: ${this.formatCurrency(group.total)}
                    <span style="margin-left: 15px; font-size: 18px; color: #6c757d;">
                        (${group.items.length} transacciones)
                    </span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th width="5%">ID</th>
                            <th width="10%">Fecha</th>
                            <th width="15%">Cuenta</th>
                            <th width="8%">Origen</th>
                            <th width="7%">Moneda</th>
                            <th width="15%">Monto Original</th>
                            <th width="15%">Monto (Base)</th>
                            <th width="25%">Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.items.map(transaction => `
                            <tr>
                                <td class="text-center">${transaction.id}</td>
                                <td class="text-center">${this.formatDate(transaction.date)}</td>
                                <td>${this.truncate(transaction.account_name || '-', 25)}</td>
                                <td class="text-center">
                                    <span class="badge ${transaction.payment_method === 'bank' ? 'badge-bank' : `badge-cash-${theme.primary === '#dc3545' ? 'expense' : 'income'}`}">
                                        ${transaction.payment_method === 'bank' ? '🏦 Banco' : '💵 Efectivo'}
                                    </span>
                                </td>
                                <td class="text-center">${transaction.currency_code || 'VES'}</td>
                                <td class="text-right">${this.formatNumber(transaction.amount)} ${transaction.currency_code || 'VES'}</td>
                                <td class="text-right">${this.formatCurrency(transaction.amount_base_currency || transaction.amount)}</td>
                                <td>${this.truncate(transaction.description || '-', 50)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    },

    /**
     * Generar resumen para agrupación por empresa
     */
    generateCompanySummaryHTML(groupedData, totalGeneral, totalTransacciones, theme) {
        return `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Empresa</th>
                        <th class="text-center">Períodos</th>
                        <th class="text-center">Transacciones</th>
                        <th class="text-right">Total</th>
                        <th class="text-center">Participación</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupedData.map(company => `
                        <tr>
                            <td><strong>${this.escapeHtml(company.company_name)}</strong></td>
                            <td class="text-center">${company.periods.length}</td>
                            <td class="text-center">${company.total_items}</td>
                            <td class="text-right">${this.formatCurrency(company.total_general)}</td>
                            <td class="text-center">
                                <div style="background: #e9ecef; border-radius: 10px; overflow: hidden; width: 80px; display: inline-block;">
                                    <div style="background: ${theme.primary}; width: ${(company.total_general / totalGeneral) * 100}%; height: 8px;"></div>
                                </div>
                                <span style="margin-left: 5px;">${((company.total_general / totalGeneral) * 100).toFixed(1)}%</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: ${theme.primary}; color: white; font-weight: bold;">
                        <td><strong>TOTAL GENERAL</strong></td>
                        <td class="text-center"><strong>${groupedData.reduce((sum, c) => sum + c.periods.length, 0)}</strong></td>
                        <td class="text-center"><strong>${totalTransacciones}</strong></td>
                        <td class="text-right"><strong>${this.formatCurrency(totalGeneral)}</strong></td>
                        <td class="text-center"><strong>100%</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    },

    /**
     * Generar resumen para agrupación simple
     */
    generateSimpleSummaryHTML(groupedData, totalGeneral, totalTransacciones, theme) {
        return `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Período</th>
                        <th class="text-center">Transacciones</th>
                        <th class="text-right">Total</th>
                        <th class="text-center">Participación</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupedData.map(group => `
                        <tr>
                            <td>${group.label}</td>
                            <td class="text-center">${group.items.length}</td>
                            <td class="text-right">${this.formatCurrency(group.total)}</td>
                            <td class="text-center">
                                <div style="background: #e9ecef; border-radius: 10px; overflow: hidden; width: 80px; display: inline-block;">
                                    <div style="background: ${theme.primary}; width: ${(group.total / totalGeneral) * 100}%; height: 8px;"></div>
                                </div>
                                <span style="margin-left: 5px;">${((group.total / totalGeneral) * 100).toFixed(1)}%</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: ${theme.primary}; color: white; font-weight: bold;">
                        <td><strong>TOTAL GENERAL</strong></td>
                        <td class="text-center"><strong>${totalTransacciones}</strong></td>
                        <td class="text-right"><strong>${this.formatCurrency(totalGeneral)}</strong></td>
                        <td class="text-center"><strong>100%</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
    },

    /**
     * Calcular resumen mensual de ingresos y egresos
     */
    calculateMonthlySummary(reportData, groupBy) {
        if (groupBy !== 'month') {
            // Si no está agrupado por mes, reorganizar los datos
            const monthlyData = new Map();

            reportData.forEach(period => {
                if (period.month && period.year) {
                    const key = `${period.year}-${period.month}`;
                    const monthName = period.monthName;

                    if (!monthlyData.has(key)) {
                        monthlyData.set(key, {
                            period: monthName,
                            year: period.year,
                            month: period.month,
                            totalIncome: 0,
                            totalExpense: 0
                        });
                    }
                    const month = monthlyData.get(key);
                    month.totalIncome += period.totalIncome;
                    month.totalExpense += period.totalExpense;
                } else if (period.quarter) {
                    // Si está agrupado por trimestre, distribuir proporcionalmente
                    // Por simplicidad, mostrar como trimestre
                    monthlyData.set(`${period.year}-Q${period.quarter}`, {
                        period: period.quarterName,
                        year: period.year,
                        totalIncome: period.totalIncome,
                        totalExpense: period.totalExpense
                    });
                } else if (period.year) {
                    // Si está agrupado por año, mostrar como año
                    monthlyData.set(`${period.year}`, {
                        period: `Año ${period.year}`,
                        year: period.year,
                        totalIncome: period.totalIncome,
                        totalExpense: period.totalExpense
                    });
                }
            });

            return Array.from(monthlyData.values()).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                if (a.month && b.month) return a.month - b.month;
                return 0;
            });
        }

        // Ya está agrupado por mes
        return reportData.map(month => ({
            period: month.monthName,
            year: month.year,
            month: month.month,
            totalIncome: month.totalIncome,
            totalExpense: month.totalExpense
        }));
    },

    /**
     * Preparar datos para gráficos
     */
    prepareChartData(groupedData, isGroupedByCompany) {
        if (isGroupedByCompany) {
            const companies = groupedData.map(c => c.company_name);
            const totals = groupedData.map(c => c.total_general);
            const colors = this.generateColors(companies.length);

            const top5 = groupedData.slice(0, 5);
            const pieLabels = top5.map(c => c.company_name);
            const pieData = top5.map(c => c.total_general);
            if (groupedData.length > 5) {
                const otherTotal = groupedData.slice(5).reduce((sum, c) => sum + c.total_general, 0);
                pieLabels.push('Otras');
                pieData.push(otherTotal);
            }

            return {
                type: 'company',
                barLabels: companies,
                barData: totals,
                barColors: colors,
                pieLabels: pieLabels,
                pieData: pieData,
                pieColors: this.generateColors(pieLabels.length)
            };
        } else {
            const labels = groupedData.map(g => g.label);
            const totals = groupedData.map(g => g.total);
            const transactions = groupedData.map(g => g.items.length);

            return {
                type: 'period',
                labels: labels,
                totals: totals,
                transactions: transactions,
                colors: this.generateColors(labels.length)
            };
        }
    },

    /**
     * Generar HTML de los gráficos
     */
    generateChartsHTML(chartData, isGroupedByCompany, groupBy, theme) {
        if (isGroupedByCompany) {
            return `
                <div class="chart-card">
                    <h4>📊 ${theme.title === 'REPORTE DE INGRESOS' ? 'Ingresos' : 'Egresos'} por Empresa</h4>
                    <div class="chart-container">
                        <canvas id="barChartCompanies"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h4>🥧 Distribución de ${theme.title === 'REPORTE DE INGRESOS' ? 'Ingresos' : 'Egresos'}</h4>
                    <div class="chart-container">
                        <canvas id="pieChartCompanies"></canvas>
                    </div>
                </div>
            `;
        } else {
            const groupByText = this.getGroupByTextLower(groupBy);
            return `
                <div class="chart-card">
                    <h4>📈 Tendencia de ${theme.title === 'REPORTE DE INGRESOS' ? 'Ingresos' : 'Egresos'} por ${groupByText}</h4>
                    <div class="chart-container">
                        <canvas id="lineChartPeriods"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h4>📊 Comparativa por ${groupByText}</h4>
                    <div class="chart-container">
                        <canvas id="barChartPeriods"></canvas>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Generar script de inicialización de gráficos
     */
    generateChartInitializationScript(chartData, isGroupedByCompany, theme) {
        const primaryColor = theme.primary;
        const secondaryColor = theme.primary === '#dc3545' ? '#17a2b8' : '#17a2b8';

        if (isGroupedByCompany) {
            return `
                const barCtx = document.getElementById('barChartCompanies').getContext('2d');
                new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(chartData.barLabels)},
                        datasets: [{
                            label: 'Total (USD)',
                            data: ${JSON.stringify(chartData.barData)},
                            backgroundColor: ${JSON.stringify(chartData.barColors)},
                            borderColor: '${primaryColor}',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return 'Total: ' + new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(context.raw);
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
                                    }
                                }
                            }
                        }
                    }
                });
                
                const pieCtx = document.getElementById('pieChartCompanies').getContext('2d');
                new Chart(pieCtx, {
                    type: 'pie',
                    data: {
                        labels: ${JSON.stringify(chartData.pieLabels)},
                        datasets: [{
                            data: ${JSON.stringify(chartData.pieData)},
                            backgroundColor: ${JSON.stringify(chartData.pieColors)},
                            borderWidth: 2,
                            borderColor: 'white'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'right' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.raw / total) * 100).toFixed(1);
                                        const amount = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(context.raw);
                                        return context.label + ': ' + amount + ' (' + percentage + '%)';
                                    }
                                }
                            }
                        }
                    }
                });
            `;
        } else {
            return `
                const lineCtx = document.getElementById('lineChartPeriods').getContext('2d');
                new Chart(lineCtx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(chartData.labels)},
                        datasets: [{
                            label: 'Total (USD)',
                            data: ${JSON.stringify(chartData.totals)},
                            borderColor: '${primaryColor}',
                            backgroundColor: '${primaryColor}20',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '${primaryColor}',
                            pointBorderColor: 'white',
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return 'Total: ' + new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(context.raw);
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
                                    }
                                }
                            }
                        }
                    }
                });
                
                const barCtx = document.getElementById('barChartPeriods').getContext('2d');
                new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(chartData.labels)},
                        datasets: [
                            {
                                label: 'Total (USD)',
                                data: ${JSON.stringify(chartData.totals)},
                                backgroundColor: '${primaryColor}80',
                                borderColor: '${primaryColor}',
                                borderWidth: 1,
                                yAxisID: 'y'
                            },
                            {
                                label: 'Número de Transacciones',
                                data: ${JSON.stringify(chartData.transactions)},
                                backgroundColor: '${secondaryColor}80',
                                borderColor: '${secondaryColor}',
                                borderWidth: 1,
                                type: 'line',
                                fill: false,
                                tension: 0.4,
                                pointBackgroundColor: '${secondaryColor}',
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        if (context.dataset.label === 'Total (USD)') {
                                            return 'Total: ' + new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(context.raw);
                                        } else {
                                            return 'Transacciones: ' + context.raw;
                                        }
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                position: 'left',
                                title: { display: true, text: 'Monto (USD)' },
                                ticks: {
                                    callback: function(value) {
                                        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value);
                                    }
                                }
                            },
                            y1: {
                                beginAtZero: true,
                                position: 'right',
                                title: { display: true, text: 'Número de Transacciones' },
                                grid: { drawOnChartArea: false }
                            }
                        }
                    }
                });
            `;
        }
    },

    /**
     * Generar colores para gráficos
     */
    generateColors(count) {
        const palette = [
            '#28a745', '#20c997', '#17a2b8', '#007bff', '#6610f2',
            '#6f42c1', '#e83e8c', '#dc3545', '#fd7e14', '#ffc107'
        ];
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(palette[i % palette.length]);
        }
        return colors;
    },

    /**
     * Obtener texto de los filtros
     */
    getFilterText(filters) {
        const parts = [];
        if (filters.company_name) parts.push(`Empresa: ${filters.company_name}`);
        if (filters.year) parts.push(`Año: ${filters.year}`);
        if (filters.month_name) parts.push(`Mes: ${filters.month_name}`);
        if (filters.account_name) parts.push(`Cuenta: ${filters.account_name}`);
        return parts.length > 0 ? parts.join(' | ') : 'Todos (sin filtros)';
    },

    /**
     * Obtener texto de la agrupación
     */
    getGroupByText(groupBy) {
        const texts = {
            'week': 'Semanas',
            'month': 'Meses',
            'quarter': 'Trimestres',
            'semester': 'Semestres',
            'year': 'Años'
        };
        return texts[groupBy] || 'Meses';
    },

    getGroupByTextLower(groupBy) {
        const texts = {
            'week': 'semana',
            'month': 'mes',
            'quarter': 'trimestre',
            'semester': 'semestre',
            'year': 'año'
        };
        return texts[groupBy] || 'período';
    },

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    getQuarterName(quarter) {
        const quarters = { 1: '1er Trimestre', 2: '2do Trimestre', 3: '3er Trimestre', 4: '4to Trimestre' };
        return quarters[quarter];
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    },

    formatNumber(amount) {
        return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },

    truncate(text, maxLength) {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },

    /**
    * Escapar HTML para prevenir XSS
    */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
 * Obtener etiqueta del tipo de cuenta
 */
    getAccountTypeLabel(type) {
        const labels = {
            'corriente': 'Corriente',
            'ahorros': 'Ahorros',
            'nomina': 'Nómina',
            'inversion': 'Inversión'
        };
        return labels[type] || type;
    },


};