// modules/dashboard.js
import { api } from '../services/apiService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const dashboardModule = {
    chartInstance: null,
    categoryChartInstance: null,

    async render(container) {
        const isAuthenticated = api.isAuthenticated();
        const companies = await this.loadCompanies();

        container.innerHTML = `
        <h1 class="h3 mb-4">Panel de Control</h1>
        
        ${!isAuthenticated ? `
        <div class="alert alert-info mb-4">
            <i class="bi bi-info-circle"></i> 
            Este es un dashboard público. Seleccione una empresa y período para ver sus datos.
            <a href="#" id="loginPromptBtn" class="alert-link">Inicia sesión</a> para gestionar tus propios datos.
        </div>
        ` : ''}
        
        <!-- Panel de Filtros Unificado -->
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="bi bi-funnel"></i> Filtros de Consulta</h5>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label fw-semibold">
                            <i class="bi bi-building"></i> Empresa
                        </label>
                        <select class="form-select" id="companySelect">
                            <option value="">Seleccione una empresa...</option>
                            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label fw-semibold">
                            <i class="bi bi-calendar3"></i> Fecha desde
                        </label>
                        <input type="date" id="startDate" class="form-control" value="${this.getDefaultStartDate()}">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label fw-semibold">
                            <i class="bi bi-calendar3"></i> Fecha hasta
                        </label>
                        <input type="date" id="endDate" class="form-control" value="${this.getDefaultEndDate()}">
                    </div>
                    <div class="col-md-2 d-flex align-items-end">
                        <button class="btn btn-primary w-100" id="applyFiltersBtn">
                            <i class="bi bi-search"></i> Consultar
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tarjetas de estadísticas -->
        <div class="row" id="statsCards">
            <div class="col-md-4 mb-3">
                <div class="card stat-card border-left-success">
                    <div class="card-body">
                        <h6>Ingresos Totales</h6>
                        <h3 id="totalIncome">$0.00</h3>
                        <small class="text-muted" id="incomeChange"></small>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card stat-card border-left-danger">
                    <div class="card-body">
                        <h6>Egresos Totales</h6>
                        <h3 id="totalExpense">$0.00</h3>
                        <small class="text-muted" id="expenseChange"></small>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card stat-card border-left-primary">
                    <div class="card-body">
                        <h6>Balance</h6>
                        <h3 id="balance">$0.00</h3>
                        <small class="text-muted" id="balanceChange"></small>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Gráficas -->
        <div class="row mt-4">
            <div class="col-md-8">
                <div class="card shadow">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-graph-up"></i> Evolución Mensual</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="trendChart" height="250"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-pie-chart"></i> Distribución por Categorías</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="categoryChart" height="250"></canvas>
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
                                        <th>Monto</th>
                                    </thead>
                                <tbody id="recentTransactions"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

        this.setupEventListeners();
    },

    async loadCompanies() {
        try {
            // Usar endpoint público para obtener empresas (solo las activas)
            const response = await api.get('api/public/companies', false);
            if (response.success && response.data) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('Error loading companies:', error);
            return [];
        }
    },

    getDefaultStartDate() {
        // Últimos 12 meses
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
        const startDate = document.getElementById('startDate')?.value || this.getDefaultStartDate();
        const endDate = document.getElementById('endDate')?.value || this.getDefaultEndDate();

        if (!companyId) {
            showAlert('Por favor seleccione una empresa', 'warning');
            return;
        }

        try {
            this.showLoading();

            const applyBtn = document.getElementById('applyFiltersBtn');
            if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Cargando...';
            }

            // Estadísticas
            const statsResponse = await api.get(`api/public/dashboard/stats?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}`, false);
            console.log('Stats:', statsResponse);
            if (statsResponse.success && statsResponse.data) {
                this.updateStats(statsResponse.data);
            }

            // Tendencias (gráfica)
            const trendsResponse = await api.get(`api/public/dashboard/trends?company_id=${companyId}&months=12`, false);
            console.log('Trends:', trendsResponse);
            if (trendsResponse.success && trendsResponse.data) {
                this.renderTrendChart(trendsResponse.data);
            } else {
                console.warn('No se recibieron datos de tendencias');
                this.renderTrendChart(null);
            }

            // Categorías
            const categoryResponse = await api.get(`api/public/dashboard/category-distribution?company_id=${companyId}&start_date=${startDate}&end_date=${endDate}`, false);
            console.log('Category:', categoryResponse);
            if (categoryResponse.success && categoryResponse.data) {
                this.renderCategoryChart(categoryResponse.data);
            }

            // Transacciones recientes
            const transactionsResponse = await api.get(`api/public/dashboard/recent-transactions?company_id=${companyId}&limit=10`, false);
            console.log('Transactions:', transactionsResponse);
            if (transactionsResponse.success && transactionsResponse.data) {
                this.renderTransactions(transactionsResponse.data.transactions || []);
            } else {
                this.renderTransactions([]);
            }

        } catch (error) {
            console.error('Error cargando dashboard:', error);
            showAlert('Error al cargar los datos del dashboard', 'danger');
            this.renderTrendChart(null);
            this.renderTransactions([]);
        } finally {
            this.hideLoading();
            const applyBtn = document.getElementById('applyFiltersBtn');
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<i class="bi bi-search"></i> Consultar';
            }
        }
    },

    updateStats(data) {
        const currentPeriod = data.current_period || {};

        document.getElementById('totalIncome').innerHTML = formatCurrency(currentPeriod.total_income || 0);
        document.getElementById('totalExpense').innerHTML = formatCurrency(currentPeriod.total_expense || 0);
        document.getElementById('balance').innerHTML = formatCurrency(currentPeriod.balance || 0);

        if (data.public_demo) {
            document.getElementById('incomeChange').innerHTML = '';
            document.getElementById('expenseChange').innerHTML = '';
            document.getElementById('balanceChange').innerHTML = '';
        }
    },

    renderTrendChart(data) {
        const ctx = document.getElementById('trendChart').getContext('2d');

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const labels = data.labels || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
        const incomeData = data.income_data || [12000, 12500, 13000, 12800, 13500, 14000];
        const expenseData = data.expense_data || [9000, 8750, 8500, 8200, 8300, 8100];

        this.chartInstance = new Chart(ctx, {
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
                        tension: 0.4
                    },
                    {
                        label: 'Egresos',
                        data: expenseData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true,
                        tension: 0.4
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
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    },

    renderCategoryChart(data) {
        const ctx = document.getElementById('categoryChart').getContext('2d');

        if (this.categoryChartInstance) {
            this.categoryChartInstance.destroy();
        }

        // Preparar datos para la gráfica de categorías
        let labels = [];
        let values = [];
        let backgroundColors = [];

        if (data.distribution && data.distribution.income) {
            const incomeCategories = data.distribution.income.slice(0, 5);
            labels = incomeCategories.map(c => c.account_name);
            values = incomeCategories.map(c => c.total);
            backgroundColors = ['#28a745', '#20c997', '#17a2b8', '#6f42c1', '#fd7e14'];
        } else {
            // Datos de demostración
            labels = ['Ventas', 'Servicios', 'Alquileres', 'Intereses', 'Otros'];
            values = [45000, 25000, 15000, 10000, 5000];
            backgroundColors = ['#28a745', '#20c997', '#17a2b8', '#6f42c1', '#fd7e14'];
        }

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
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 10 }
                        }
                    },
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
                <td style="white-space: nowrap;">
                    <span class="badge ${t.type === 'income' ? 'bg-success' : 'bg-danger'}">
                        ${t.type === 'income' ? 'Ingreso' : 'Egreso'}
                    </span>
                </td>
                <td>${t.account_name || '-'}</td>
                <td>${t.category || '-'}</td>
                <td title="${t.description || ''}">${(t.description || '-').substring(0, 50)}${(t.description || '').length > 50 ? '...' : ''}</td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'} fw-bold" style="white-space: nowrap;">
                    ${formatCurrency(Math.abs(t.amount))}
                </td>
            </table>
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

        // También cargar datos cuando se selecciona una empresa (opcional)
        const companySelect = document.getElementById('companySelect');
        if (companySelect) {
            companySelect.addEventListener('change', () => {
                if (companySelect.value) {
                    this.loadData();
                }
            });
        }
    },

    showLoading() {
        const cards = document.querySelectorAll('#statsCards .card');
        cards.forEach(card => {
            card.style.opacity = '0.6';
        });
    },

    hideLoading() {
        const cards = document.querySelectorAll('#statsCards .card');
        cards.forEach(card => {
            card.style.opacity = '1';
        });
    }
};