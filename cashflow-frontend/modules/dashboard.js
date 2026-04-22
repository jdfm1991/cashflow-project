// modules/dashboard.js - Versión multi-empresa pública
import { api } from '../services/apiService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const dashboardModule = {
    chartInstance: null,
    categoryChartInstance: null,
    cashFlowChartInstance: null,
    companies: [],

    async render(container) {
        const user = api.getUser();
        const isAuthenticated = api.isAuthenticated();
        const isSuperAdmin = user?.role === 'super_admin';
        
        // Cargar empresas (siempre carga empresas públicas para el selector)
        await this.loadCompanies();
        
        // Si está autenticado y no es super_admin, cargar su empresa específica
        let defaultCompanyId = '';
        if (isAuthenticated && !isSuperAdmin && this.companies.length === 1) {
            defaultCompanyId = this.companies[0].id;
        }

        container.innerHTML = `            
            <!-- Selector de Empresa - SIEMPRE visible -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-building"></i> Seleccionar Empresa</h5>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-12">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-building"></i> Empresa a consultar
                            </label>
                            <div class="d-flex gap-3">
                                <select class="form-select" id="companySelect" style="max-width: 400px;">
                                    <option value="">-- Seleccione una empresa --</option>
                                    ${this.companies.map(c => `
                                        <option value="${c.id}" ${defaultCompanyId == c.id ? 'selected' : ''}>
                                            ${c.name} ${c.business_name ? `(${c.business_name})` : ''}
                                        </option>
                                    `).join('')}
                                </select>
                                <button class="btn btn-primary" id="applyFiltersBtn">
                                    <i class="bi bi-search"></i> Consultar
                                </button>
                            </div>
                            <small class="text-muted mt-2 d-block">
                                <i class="bi bi-info-circle"></i> 
                                ${isAuthenticated ? 
                                    (isSuperAdmin ? 'Como Super Administrador, puedes ver los datos de cualquier empresa.' : 
                                    'Estás viendo los datos de tu empresa.') : 
                                    'Modo público - Puedes ver los datos de cualquier empresa sin necesidad de iniciar sesión.'}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Filtros de fecha -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-secondary text-white">
                    <h5 class="mb-0"><i class="bi bi-calendar3"></i> Período de Análisis</h5>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Fecha desde</label>
                            <input type="date" id="startDate" class="form-control" value="${this.getDefaultStartDate()}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Fecha hasta</label>
                            <input type="date" id="endDate" class="form-control" value="${this.getDefaultEndDate()}">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label fw-semibold">Agrupar por</label>
                            <select class="form-select" id="groupBySelect">
                                <option value="month">Mensual</option>
                                <option value="week">Semanal</option>
                                <option value="quarter">Trimestral</option>
                                <option value="year">Anual</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label fw-semibold">Meses atrás</label>
                            <select class="form-select" id="trendMonthsSelect">
                                <option value="6">6 meses</option>
                                <option value="12" selected>12 meses</option>
                                <option value="24">24 meses</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tarjetas de estadísticas -->
            <div class="row" id="statsCards">
                <div class="col-md-3 mb-3">
                    <div class="card border-left-success h-100">
                        <div class="card-body">
                            <h6 class="text-muted mb-2">Ingresos Totales</h6>
                            <h3 class="mb-0 text-success" id="totalIncome">$0.00</h3>
                            <small class="text-muted mt-2 d-block" id="incomeChange"></small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card border-left-danger h-100">
                        <div class="card-body">
                            <h6 class="text-muted mb-2">Egresos Totales</h6>
                            <h3 class="mb-0 text-danger" id="totalExpense">$0.00</h3>
                            <small class="text-muted mt-2 d-block" id="expenseChange"></small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card border-left-primary h-100">
                        <div class="card-body">
                            <h6 class="text-muted mb-2">Balance Neto</h6>
                            <h3 class="mb-0 text-primary" id="balance">$0.00</h3>
                            <small class="text-muted mt-2 d-block" id="balanceChange"></small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card border-left-warning h-100">
                        <div class="card-body">
                            <h6 class="text-muted mb-2">Ratio Ingreso/Gasto</h6>
                            <h3 class="mb-0 text-warning" id="ratio">0%</h3>
                            <small class="text-muted">Por cada $1 de gasto</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Nombre de la empresa actual -->
            <div class="alert alert-info mb-3" id="currentCompanyInfo" style="display: none;">
                <i class="bi bi-building"></i> Mostrando datos de: <strong id="currentCompanyName"></strong>
            </div>
            
            <!-- Gráficas -->
            <div class="row mt-4">
                <div class="col-lg-8">
                    <div class="card shadow">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-graph-up"></i> Evolución del Flujo de Caja</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="cashFlowChart" height="300"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card shadow">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-pie-chart"></i> Distribución por Categorías</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="categoryChart" height="300"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de Flujo de Caja -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card shadow">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-table"></i> Flujo de Caja Detallado</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-hover" id="cashFlowTable">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Período</th>
                                            <th class="text-end">Ingresos</th>
                                            <th class="text-end">Egresos</th>
                                            <th class="text-end">Flujo Neto</th>
                                            <th class="text-end">Flujo Acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody id="cashFlowTableBody">
                                        <tr><td colspan="5" class="text-center">Seleccione una empresa para ver datos</td><tr>
                                    </tbody>
                                    <tfoot class="table-secondary fw-bold">
                                        <tr>
                                            <td>TOTAL</td>
                                            <td class="text-end" id="totalIncomeFooter">$0.00</td>
                                            <td class="text-end" id="totalExpenseFooter">$0.00</td>
                                            <td class="text-end" id="totalNetFooter">$0.00</td>
                                            <td class="text-end" id="finalCumulativeFooter">$0.00</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Transacciones recientes -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card shadow">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-clock-history"></i> Transacciones Recientes</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Cuenta</th>
                                            <th>Categoría</th>
                                            <th>Descripción</th>
                                            <th class="text-end">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recentTransactions">
                                        <tr><td colspan="6" class="text-center">Seleccione una empresa para ver datos</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        
        // Si hay una empresa seleccionada por defecto, cargar datos
        if (defaultCompanyId) {
            setTimeout(() => this.loadData(), 100);
        }
    },

    async loadCompanies() {
        try {
            // Usar endpoint público para obtener todas las empresas activas
            const response = await api.get('api/public/companies', false);
            if (response.success && response.data) {
                this.companies = response.data;
                console.log('Empresas cargadas:', this.companies.length);
                return this.companies;
            }
            return [];
        } catch (error) {
            console.error('Error loading companies:', error);
            return [];
        }
    },

    getDefaultStartDate() {
        const date = new Date();
        date.setMonth(date.getMonth() - 11);
        date.setDate(1);
        return date.toISOString().split('T')[0];
    },

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    },

    async loadData() {
        const companyId = document.getElementById('companySelect')?.value;
        
        if (!companyId) {
            showAlert('Por favor seleccione una empresa', 'warning');
            return;
        }

        const startDate = document.getElementById('startDate')?.value || this.getDefaultStartDate();
        const endDate = document.getElementById('endDate')?.value || this.getDefaultEndDate();
        const groupBy = document.getElementById('groupBySelect')?.value || 'month';
        const months = document.getElementById('trendMonthsSelect')?.value || 12;

        // Mostrar nombre de la empresa actual
        const selectedCompany = this.companies.find(c => c.id == companyId);
        const companyInfo = document.getElementById('currentCompanyInfo');
        const companyNameSpan = document.getElementById('currentCompanyName');
        if (selectedCompany && companyInfo && companyNameSpan) {
            companyNameSpan.textContent = selectedCompany.name;
            companyInfo.style.display = 'block';
        }

        try {
            this.showLoading();

            // 1. Cargar estadísticas
            const statsResponse = await api.get(`api/public/dashboard/stats?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}`, false);
            if (statsResponse.success && statsResponse.data) {
                this.updateStats(statsResponse.data);
            }

            // 2. Cargar tendencias (para gráfica)
            const trendsResponse = await api.get(`api/public/dashboard/trends?company_id=${companyId}&months=${months}`, false);
            if (trendsResponse.success && trendsResponse.data) {
                this.renderTrendChart(trendsResponse.data);
            }

            // 3. Cargar flujo de caja detallado
            const cashFlowResponse = await api.get(`api/public/dashboard/cashflow?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`, false);
            if (cashFlowResponse.success && cashFlowResponse.data) {
                this.renderCashFlowTable(cashFlowResponse.data);
                this.renderCashFlowChart(cashFlowResponse.data);
            }

            // 4. Cargar distribución por categorías
            const categoryResponse = await api.get(`api/public/dashboard/category-distribution?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}`, false);
            if (categoryResponse.success && categoryResponse.data) {
                this.renderCategoryChart(categoryResponse.data);
            }

            // 5. Cargar transacciones recientes
            const transactionsResponse = await api.get(`api/public/dashboard/recent-transactions?company_id=${companyId}&limit=10`, false);
            if (transactionsResponse.success && transactionsResponse.data) {
                this.renderTransactions(transactionsResponse.data.transactions || []);
            }

        } catch (error) {
            console.error('Error cargando dashboard:', error);
            showAlert('Error al cargar los datos del dashboard', 'danger');
        } finally {
            this.hideLoading();
        }
    },

    updateStats(data) {
        const currentPeriod = data.current_period || {};
        const comparison = data.comparison || {};
        
        const totalIncome = currentPeriod.total_income || 0;
        const totalExpense = currentPeriod.total_expense || 0;
        const balance = currentPeriod.balance || 0;
        const ratio = totalExpense > 0 ? ((totalIncome / totalExpense) * 100).toFixed(1) : 0;

        document.getElementById('totalIncome').innerHTML = formatCurrency(totalIncome);
        document.getElementById('totalExpense').innerHTML = formatCurrency(totalExpense);
        document.getElementById('balance').innerHTML = formatCurrency(balance);
        document.getElementById('ratio').innerHTML = `${ratio}%`;

        // Mostrar cambios
        const incomeChange = comparison.income_change || 0;
        const expenseChange = comparison.expense_change || 0;
        const balanceChange = comparison.balance_change || 0;

        document.getElementById('incomeChange').innerHTML = this.getChangeHtml(incomeChange, 'vs mes anterior');
        document.getElementById('expenseChange').innerHTML = this.getChangeHtml(expenseChange, 'vs mes anterior');
        document.getElementById('balanceChange').innerHTML = this.getChangeHtml(balanceChange, 'vs mes anterior');
    },

    getChangeHtml(change, text) {
        const isPositive = change >= 0;
        const icon = isPositive ? 'arrow-up' : 'arrow-down';
        const colorClass = isPositive ? 'text-success' : 'text-danger';
        return `<i class="bi bi-${icon} ${colorClass}"></i> <span class="${colorClass}">${Math.abs(change)}%</span> ${text}`;
    },

    renderTrendChart(data) {
        const ctx = document.getElementById('cashFlowChart').getContext('2d');

        if (this.cashFlowChartInstance) {
            this.cashFlowChartInstance.destroy();
        }

        const labels = data.labels || [];
        const incomeData = data.income_data || [];
        const expenseData = data.expense_data || [];
        const balanceData = data.balance_data || [];

        this.cashFlowChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: incomeData,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)',
                        borderColor: '#28a745',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Egresos',
                        data: expenseData,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: '#dc3545',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Balance',
                        data: balanceData,
                        type: 'line',
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#007bff',
                        pointBorderColor: 'white',
                        pointRadius: 4,
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
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: { display: true, text: 'Monto (USD)' },
                        ticks: { callback: (value) => formatCurrency(value) }
                    },
                    y1: {
                        beginAtZero: false,
                        position: 'right',
                        title: { display: true, text: 'Balance (USD)' },
                        grid: { drawOnChartArea: false },
                        ticks: { callback: (value) => formatCurrency(value) }
                    }
                }
            }
        });
    },

    renderCashFlowChart(data) {
        // Reutilizamos el mismo método que renderTrendChart
        // Los datos de cash_flow vienen en formato diferente
        const cashFlow = data.cash_flow || [];
        const labels = cashFlow.map(p => p.period_label);
        const incomeData = cashFlow.map(p => p.income);
        const expenseData = cashFlow.map(p => p.expense);
        const netData = cashFlow.map(p => p.net_cash_flow);

        const ctx = document.getElementById('cashFlowChart').getContext('2d');

        if (this.cashFlowChartInstance) {
            this.cashFlowChartInstance.destroy();
        }

        this.cashFlowChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: incomeData,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)',
                        borderColor: '#28a745',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Egresos',
                        data: expenseData,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: '#dc3545',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Flujo Neto',
                        data: netData,
                        type: 'line',
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#007bff',
                        pointBorderColor: 'white',
                        pointRadius: 4,
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
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: { display: true, text: 'Monto (USD)' },
                        ticks: { callback: (value) => formatCurrency(value) }
                    },
                    y1: {
                        beginAtZero: false,
                        position: 'right',
                        title: { display: true, text: 'Flujo Neto (USD)' },
                        grid: { drawOnChartArea: false },
                        ticks: { callback: (value) => formatCurrency(value) }
                    }
                }
            }
        });
    },

    renderCashFlowTable(data) {
        const tbody = document.getElementById('cashFlowTableBody');
        const cashFlow = data.cash_flow || [];

        if (cashFlow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos para mostrar</td></tr>';
            return;
        }

        let totalIncome = 0;
        let totalExpense = 0;
        let totalNet = 0;
        let lastCumulative = 0;

        tbody.innerHTML = cashFlow.map(p => {
            totalIncome += p.income;
            totalExpense += p.expense;
            totalNet += p.net_cash_flow;
            lastCumulative = p.cumulative;
            
            const netClass = p.net_cash_flow >= 0 ? 'text-success' : 'text-danger';
            const cumulativeClass = p.cumulative >= 0 ? 'text-success' : 'text-danger';
            
            return `
                <tr>
                    <td><strong>${p.period_label}</strong></td>
                    <td class="text-end text-success">${formatCurrency(p.income)}</td>
                    <td class="text-end text-danger">${formatCurrency(p.expense)}</td>
                    <td class="text-end ${netClass} fw-bold">${formatCurrency(p.net_cash_flow)}</td>
                    <td class="text-end ${cumulativeClass}">${formatCurrency(p.cumulative)}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('totalIncomeFooter').innerHTML = formatCurrency(totalIncome);
        document.getElementById('totalExpenseFooter').innerHTML = formatCurrency(totalExpense);
        document.getElementById('totalNetFooter').innerHTML = formatCurrency(totalNet);
        document.getElementById('finalCumulativeFooter').innerHTML = formatCurrency(lastCumulative);
    },

    renderCategoryChart(data) {
        const ctx = document.getElementById('categoryChart').getContext('2d');

        if (this.categoryChartInstance) {
            this.categoryChartInstance.destroy();
        }

        // Mostrar top 5 de egresos por categoría
        const expenseCategories = data.distribution?.expense || [];
        const topExpenses = expenseCategories.slice(0, 5);
        
        const labels = topExpenses.map(c => c.account_name);
        const values = topExpenses.map(c => c.total);
        const backgroundColors = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#6f42c1'];

        this.categoryChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderTransactions(transactions) {
        const tbody = document.getElementById('recentTransactions');

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay transacciones recientes</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td style="white-space: nowrap;">${formatDate(t.date)}</td>
                <td>
                    <span class="badge ${t.type === 'income' ? 'bg-success' : 'bg-danger'}">
                        ${t.type === 'income' ? 'Ingreso' : 'Egreso'}
                    </span>
                </td>
                <td>${t.account_name || '-'}</td>
                <td>${t.category || '-'}</td>
                <td title="${t.description || ''}">${(t.description || '-').substring(0, 50)}${(t.description || '').length > 50 ? '...' : ''}</td>
                <td class="text-end ${t.type === 'income' ? 'text-success' : 'text-danger'} fw-bold">
                    ${formatCurrency(Math.abs(t.amount))}
                </td>
            </tr>
        `).join('');
    },

    setupEventListeners() {
        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.loadData());
        }

        const loginPrompt = document.getElementById('loginPromptBtn');
        if (loginPrompt) {
            loginPrompt.addEventListener('click', (e) => {
                e.preventDefault();
                const event = new CustomEvent('showLoginModal');
                document.dispatchEvent(event);
            });
        }

        const exportBtn = document.getElementById('exportDashboardBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDashboard());
        }

        const companySelect = document.getElementById('companySelect');
        if (companySelect) {
            companySelect.addEventListener('change', () => {
                if (companySelect.value) {
                    this.loadData();
                }
            });
        }

        const groupBySelect = document.getElementById('groupBySelect');
        if (groupBySelect) {
            groupBySelect.addEventListener('change', () => {
                const companyId = document.getElementById('companySelect')?.value;
                if (companyId) this.loadData();
            });
        }

        const trendMonths = document.getElementById('trendMonthsSelect');
        if (trendMonths) {
            trendMonths.addEventListener('change', () => {
                const companyId = document.getElementById('companySelect')?.value;
                if (companyId) this.loadData();
            });
        }
    },

    async exportDashboard() {
        const companyId = document.getElementById('companySelect')?.value;
        if (!companyId) {
            showAlert('Seleccione una empresa para exportar', 'warning');
            return;
        }

        const selectedCompany = this.companies.find(c => c.id == companyId);
        showAlert(`Exportando dashboard de ${selectedCompany?.name}...`, 'info');
        
        // Aquí puedes implementar la exportación a PDF del dashboard
        // Similar a lo que hiciste con los reportes de ingresos/egresos
    },

    showLoading() {
        const btn = document.getElementById('applyFiltersBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
        
        const cards = document.querySelectorAll('#statsCards .card');
        cards.forEach(card => card.style.opacity = '0.6');
    },

    hideLoading() {
        const btn = document.getElementById('applyFiltersBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-search"></i> Consultar';
        }
        
        const cards = document.querySelectorAll('#statsCards .card');
        cards.forEach(card => card.style.opacity = '1');
    }
};