
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

    // Agregar este método al pdfExportService.js

    /**
     * Exportar reporte financiero a PDF
     * @param {Array} reportData - Datos del reporte (agrupados por período)
     * @param {Object} filters - Filtros aplicados { startDate, endDate, groupBy }
     * @param {Object} companyInfo - Información de la empresa { name, business_name, tax_id, logo }
     * @param {Array} accounts - Lista de cuentas para obtener categorías
     */
    exportFinancialReportToPDF(reportData, filters, companyInfo = null, companyLogo = null, accounts = []) {
        if (!reportData || reportData.length === 0) {
            console.warn('No hay datos para exportar');
            return;
        }

        const { startDate, endDate, groupBy } = filters;

        // ✅ Depuración: Ver qué está llegando
        console.log('=== PDF Export Debug ===');
        console.log('companyInfo recibido:', companyInfo);
        console.log('companyLogo recibido:', companyLogo);
        console.log('companyInfo type:', typeof companyInfo);
        console.log('companyInfo keys:', companyInfo ? Object.keys(companyInfo) : 'null');

        // ✅ Extraer datos de empresa con valores por defecto
        const companyName = companyInfo?.name || 'FlowControl';
        const businessName = companyInfo?.business_name || '';
        const taxId = companyInfo?.tax_id || '';
        const logo = companyLogo || null;

        console.log('Datos extraídos:', { companyName, businessName, taxId, logo });

        const totals = this.calculateTotals(reportData);
        const sortedData = [...reportData].sort((a, b) => {
            if (groupBy === 'year') return a.year - b.year;
            if (groupBy === 'month') return a.sortKey - b.sortKey;
            if (groupBy === 'quarter') return a.sortKey - b.sortKey;
            return 0;
        });

        const reportHtml = this.generateFinancialReportHTML(sortedData, {
            startDate,
            endDate,
            groupBy,
            companyName,
            businessName,
            taxId,
            logo,
            totals
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
        const { startDate, endDate, groupBy, companyName, businessName, taxId, logo, totals } = metadata;
        const groupByText = groupBy === 'year' ? 'Año' : (groupBy === 'month' ? 'Mes' : 'Trimestre');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte Financiero - ${this.escapeHtml(companyName)}</title>
            <meta charset="UTF-8">
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
            <style>
                ${this.getFinancialReportStyles()}
                
                /* ✅ Estilos para el header de 3 columnas que se repite */
                @media print {
                    thead { display: table-header-group; }
                    .page-break { page-break-before: always; }
                    .no-break { page-break-inside: avoid; }
                    
                    /* ✅ Estilo para que el header se repita en todas las páginas */
                    .repeating-header {
                        position: running(header);
                    }
                    
                    @page {
                        @top-center {
                            content: element(header);
                        }
                    }
                }
                
                /* ✅ Header con grid de 3 columnas */
                .pdf-header {
                    display: grid;
                    grid-template-columns: 10% 60% 20%;
                    gap: 15px;
                    align-items: center;
                    padding: 15px;
                    background: white;
                    border-bottom: 3px solid #007bff;
                    margin-bottom: 20px;
                }
                
                /* Para versión impresa */
                @media print {
                    .pdf-header {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        background: white;
                        z-index: 1000;
                        border-bottom: 2px solid #007bff;
                    }
                    
                    body {
                        margin-top: 120px;
                    }
                    
                    .report-container {
                        margin-top: 0;
                        padding-top: 0;
                    }
                }
                
                /* Para versión pantalla (vista previa) */
                @media screen {
                    .pdf-header {
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        background: white;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                }
                
                /* Columna del logo */
                .header-logo {
                    text-align: center;
                    padding: 5px;
                }
                
                .header-logo img {
                    max-width: 80px;
                    max-height: 60px;
                    object-fit: contain;
                }
                
                .default-logo {
                    width: 50px;
                    height: 50px;
                    background: #007bff;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    font-weight: bold;
                }
                
                /* Columna de información de empresa */
                .header-company {
                    text-align: left;
                }
                
                .header-company h1 {
                    font-size: 18px;
                    margin: 0 0 5px 0;
                    color: #007bff;
                }
                
                .header-company .company-name {
                    font-size: 14px;
                    font-weight: bold;
                    margin: 0;
                }
                
                .header-company .business-name {
                    font-size: 11px;
                    color: #6c757d;
                    margin: 2px 0;
                }
                
                .header-company .tax-id {
                    font-size: 10px;
                    color: #6c757d;
                    margin: 2px 0;
                }
                
                /* Columna de fechas */
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
                    font-size: 12px;
                    color: #007bff;
                }
                
                /* Ajuste del contenedor principal para el header fijo */
                .report-container {
                    padding-top: 0;
                }
                
                /* Espaciado para el contenido debajo del header fijo */
                .report-content {
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <!-- ✅ Header de 3 columnas que se repite -->
                <div class="pdf-header" id="repeatingHeader">
                    <!-- Columna 1: Logo (10%) -->
                    <div class="header-logo">
                        ${logo ?
                `<img src="${logo}" class="logo" alt="Logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                             <div class="default-logo" style="display: none;">FC</div>` :
                `<div class="default-logo">FC</div>`
            }
                    </div>
                    
                    <!-- Columna 2: Información de la empresa (70%) -->
                    <div class="header-company">
                        <h1>Reporte Flujo de Caja</h1>
                        <div class="company-name">${this.escapeHtml(companyName)}</div>
                        ${businessName ? `<div class="business-name">${this.escapeHtml(businessName)}</div>` : ''}
                        ${taxId ? `<div class="tax-id">RIF: ${this.escapeHtml(taxId)}</div>` : ''}
                    </div>
                    
                    <!-- Columna 3: Fechas y metadatos (20%) -->
                    <div class="header-dates">
                        <p class="report-title">Reporte Financiero</p>
                        <p>Período: ${startDate} al ${endDate}</p>
                        <p>Agrupado por: ${groupByText}</p>
                        <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
                    </div>
                </div>
                
                <!-- ✅ Contenido del reporte -->
                <div class="report-content">
                    <!-- Tarjetas de resumen -->
                    <div class="summary-cards">
                        <div class="card card-success">
                            <div class="card-title">Total Ingresos</div>
                            <div class="card-value">${this.formatCurrency(totals.totalIncome)}</div>
                        </div>
                        <div class="card card-danger">
                            <div class="card-title">Total Egresos</div>
                            <div class="card-value">${this.formatCurrency(totals.totalExpense)}</div>
                        </div>
                        <div class="card ${totals.totalBalance >= 0 ? 'card-primary' : 'card-warning'}">
                            <div class="card-title">Balance Neto</div>
                            <div class="card-value">${this.formatCurrency(totals.totalBalance)}</div>
                        </div>
                    </div>
                    
                    <!-- Gráfica de tendencia -->
                    <div class="chart-container">
                        <h3>📈 Evolución de Ingresos vs Egresos</h3>
                        <canvas id="trendChart" height="100"></canvas>
                    </div>
                    
                    <!-- Detalle por período -->
                    ${reportData.map(period => this.generatePeriodHTML(period, groupBy, accounts)).join('')}
                </div>
                
                <div class="footer">
                    <p>Este reporte fue generado automáticamente por el Sistema de Flujo de Caja</p>
                    <p>© ${new Date().getFullYear()} - Todos los derechos reservados</p>
                </div>
            </div>
            
            <script>
                // ✅ Script para manejar el header repetido en todas las páginas al imprimir
                window.addEventListener('load', function() {
                    // Clonar el header para que se repita en cada página impresa
                    const header = document.getElementById('repeatingHeader');
                    if (header) {
                        // Para impresión, asegurar que el header se mantiene visible
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
                                .report-content {
                                    margin-top: 0;
                                }
                            }
                        \`;
                        document.head.appendChild(style);
                    }
                    
                    // Renderizar gráfica
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
                });
            <\/script>
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
                font-size: 14px; 
                font-weight: bold; 
                z-index: 1000; 
            }
            .print-button:hover { background: #0056b3; }
        }
        
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; }
        
        /* ✅ Estilos del header fijo */
        .pdf-header {
            display: grid;
            grid-template-columns: 10% 70% 20%;
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
            max-width: 70px;
            max-height: 55px;
            object-fit: contain;
        }
        
        .default-logo {
            width: 50px;
            height: 50px;
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
            font-size: 11px;
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
        .card-title { font-size: 11px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; }
        .card-value { font-size: 20px; font-weight: bold; }
        .chart-container { margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .chart-container h3 { margin-bottom: 15px; color: #333; font-size: 14px; }
        .period-section { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
        .period-header { background: #343a40; color: white; padding: 12px 15px; }
        .period-header h2 { margin: 0 0 5px; font-size: 16px; }
        .period-summary { font-size: 11px; opacity: 0.8; }
        .period-content { display: flex; flex-wrap: wrap; }
        .income-section, .expense-section { flex: 1; min-width: 250px; padding: 15px; }
        .income-section { border-right: 1px solid #dee2e6; }
        .expense-section { border-left: 1px solid #dee2e6; }
        .income-title { color: #28a745; font-size: 14px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 2px solid #28a745; }
        .expense-title { color: #dc3545; font-size: 14px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 2px solid #dc3545; }
        .category-group { margin-bottom: 12px; }
        .category-header { background: #f8f9fa; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 11px; }
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
                .print-button { position: fixed; bottom: 20px; right: 20px; background: ${theme.primary}; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 1000; }
                .print-button:hover { background: ${theme.primaryDark}; }
            }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; }
            .report-container { background: white; padding: 20px; }
            .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid ${theme.primary}; }
            .header h1 { color: ${theme.primary}; font-size: 24px; margin: 0 0 8px 0; }
            .header .subtitle { color: #6c757d; font-size: 11px; }
            .filters-info { background: #f8f9fa; padding: 12px; margin-bottom: 20px; border-radius: 6px; border-left: 4px solid ${theme.primary}; font-size: 11px; }
            .filters-info strong { color: ${theme.primary}; }
            .alert-info { background: ${theme.primaryLight}; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0; }
            .charts-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 30px; break-inside: avoid; page-break-inside: avoid; }
            .chart-card { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .chart-card h4 { color: #495057; font-size: 14px; margin-bottom: 15px; text-align: center; padding-bottom: 8px; border-bottom: 2px solid ${theme.primary}; }
            .chart-container { position: relative; height: 300px; }
            canvas { max-height: 280px; width: 100%; }
            .company-section { margin-bottom: 35px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
            .company-header { background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%); color: white; padding: 12px 15px; }
            .company-header h2 { margin: 0; font-size: 16px; }
            .company-header .company-total { font-size: 13px; margin-top: 5px; opacity: 0.9; }
            .period-section { margin: 0; border-bottom: 1px solid #e9ecef; }
            .period-section:last-child { border-bottom: none; }
            .period-title { background: #f8f9fa; padding: 10px 15px; border-left: 4px solid ${theme.primary}; margin: 0; }
            .period-title h3 { margin: 0; font-size: 14px; color: #495057; }
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
            .summary h3 { margin: 0 0 15px 0; color: ${theme.primary}; font-size: 16px; }
            .summary-table { width: 100%; margin-top: 10px; }
            .summary-table th { background: #6c757d; }
            .total-general { font-size: 16px; font-weight: bold; text-align: right; margin-top: 20px; padding-top: 10px; border-top: 2px solid ${theme.primary}; }
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
                    <span style="margin-left: 15px; font-size: 11px; color: #6c757d;">
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
    }
};