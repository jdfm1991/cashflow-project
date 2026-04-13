
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
            
            switch(groupBy) {
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
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};