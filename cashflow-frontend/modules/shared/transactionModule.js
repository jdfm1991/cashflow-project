// modules/shared/transactionModule.js (versión completa)

import { api } from '../../services/apiService.js';
import { accountService } from '../../services/accountService.js';
import { companyService } from '../../services/companyService.js';
import { currencyService } from '../../services/currencyService.js';
import { transactionService } from '../../services/transactionService.js';
import { reconversionService } from '../../services/reconversionService.js';
import { pdfExportService } from '../../services/pdfExportService.js';
import { formatCurrency, formatCurrencyUSD, formatDate, showAlert } from '../../utils/helpers.js';

export class TransactionModule {
    constructor(type) {
        this.type = type; // 'income' o 'expense'
        this.transactions = [];
        this.accounts = [];
        this.companies = [];
        this.currencies = [];
        this.baseCurrency = null;
        this.defaultCurrency = null;
        this.pdfGroupBy = 'month';
        this.includeDetailedTables = true;
        this.filters = {
            company_id: '',
            year: '',
            month: '',
            account_id: ''
        };
        this.dataTable = null;
        this.currentYear = new Date().getFullYear();
        this._cleanupExchangeRateEvents = null;
    }

    /**
     * Renderizar el módulo completo
     */
    async render(container) {
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const config = this.getConfig();

        // Cargar monedas
        await currencyService.getAll();
        this.currencies = currencyService.currencies;
        this.baseCurrency = currencyService.baseCurrency;
        this.defaultCurrency = currencyService.defaultCurrency;

        container.innerHTML = this.getHTML(isSuperAdmin, config);

        if (isSuperAdmin) {
            await this.loadCompanies();
        }

        await this.loadAccounts();
        await this.loadTransactions();
        this.setupEventListeners(isSuperAdmin);
    }

    /**
     * Obtener el título y colores según el tipo
     */
    getConfig() {
        return {
            income: {
                title: 'Gestión de Ingresos',
                buttonClass: 'btn-success',
                headerClass: 'bg-success',
                tableHeaderClass: 'bg-success text-white',
                totalClass: 'text-success',
                badgeCash: 'bg-success',
                badgeBank: 'bg-secondary',
                icon: 'bi-arrow-up-circle',
                pdfMethod: 'exportIncomesToPDF',
                createMethod: 'createIncome',
                updateMethod: 'updateIncome',
                deleteMethod: 'deleteIncome',
                getMethod: 'getIncomes',
                statsMethod: 'getIncomeStats',
                reconvertMethod: 'reconvertIncomes',
                entityName: 'Ingreso'
            },
            expense: {
                title: 'Gestión de Egresos',
                buttonClass: 'btn-danger',
                headerClass: 'bg-danger',
                tableHeaderClass: 'bg-danger text-white',
                totalClass: 'text-danger',
                badgeCash: 'bg-success',
                badgeBank: 'bg-secondary',
                icon: 'bi-arrow-down-circle',
                pdfMethod: 'exportExpensesToPDF',
                createMethod: 'createExpense',
                updateMethod: 'updateExpense',
                deleteMethod: 'deleteExpense',
                getMethod: 'getExpenses',
                statsMethod: 'getExpenseStats',
                reconvertMethod: 'reconvertExpenses',
                entityName: 'Egreso'
            }
        }[this.type];
    }

    /**
     * Generar HTML del módulo
     */
    getHTML(isSuperAdmin, config) {
        return `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">${config.title}</h1>
                <div>
                    <button class="btn btn-warning me-2" id="reconvertBtn">
                        <i class="bi bi-arrow-repeat"></i> Reconversión Masiva
                    </button>
                    <button class="btn ${config.buttonClass}" id="addTransactionBtn">
                        <i class="bi bi-plus-circle"></i> Nuevo ${config.entityName}
                    </button>
                </div>
            </div>
            
            <!-- Información de monedas -->
            <div class="row mb-3">
                <div class="col-md-6">
                    <div class="alert alert-info">
                        <i class="bi bi-currency-exchange"></i>
                        <strong>Moneda Base:</strong> ${this.baseCurrency?.code || 'No definida'} - 
                        Los montos se almacenan en esta moneda para reportes consistentes.
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-success">
                        <i class="bi bi-eye"></i>
                        <strong>Moneda de Visualización:</strong> ${this.defaultCurrency?.code || this.baseCurrency?.code || 'No definida'} - 
                        Puede ver los montos en esta moneda en los reportes.
                    </div>
                </div>
            </div>
            
            <!-- Filtros Avanzados -->
            <div class="card shadow-sm mb-4">
                <div class="card-header ${config.headerClass} text-white">
                    <h5 class="mb-0"><i class="bi bi-funnel"></i> Filtros de Búsqueda</h5>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        ${isSuperAdmin ? `
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-building"></i> Empresa
                            </label>
                            <select class="form-select" id="filterCompany">
                                <option value="">Todas las empresas</option>
                                ${this.companies.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-calendar-year"></i> Año
                            </label>
                            <select class="form-select" id="filterYear">
                                <option value="">Todos los años</option>
                                ${this.generateYearOptions()}
                            </select>
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-calendar-month"></i> Mes
                            </label>
                            <select class="form-select" id="filterMonth">
                                <option value="">Todos los meses</option>
                                ${this.getMonthOptions()}
                            </select>
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-bank2"></i> Cuenta
                            </label>
                            <select class="form-select" id="filterAccount">
                                <option value="">Todas las cuentas</option>
                                ${this.accounts.map(acc => `<option value="${acc.id}">${this.escapeHtml(acc.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <button class="btn ${config.buttonClass}" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Buscar
                            </button>
                            <button class="btn btn-secondary ms-2" id="resetFiltersBtn">
                                <i class="bi bi-arrow-repeat"></i> Resetear Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de transacciones -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h5 class="mb-0">Listado de ${config.entityName}s</h5>
                        <div class="d-flex gap-3 align-items-center flex-wrap">
                            <div class="d-flex align-items-center">
                                <label class="mb-0 me-2">
                                    <i class="bi bi-diagram-3"></i> Agrupar PDF por:
                                </label>
                                <select id="pdfGroupBySelect" class="form-select form-select-sm" style="width: auto;">
                                    <option value="week">Semanas</option>
                                    <option value="month" selected>Meses</option>
                                    <option value="quarter">Trimestres</option>
                                    <option value="semester">Semestres</option>
                                    <option value="year">Años</option>
                                </select>
                            </div>
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="includeDetailedTables" checked>
                                <label class="form-check-label" for="includeDetailedTables">
                                    <i class="bi bi-table"></i> Incluir tablas detalladas
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="transactionTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
                                    ${isSuperAdmin ? '<th>Empresa</th>' : ''}
                                    <th>Cuenta</th>
                                    <th>Origen</th>
                                    <th>Monto Divisa</th>
                                    <th>Tasa</th>
                                    <th>Monto Base</th>
                                    <th>Referencia</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td colspan="${isSuperAdmin ? '10' : '9'}" class="text-center">Cargando...</td></tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="${isSuperAdmin ? '4' : '3'}" class="text-end">Total en Moneda Base:</th>
                                    <th id="totalAmount" class="${config.totalClass}">$0.00</th>
                                    <th colspan="3" class="text-end">Total en USD:</th>
                                    <th id="totalAmountDivisa" class="${config.totalClass}">$0.00</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        let options = '';
        for (let year = 2024; year <= currentYear; year++) {
            options += `<option value="${year}">${year}</option>`;
        }
        return options;
    }

    getMonthOptions() {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months.map((month, index) => `<option value="${index + 1}">${month}</option>`).join('');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadCompanies() {
        try {
            const response = await companyService.getAll();
            if (response.success && response.data) {
                this.companies = response.data;
            }
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    }

    async loadAccounts() {
        try {
            const response = await accountService.getAll(this.type);
            if (response.success && response.data) {
                this.accounts = response.data;
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    async loadTransactions() {
        try {
            const apiFilters = {};
            if (this.filters.company_id && this.filters.company_id !== '') apiFilters.company_id = this.filters.company_id;
            if (this.filters.year && this.filters.year !== '') apiFilters.year = this.filters.year;
            if (this.filters.month && this.filters.month !== '') apiFilters.month = this.filters.month;
            if (this.filters.account_id && this.filters.account_id !== '') apiFilters.account_id = this.filters.account_id;

            const config = this.getConfig();
            const methodName = config.getMethod;
            const response = await transactionService[methodName](apiFilters);

            if (!response?.success) {
                this.transactions = [];
                this.renderDataTable();
                return;
            }

            const dataKey = this.type === 'income' ? 'incomes' : 'expenses';
            this.transactions = response.data?.[dataKey] || response.data || [];
            this.renderDataTable();
        } catch (error) {
            console.error(`Error loading ${this.type}s:`, error);
            this.transactions = [];
            this.renderDataTable();
        }
    }

    renderDataTable() {
        if (this.dataTable) this.dataTable.destroy();

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const config = this.getConfig();

        if (!Array.isArray(this.transactions)) this.transactions = [];

        const totalBase = this.transactions.reduce((sum, t) => sum + (parseFloat(t.amount_base_currency) || 0), 0);
        const totalDivisa = this.transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const tableData = this.transactions.map(transaction => {
            const row = [transaction.id, formatDate(transaction.date)];
            if (isSuperAdmin) row.push(transaction.company_name || '-');
            row.push(
                transaction.account_name || '-',
                transaction.payment_method === 'bank' ?
                    `<span class="badge ${config.badgeBank}"><i class="bi bi-bank"></i> Banco</span>` :
                    `<span class="badge ${config.badgeCash}"><i class="bi bi-cash"></i> Efectivo</span>`,
                formatCurrencyUSD(parseFloat(transaction.amount)),
                formatCurrency(parseFloat(transaction.exchange_rate)) || 'Sin tasa',
                formatCurrency(parseFloat(transaction.amount_base_currency)),
                transaction.reference || '-',
                `<div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-transaction" data-id="${transaction.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-transaction" data-id="${transaction.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>`
            );
            return row;
        });

        if (tableData.length === 0) {
            const colCount = isSuperAdmin ? 10 : 9;
            $('#transactionTable').html(this.getEmptyTableHTML(isSuperAdmin, colCount, config));
            document.getElementById('totalAmount').innerHTML = formatCurrency(0);
            document.getElementById('totalAmountDivisa').innerHTML = formatCurrencyUSD(0);
            return;
        }

        this.dataTable = $('#transactionTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[2, 'desc']],
            columnDefs: [{ targets: 0, visible: false }, { targets: tableData[0]?.length - 1, orderable: false, searchable: false }],
            dom: 'Bfrtip',
            buttons: [
                { extend: 'copy', text: '<i class="bi bi-files"></i> Copiar', className: 'btn btn-sm btn-secondary me-1' },
                { extend: 'csv', text: '<i class="bi bi-filetype-csv"></i> CSV', className: 'btn btn-sm btn-info me-1' },
                { extend: 'excel', text: '<i class="bi bi-file-excel"></i> Excel', className: 'btn btn-sm btn-success me-1' },
                { text: '<i class="bi bi-file-pdf"></i> PDF Personalizado', className: 'btn btn-sm btn-danger me-1', action: () => this.exportToPDF() },
                { extend: 'print', text: '<i class="bi bi-printer"></i> Imprimir', className: 'btn btn-sm btn-secondary me-1' }
            ],
            drawCallback: () => {
                document.getElementById('totalAmount').innerHTML = formatCurrency(totalBase);
                document.getElementById('totalAmountDivisa').innerHTML = formatCurrencyUSD(totalDivisa);
                this.attachTableEvents();
            }
        });

        this.setupPDFControls();
        this.updateActiveFiltersIndicator();
        this.attachTableEvents();
    }

    getEmptyTableHTML(isSuperAdmin, colCount, config) {
        return `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    ${isSuperAdmin ? '<th>Empresa</th>' : ''}
                    <th>Cuenta</th>
                    <th>Origen</th>
                    <th>Monto Divisa</th>
                    <th>Tasa</th>
                    <th>Monto Base</th>
                    <th>Referencia</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="${colCount}" class="text-center text-muted">No hay ${config.entityName}s para mostrar</td></tr>
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="${isSuperAdmin ? '4' : '3'}" class="text-end">Total en Moneda Base:</th>
                    <th id="totalAmount" class="${config.totalClass}">$0.00</th>
                    <th colspan="3" class="text-end">Total en USD:</th>
                    <th id="totalAmountDivisa" class="${config.totalClass}">$0.00</th>
                </tr>
            </tfoot>
        `;
    }

    setupPDFControls() {
        const groupBySelect = document.getElementById('pdfGroupBySelect');
        if (groupBySelect) groupBySelect.addEventListener('change', (e) => this.pdfGroupBy = e.target.value);
        const includeTablesCheckbox = document.getElementById('includeDetailedTables');
        if (includeTablesCheckbox) includeTablesCheckbox.addEventListener('change', (e) => this.includeDetailedTables = e.target.checked);
    }

    exportToPDF() {
        if (!this.transactions?.length) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const showAllCompanies = isSuperAdmin && (!this.filters.company_id || this.filters.company_id === '');
        const config = this.getConfig();
        const filtersInfo = {
            company_name: this.filters.company_id ? this.companies.find(c => c.id == this.filters.company_id)?.name : null,
            year: this.filters.year,
            month_name: this.filters.month ? this.getMonthName(this.filters.month) : null,
            account_name: this.filters.account_id ? this.accounts.find(a => a.id == this.filters.account_id)?.name : null
        };
        pdfExportService[config.pdfMethod](this.transactions, filtersInfo, this.pdfGroupBy, isSuperAdmin, showAllCompanies, this.includeDetailedTables);
        showAlert(`Exportando PDF...`, 'success');
    }

    getMonthName(monthNumber) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[parseInt(monthNumber) - 1];
    }

    attachTableEvents() {
        document.querySelectorAll('.edit-transaction').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const transaction = this.transactions.find(t => t.id === id);
                if (transaction) this.showModal(transaction);
            });
        });

        document.querySelectorAll('.delete-transaction').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const transaction = this.transactions.find(t => t.id === id);
                if (!transaction) return;

                const confirmed = confirm(`¿Está seguro de eliminar este ${this.getConfig().entityName} de ${formatCurrency(transaction.amount)} del ${formatDate(transaction.date)}?`);
                if (!confirmed) return;

                try {
                    const config = this.getConfig();
                    const response = await transactionService[config.deleteMethod](id);
                    if (response.success) {
                        showAlert(`${config.entityName} eliminado exitosamente`, 'success');
                        await this.loadTransactions();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar', 'danger');
                }
            });
        });
    }

    setupEventListeners(isSuperAdmin) {
        document.getElementById('addTransactionBtn')?.addEventListener('click', () => this.showModal());
        document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
            this.filters = {
                company_id: document.getElementById('filterCompany')?.value || '',
                year: document.getElementById('filterYear')?.value || '',
                month: document.getElementById('filterMonth')?.value || '',
                account_id: document.getElementById('filterAccount')?.value || ''
            };
            this.loadTransactions();
        });
        document.getElementById('resetFiltersBtn')?.addEventListener('click', () => this.resetFilters());
        document.getElementById('reconvertBtn')?.addEventListener('click', () => this.showReconversionModal());
    }

    resetFilters() {
        document.getElementById('filterCompany') && (document.getElementById('filterCompany').value = '');
        document.getElementById('filterYear') && (document.getElementById('filterYear').value = '');
        document.getElementById('filterMonth') && (document.getElementById('filterMonth').value = '');
        document.getElementById('filterAccount') && (document.getElementById('filterAccount').value = '');
        this.filters = { company_id: '', year: '', month: '', account_id: '' };
        this.loadTransactions();
        showAlert('Filtros reiniciados', 'success');
    }

    updateActiveFiltersIndicator() {
        const activeFilters = [];
        if (this.filters.company_id && this.filters.company_id !== '') {
            const company = this.companies.find(c => c.id == this.filters.company_id);
            if (company) activeFilters.push(`Empresa: ${company.name}`);
        }
        if (this.filters.year && this.filters.year !== '') activeFilters.push(`Año: ${this.filters.year}`);
        if (this.filters.month && this.filters.month !== '') activeFilters.push(`Mes: ${this.getMonthName(this.filters.month)}`);
        if (this.filters.account_id && this.filters.account_id !== '') {
            const account = this.accounts.find(a => a.id == this.filters.account_id);
            if (account) activeFilters.push(`Cuenta: ${account.name}`);
        }

        const existingIndicator = document.querySelector('.active-filters-indicator');
        if (existingIndicator) existingIndicator.remove();

        if (activeFilters.length > 0) {
            const cardBody = document.querySelector('#transactionTable')?.closest('.card-body');
            if (cardBody) {
                let filterContainer = document.querySelector('.filters-indicator-container');
                if (!filterContainer) {
                    filterContainer = document.createElement('div');
                    filterContainer.className = 'filters-indicator-container';
                    cardBody.insertBefore(filterContainer, cardBody.firstChild);
                }
                filterContainer.innerHTML = `
                    <div class="alert alert-success mt-2 active-filters-indicator">
                        <i class="bi bi-funnel-fill"></i> <strong>Filtros activos:</strong> ${activeFilters.join(' | ')}
                        <button type="button" class="btn-close float-end" id="clearFiltersBtn"></button>
                    </div>
                `;
                document.getElementById('clearFiltersBtn')?.addEventListener('click', () => this.resetFilters());
            }
        }
    }

    // Métodos que deben ser implementados por las clases hijas (o pueden ser sobrescritos)
    async showModal(transaction = null) {
        // Implementación por defecto - mostrar mensaje
        console.warn('showModal() no implementado para', this.type);
        showAlert(`Funcionalidad en desarrollo para ${this.getConfig().entityName}s`, 'info');
    }

    async showReconversionModal() {
        console.warn('showReconversionModal() no implementado para', this.type);
        showAlert(`Reconversión masiva en desarrollo para ${this.getConfig().entityName}s`, 'info');
    }

    async saveTransaction(transaction = null) {
        console.warn('saveTransaction() no implementado para', this.type);
        showAlert(`Guardado de ${this.getConfig().entityName}s en desarrollo`, 'info');
    }

    setupExchangeRateEvents() {
        console.warn('setupExchangeRateEvents() no implementado para', this.type);
    }

    closeModal() {
        if (this._cleanupExchangeRateEvents) {
            this._cleanupExchangeRateEvents();
            this._cleanupExchangeRateEvents = null;
        }
        const modal = document.getElementById('transactionModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            bsModal?.hide();
            setTimeout(() => modal.remove(), 300);
        }
    }
}