import { transactionService } from '../services/transactionService.js';
import { accountService } from '../services/accountService.js';
import { companyService } from '../services/companyService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';
import { pdfExportService } from '../services/pdfExportService.js';
import { api } from '../services/apiService.js';

export const incomeModule = {
    incomes: [],
    accounts: [],
    companies: [],
    currencies: [],
    baseCurrency: null,
    pdfGroupBy: 'month',
    includeDetailedTables: true,
    filters: {
        company_id: '',
        year: '',
        month: '',
        account_id: ''
    },
    dataTable: null,
    currentYear: new Date().getFullYear(),

    async render(container) {
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // Cargar monedas primero
        await this.loadCurrencies();

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Gestión de Ingresos</h1>
                <button class="btn btn-success" id="addIncomeBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Ingreso
                </button>
            </div>
            
            <!-- Filtros Avanzados -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-success text-white">
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
                                ${this.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
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
                                <option value="1">Enero</option>
                                <option value="2">Febrero</option>
                                <option value="3">Marzo</option>
                                <option value="4">Abril</option>
                                <option value="5">Mayo</option>
                                <option value="6">Junio</option>
                                <option value="7">Julio</option>
                                <option value="8">Agosto</option>
                                <option value="9">Septiembre</option>
                                <option value="10">Octubre</option>
                                <option value="11">Noviembre</option>
                                <option value="12">Diciembre</option>
                            </select>
                        </div>
                        <div class="col-md-${isSuperAdmin ? '3' : '4'}">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-bank2"></i> Cuenta
                            </label>
                            <select class="form-select" id="filterAccount">
                                <option value="">Todas las cuentas</option>
                                ${this.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <button class="btn btn-success" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Buscar
                            </button>
                            <button class="btn btn-secondary ms-2" id="resetFiltersBtn">
                                <i class="bi bi-arrow-repeat"></i> Resetear Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de ingresos -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h5 class="mb-0">Listado de Ingresos</h5>
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
                        <table id="incomeTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
                                    ${isSuperAdmin ? '<th>Empresa</th>' : ''}
                                    <th>Cuenta</th>
                                    <th>Origen</th>
                                    <th>Moneda</th>
                                    <th>Monto Original</th>
                                    <th>Tasa</th>
                                    <th>Monto (Base)</th>
                                    <th>Descripción</th>
                                    <th>Referencia</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="incomeTableBody">
                                <tr><td colspan="${isSuperAdmin ? '12' : '11'}" class="text-center">Cargando...</td></tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="${isSuperAdmin ? '8' : '7'}" class="text-end">Total en Moneda Base:</th>
                                    <th id="totalAmount" class="text-success">$0.00</th>
                                    <th colspan="3"></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Cargar empresas solo si es super_admin
        if (isSuperAdmin) {
            await this.loadCompanies();
        }

        await this.loadAccounts();
        await this.loadIncomes();
        this.setupEventListeners();
    },

    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        let options = '';
        for (let year = 2024; year <= currentYear; year++) {
            options += `<option value="${year}">${year}</option>`;
        }
        return options;
    },

    async loadCompanies() {
        try {
            const response = await companyService.getAll();
            if (response.success && response.data) {
                this.companies = response.data;
                const select = document.getElementById('filterCompany');
                if (select) {
                    select.innerHTML = '<option value="">Todas las empresas</option>' +
                        this.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                }
            }
        } catch (error) {
            console.error('Error loading companies:', error);
            if (error.status === 403) {
                console.log('Usuario no es super_admin, ocultando selector de empresas');
                const filterCompanyDiv = document.getElementById('filterCompany')?.closest('.col-md-3');
                if (filterCompanyDiv) filterCompanyDiv.style.display = 'none';
            }
        }
    },

    async loadAccounts() {
        try {
            const response = await accountService.getAll('income');
            if (response.success && response.data) {
                this.accounts = response.data;
                const select = document.getElementById('filterAccount');
                if (select) {
                    select.innerHTML = '<option value="">Todas las cuentas</option>' +
                        this.accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
                }
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    },

    async loadIncomes() {
        try {
            const apiFilters = {};

            if (this.filters.company_id && this.filters.company_id !== '') {
                apiFilters.company_id = this.filters.company_id;
            }
            if (this.filters.year && this.filters.year !== '') {
                apiFilters.year = this.filters.year;
            }
            if (this.filters.month && this.filters.month !== '') {
                apiFilters.month = this.filters.month;
            }
            if (this.filters.account_id && this.filters.account_id !== '') {
                apiFilters.account_id = this.filters.account_id;
            }

            console.log('Filtros aplicados (ingresos):', apiFilters);

            const response = await transactionService.getIncomes(apiFilters);

            console.log('Respuesta completa:', response);

            // ✅ Validar que la respuesta existe
            if (!response) {
                console.error('La respuesta es nula o undefined');
                this.incomes = [];
                this.renderDataTable();
                showAlert('Error al cargar los ingresos: respuesta vacía', 'danger');
                return;
            }

            // ✅ Validar que la respuesta es exitosa
            if (!response.success) {
                console.error('Respuesta no exitosa:', response.message);
                this.incomes = [];
                this.renderDataTable();
                showAlert(response.message || 'Error al cargar los ingresos', 'danger');
                return;
            }

            // ✅ Validar que response.data existe
            if (!response.data) {
                console.error('response.data es undefined o null');
                this.incomes = [];
                this.renderDataTable();
                showAlert('Error: No se recibieron datos del servidor', 'danger');
                return;
            }

            console.log('response.data:', response.data);
            console.log('Tipo de response.data:', typeof response.data);

            // ✅ Extraer los ingresos de la respuesta
            let incomesData = null;

            if (response.data.incomes && Array.isArray(response.data.incomes)) {
                incomesData = response.data.incomes;
                console.log('✅ Estructura: response.data.incomes, cantidad:', incomesData.length);
            }
            else if (Array.isArray(response.data)) {
                incomesData = response.data;
                console.log('✅ Estructura: response.data es array, cantidad:', incomesData.length);
            }
            else if (response.data.data && Array.isArray(response.data.data)) {
                incomesData = response.data.data;
                console.log('✅ Estructura: response.data.data, cantidad:', incomesData.length);
            }
            else {
                console.warn('⚠️ No se encontró un array de ingresos en la respuesta');
                console.log('Propiedades de response.data:', Object.keys(response.data));
                incomesData = [];
            }

            this.incomes = incomesData || [];
            console.log('Ingresos cargados:', this.incomes.length);

            this.renderDataTable();

            if (this.incomes.length === 0) {
                showAlert('No se encontraron ingresos con los filtros seleccionados', 'info');
            } else {
                showAlert(`Se encontraron ${this.incomes.length} ingresos`, 'info');
            }

        } catch (error) {
            console.error('Error loading incomes:', error);
            console.error('Stack:', error.stack);
            this.incomes = [];
            this.renderDataTable();
            showAlert('Error al cargar los ingresos: ' + (error.message || 'Error desconocido'), 'danger');
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // ✅ Asegurar que this.incomes sea un array
        if (!Array.isArray(this.incomes)) {
            console.warn('this.incomes no es un array:', this.incomes);
            this.incomes = [];
        }

        // Calcular total solo si hay datos
        const total = this.incomes.length > 0 ? this.incomes.reduce((sum, inc) => sum + (parseFloat(inc.amount_base_currency || inc.amount) || 0), 0) : 0;

        const tableData = this.incomes.map(income => {
            const row = [
                income.id,
                formatDate(income.date),
            ];

            if (isSuperAdmin) {
                row.push(income.company_name || '-');
            }

            row.push(
                income.account_name || '-',
                income.payment_method === 'bank' ?
                    '<span class="badge bg-secondary"><i class="bi bi-bank"></i> Banco</span>' :
                    '<span class="badge bg-success"><i class="bi bi-cash"></i> Efectivo</span>',
                income.currency_code || 'VES',
                `${parseFloat(income.amount).toFixed(2)} ${income.currency_code || 'VES'}`,
                income.exchange_rate || 1,
                formatCurrency(parseFloat(income.amount_base_currency || income.amount)),
                income.description || '-',
                income.reference || '-',
                `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-income" data-id="${income.id}" title="Editar ingreso">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-income" data-id="${income.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
            );
            return row;
        });

        // ✅ Si no hay datos, mostrar mensaje
        if (tableData.length === 0) {
            const colCount = isSuperAdmin ? 12 : 11;
            $('#incomeTable').html(`
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    ${isSuperAdmin ? '<th>Empresa</th>' : ''}
                    <th>Cuenta</th>
                    <th>Origen</th>
                    <th>Moneda</th>
                    <th>Monto Original</th>
                    <th>Tasa</th>
                    <th>Monto (Base)</th>
                    <th>Descripción</th>
                    <th>Referencia</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="${colCount}" class="text-center text-muted">No hay ingresos para mostrar</td></tr>
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="${isSuperAdmin ? '8' : '7'}" class="text-end">Total en Moneda Base:</th>
                    <th id="totalAmount" class="text-success">$0.00</th>
                    <th colspan="3"></th>
                </tr>
            </tfoot>
        `);

            document.getElementById('totalAmount').innerHTML = formatCurrency(0);
            return;
        }

        this.dataTable = $('#incomeTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: tableData[0]?.length - 1, orderable: false, searchable: false }
            ],
            dom: 'Bfrtip',
            buttons: [
                { extend: 'copy', text: '<i class="bi bi-files"></i> Copiar', className: 'btn btn-sm btn-secondary me-1' },
                { extend: 'csv', text: '<i class="bi bi-filetype-csv"></i> CSV', className: 'btn btn-sm btn-info me-1' },
                { extend: 'excel', text: '<i class="bi bi-file-excel"></i> Excel', className: 'btn btn-sm btn-success me-1' },
                {
                    text: '<i class="bi bi-file-pdf"></i> PDF Personalizado',
                    className: 'btn btn-sm btn-danger me-1',
                    action: () => this.exportToPDFWithGrouping()
                },
                { extend: 'print', text: '<i class="bi bi-printer"></i> Imprimir', className: 'btn btn-sm btn-secondary me-1' }
            ],
            drawCallback: () => {
                document.getElementById('totalAmount').innerHTML = formatCurrency(total);
                this.attachTableEvents();
            }
        });

        const groupBySelect = document.getElementById('pdfGroupBySelect');
        if (groupBySelect) {
            groupBySelect.addEventListener('change', (e) => {
                this.pdfGroupBy = e.target.value;
            });
        }

        const includeTablesCheckbox = document.getElementById('includeDetailedTables');
        if (includeTablesCheckbox) {
            includeTablesCheckbox.addEventListener('change', (e) => {
                this.includeDetailedTables = e.target.checked;
            });
        }

        this.updateActiveFiltersIndicator();
        this.attachTableEvents();
    },

    exportToPDFWithGrouping() {
        if (!this.incomes || this.incomes.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const showAllCompanies = isSuperAdmin && (!this.filters.company_id || this.filters.company_id === '');

        const filtersInfo = {
            company_name: this.filters.company_id && this.filters.company_id !== '' ?
                this.companies.find(c => c.id == this.filters.company_id)?.name : null,
            year: this.filters.year,
            month_name: this.filters.month && this.filters.month !== '' ?
                this.getMonthName(this.filters.month) : null,
            account_name: this.filters.account_id && this.filters.account_id !== '' ?
                this.accounts.find(a => a.id == this.filters.account_id)?.name : null
        };

        pdfExportService.exportIncomesToPDF(
            this.incomes,
            filtersInfo,
            this.pdfGroupBy,
            isSuperAdmin,
            showAllCompanies,
            this.includeDetailedTables
        );

        const groupByText = this.getGroupByText(this.pdfGroupBy);
        const tablesText = this.includeDetailedTables ? 'con tablas detalladas' : 'solo resumen y gráficos';
        if (showAllCompanies) {
            showAlert(`Exportando PDF agrupado por empresa y luego por ${groupByText} ${tablesText}...`, 'success');
        } else {
            showAlert(`Exportando PDF agrupado por ${groupByText} ${tablesText}...`, 'success');
        }
    },

    getMonthName(monthNumber) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[parseInt(monthNumber) - 1];
    },

    getGroupByText(groupBy) {
        const texts = {
            'week': 'semanas',
            'month': 'meses',
            'quarter': 'trimestres',
            'semester': 'semestres',
            'year': 'años'
        };
        return texts[groupBy] || 'meses';
    },

    showIncomeModal(income = null) {
        const isEdit = !!income;
        const title = isEdit ? 'Editar Ingreso' : 'Nuevo Ingreso';
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        const modalHtml = `
        <div class="modal fade" id="incomeModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-cash-stack"></i> ${title}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="incomeForm">
                            <input type="hidden" id="incomeId" value="${income?.id || ''}">
                            
                            ${isSuperAdmin ? `
                            <div class="row mb-3">
                                <div class="col-md-12">
                                    <label class="form-label required">
                                        <i class="bi bi-building"></i> Empresa
                                    </label>
                                    <select class="form-select" id="incomeCompany" required>
                                        <option value="">Seleccione una empresa</option>
                                        ${this.companies.map(c => `
                                            <option value="${c.id}" ${income?.company_id == c.id ? 'selected' : ''}>
                                                ${c.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small class="text-muted">Seleccione la empresa a la que pertenece este ingreso</small>
                                </div>
                            </div>
                            ` : ''}
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Fecha</label>
                                    <input type="date" class="form-control" id="incomeDate" 
                                           value="${income?.date || new Date().toISOString().split('T')[0]}" required>
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Cuenta de Ingreso</label>
                                    <select class="form-select" id="incomeAccount" required>
                                        <option value="">Seleccione una cuenta</option>
                                        ${this.accounts.filter(acc => acc.type === 'income').map(acc => `
                                            <option value="${acc.id}" ${income?.account_id == acc.id ? 'selected' : ''}>
                                                ${acc.name} ${acc.category ? `(${acc.category})` : ''}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label required">Monto</label>
                                    <input type="number" step="0.01" class="form-control" id="incomeAmount" 
                                           value="${income?.amount || ''}" placeholder="0.00" required>
                                </div>
                                
                                <div class="col-md-4 mb-3">
                                    <label class="form-label required">Moneda</label>
                                    <select class="form-select" id="incomeCurrency" required>
                                        <option value="">Seleccione una moneda</option>
                                        ${this.currencies.map(curr => `
                                            <option value="${curr.id}" 
                                                data-code="${curr.code}"
                                                data-symbol="${curr.symbol}"
                                                ${income?.currency_id == curr.id ? 'selected' : ''}>
                                                ${curr.code} - ${curr.name} (${curr.symbol})
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Tasa de cambio</label>
                                    <div class="input-group">
                                        <span class="input-group-text bg-success text-white">
                                            <i class="bi bi-currency-exchange"></i>
                                        </span>
                                        <input type="text" class="form-control" id="exchangeRateInfo" 
                                               readonly placeholder="Se calculará automáticamente">
                                    </div>
                                    <small class="text-muted" id="rateDateInfo"></small>
                                </div>
                            </div>
                            
                            <div class="alert alert-success mb-3" id="baseAmountInfo" style="display: none;">
                                <i class="bi bi-currency-exchange"></i>
                                <strong>Monto en moneda base (${this.baseCurrency?.code || 'VES'}):</strong>
                                <span id="baseAmountDisplay">0.00</span>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Referencia</label>
                                    <input type="text" class="form-control" id="incomeReference" 
                                           value="${income?.reference || ''}" placeholder="N° de comprobante, factura, etc.">
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Método de Pago</label>
                                    <select class="form-select" id="incomePaymentMethod" required>
                                        <option value="cash" selected>💵 Efectivo</option>
                                        <option value="bank">🏦 Banco</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control" id="incomeDescription" rows="3" 
                                          placeholder="Descripción detallada del ingreso...">${income?.description || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-success" id="saveIncomeBtn">
                            <i class="bi bi-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'} Ingreso
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        const existingModal = document.getElementById('incomeModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        this.setupExchangeRateEvents();

        const modal = new bootstrap.Modal(document.getElementById('incomeModal'));
        modal.show();

        const saveBtn = document.getElementById('saveIncomeBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => await this.saveIncome(income));
        }
    },

    async loadCurrencies() {
        try {
            const response = await api.get('api/currencies');
            if (response.success && response.data) {
                this.currencies = response.data;
                this.baseCurrency = this.currencies.find(c => c.is_base == 1);
                console.log('Monedas cargadas:', this.currencies.length);
                console.log('Moneda base:', this.baseCurrency);
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    },

    async getExchangeRate(fromCurrencyId, toCurrencyId, date) {
        try {
            const response = await api.get(`api/exchange-rates?from=${fromCurrencyId}&to=${toCurrencyId}&date=${date}`);
            if (response.success && response.data && response.data.rate) {
                return { success: true, rate: parseFloat(response.data.rate) };
            }
            return { success: false, rate: null };
        } catch (error) {
            console.error('Error getting exchange rate:', error);
            return { success: false, rate: null };
        }
    },

    setupExchangeRateEvents() {
        const dateInput = document.getElementById('incomeDate');
        const currencySelect = document.getElementById('incomeCurrency');
        const amountInput = document.getElementById('incomeAmount');
        const rateInfo = document.getElementById('exchangeRateInfo');
        const baseAmountSpan = document.getElementById('baseAmountDisplay');
        const baseAmountDiv = document.getElementById('baseAmountInfo');
        const rateDateInfo = document.getElementById('rateDateInfo');

        const updateExchangeRate = async () => {
            const date = dateInput?.value;
            const currencyId = currencySelect?.value;
            const amount = parseFloat(amountInput?.value) || 0;

            if (!date || !currencyId || amount <= 0) {
                if (rateInfo) rateInfo.value = 'Esperando datos...';
                if (baseAmountDiv) baseAmountDiv.style.display = 'none';
                return;
            }

            const selectedCurrency = this.currencies.find(c => c.id == currencyId);

            if (selectedCurrency?.is_base == 1) {
                if (rateInfo) rateInfo.value = '1.00 (Moneda base)';
                if (baseAmountSpan) baseAmountSpan.textContent = amount.toFixed(2);
                if (baseAmountDiv) baseAmountDiv.style.display = 'block';
                if (rateDateInfo) rateDateInfo.textContent = '';
                return;
            }

            const result = await this.getExchangeRate(currencyId, this.baseCurrency?.id, date);

            if (result.success && result.rate) {
                const convertedAmount = amount * result.rate;
                if (rateInfo) rateInfo.value = `${result.rate.toFixed(4)} (${selectedCurrency?.code} → ${this.baseCurrency?.code})`;
                if (baseAmountSpan) baseAmountSpan.textContent = convertedAmount.toFixed(2);
                if (baseAmountDiv) baseAmountDiv.style.display = 'block';
                if (rateDateInfo) rateDateInfo.textContent = `Tasa vigente al ${date}`;
            } else {
                if (rateInfo) rateInfo.value = 'No hay tasa disponible para esta fecha';
                if (baseAmountSpan) baseAmountSpan.textContent = 'Sin conversión';
                if (baseAmountDiv) baseAmountDiv.style.display = 'block';
                if (rateDateInfo) rateDateInfo.textContent = '⚠️ Configure una tasa de cambio para esta fecha';
            }
        };

        if (dateInput) dateInput.addEventListener('change', updateExchangeRate);
        if (currencySelect) currencySelect.addEventListener('change', updateExchangeRate);
        if (amountInput) amountInput.addEventListener('input', updateExchangeRate);
        updateExchangeRate();
    },

    async saveIncome(existingIncome = null) {
        try {
            const user = api.getUser();
            const isSuperAdmin = user?.role === 'super_admin';

            const id = document.getElementById('incomeId')?.value;
            const companyId = isSuperAdmin ? document.getElementById('incomeCompany')?.value : null;
            const date = document.getElementById('incomeDate')?.value;
            const accountId = document.getElementById('incomeAccount')?.value;
            const amount = document.getElementById('incomeAmount')?.value;
            const currencyId = document.getElementById('incomeCurrency')?.value;
            const reference = document.getElementById('incomeReference')?.value;
            const description = document.getElementById('incomeDescription')?.value;
            const paymentMethod = document.getElementById('incomePaymentMethod')?.value;

            if (isSuperAdmin && !companyId) {
                showAlert('Debe seleccionar una empresa', 'warning');
                return;
            }

            if (!date) {
                showAlert('La fecha es requerida', 'warning');
                return;
            }

            if (!accountId) {
                showAlert('Debe seleccionar una cuenta de ingreso', 'warning');
                return;
            }

            if (!amount || parseFloat(amount) <= 0) {
                showAlert('El monto debe ser mayor a 0', 'warning');
                return;
            }

            if (!currencyId) {
                showAlert('Debe seleccionar una moneda', 'warning');
                return;
            }

            if (!paymentMethod) {
                showAlert('El método de pago es requerido', 'warning');
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            if (date > today) {
                showAlert('No se puede registrar un ingreso con fecha futura', 'warning');
                return;
            }

            const incomeData = {
                account_id: parseInt(accountId),
                amount: parseFloat(amount),
                currency_id: parseInt(currencyId),
                date: date,
                reference: reference || null,
                description: description || null,
                payment_method: paymentMethod
            };

            if (isSuperAdmin && companyId) {
                incomeData.company_id = parseInt(companyId);
            }

            let response;

            if (id && id !== '') {
                response = await transactionService.updateIncome(parseInt(id), incomeData);
                if (response.success) {
                    showAlert('Ingreso actualizado exitosamente', 'success');
                    this.loadIncomes();
                    this.closeModal();
                }
            } else {
                response = await transactionService.createIncome(incomeData);
                if (response.success) {
                    showAlert('Ingreso registrado exitosamente', 'success');
                    this.loadIncomes();
                    this.closeModal();
                }
            }

            if (!response.success) {
                showAlert(response.message || 'Error al guardar el ingreso', 'danger');
            }

        } catch (error) {
            console.error('Error en saveIncome:', error);
            showAlert(error.message || 'Error al guardar el ingreso', 'danger');
        }
    },

    closeModal() {
        const modal = document.getElementById('incomeModal');
        if (modal) {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            }
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-income').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const income = this.incomes.find(i => i.id === id);
                if (income) {
                    this.showIncomeModal(income);
                }
            });
        });

        document.querySelectorAll('.delete-income').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const income = this.incomes.find(i => i.id === id);
                if (!income) return;

                const confirmed = confirm(`¿Está seguro de eliminar el ingreso de ${formatCurrency(income.amount)} del ${formatDate(income.date)}?`);
                if (!confirmed) return;

                try {
                    const response = await transactionService.deleteIncome(id);
                    if (response.success) {
                        showAlert('Ingreso eliminado exitosamente', 'success');
                        await this.loadIncomes();
                    } else {
                        showAlert(response.message || 'Error al eliminar el ingreso', 'danger');
                    }
                } catch (error) {
                    console.error('Error al eliminar:', error);
                    showAlert(error.message || 'Error al eliminar el ingreso', 'danger');
                }
            });
        });
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addIncomeBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showIncomeModal());

        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.filters = {
                    company_id: document.getElementById('filterCompany')?.value || '',
                    year: document.getElementById('filterYear')?.value || '',
                    month: document.getElementById('filterMonth')?.value || '',
                    account_id: document.getElementById('filterAccount')?.value || ''
                };
                this.loadIncomes();
            });
        }

        const resetBtn = document.getElementById('resetFiltersBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAllFilters();
            });
        }
    },

    updateActiveFiltersIndicator() {
        const activeFilters = [];

        if (this.filters.company_id && this.filters.company_id !== '') {
            const companyName = this.companies.find(c => c.id == this.filters.company_id)?.name;
            activeFilters.push(`Empresa: ${companyName || this.filters.company_id}`);
        }
        if (this.filters.year && this.filters.year !== '') {
            activeFilters.push(`Año: ${this.filters.year}`);
        }
        if (this.filters.month && this.filters.month !== '') {
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            activeFilters.push(`Mes: ${months[parseInt(this.filters.month) - 1]}`);
        }
        if (this.filters.account_id && this.filters.account_id !== '') {
            const accountName = this.accounts.find(a => a.id == this.filters.account_id)?.name;
            activeFilters.push(`Cuenta: ${accountName || this.filters.account_id}`);
        }

        const existingIndicator = document.querySelector('.active-filters-indicator');
        if (existingIndicator) existingIndicator.remove();

        if (activeFilters.length > 0) {
            const indicatorHtml = `
            <div class="alert alert-success mt-2 active-filters-indicator">
                <i class="bi bi-funnel-fill"></i> <strong>Filtros activos:</strong> ${activeFilters.join(' | ')}
                <button type="button" class="btn-close float-end" id="clearFiltersBtn" aria-label="Cerrar" style="font-size: 0.75rem;"></button>
            </div>
        `;

            const cardBody = document.querySelector('#incomeTable').closest('.card-body');
            if (cardBody) {
                let filterContainer = document.querySelector('.filters-indicator-container');
                if (!filterContainer) {
                    filterContainer = document.createElement('div');
                    filterContainer.className = 'filters-indicator-container';
                    cardBody.insertBefore(filterContainer, cardBody.firstChild);
                }
                filterContainer.innerHTML = indicatorHtml;

                const clearBtn = document.getElementById('clearFiltersBtn');
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        this.resetAllFilters();
                    });
                }
            }
        } else {
            const filterContainer = document.querySelector('.filters-indicator-container');
            if (filterContainer) filterContainer.innerHTML = '';
        }
    },

    resetAllFilters() {
        if (document.getElementById('filterCompany')) {
            document.getElementById('filterCompany').value = '';
        }
        if (document.getElementById('filterYear')) {
            document.getElementById('filterYear').value = '';
        }
        if (document.getElementById('filterMonth')) {
            document.getElementById('filterMonth').value = '';
        }
        if (document.getElementById('filterAccount')) {
            document.getElementById('filterAccount').value = '';
        }

        this.filters = { company_id: '', year: '', month: '', account_id: '' };

        const existingIndicator = document.querySelector('.active-filters-indicator');
        if (existingIndicator) existingIndicator.remove();

        const filterContainer = document.querySelector('.filters-indicator-container');
        if (filterContainer) filterContainer.innerHTML = '';

        this.loadIncomes();
        showAlert('Filtros reiniciados - Mostrando todos los ingresos', 'success');
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};