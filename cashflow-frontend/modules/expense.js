// modules/expense.js - Versión con filtros avanzados

import { transactionService } from '../services/transactionService.js';
import { accountService } from '../services/accountService.js';
import { companyService } from '../services/companyService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';
import { pdfExportService } from '../services/pdfExportService.js';
import { api } from '../services/apiService.js';

export const expenseModule = {
    expenses: [],
    accounts: [],
    companies: [],
    currencies: [],      // ← NUEVO
    baseCurrency: null,  // ← NUEVO
    pdfGroupBy: 'month', // Valor por defecto: agrupar por mes
    includeDetailedTables: true,  // ← Nueva propiedad
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
                <h1 class="h3">Gestión de Egresos</h1>
                <button class="btn btn-danger" id="addExpenseBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Egreso
                </button>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                Los egresos bancarios se gestionan desde la Carga Masiva de Estados de Cuenta.
                Este módulo es exclusivo para egresos en efectivo.
            </div>
            
            <!-- Filtros Avanzados -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-danger text-white">
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
                            <button class="btn btn-danger" id="applyFiltersBtn">
                                <i class="bi bi-search"></i> Buscar
                            </button>
                            <button class="btn btn-secondary ms-2" id="resetFiltersBtn">
                                <i class="bi bi-arrow-repeat"></i> Resetear Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de egresos -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex justify-content-between align-items-center flex-wrap">
                        <h5 class="mb-0">Listado de Egresos</h5>
                        <div class="d-flex gap-3 align-items-center flex-wrap">
                            <!-- Selector de agrupación -->
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
                            
                            <!-- Checkbox para incluir/excluir tablas detalladas -->
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
                        <table id="expenseTable" class="table table-hover table-striped" style="width:100%">
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
                            <tbody id="expenseTableBody">
                                <tr><td colspan="${isSuperAdmin ? '12' : '11'}" class="text-center">Cargando...</td></tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="${isSuperAdmin ? '8' : '7'}" class="text-end">Total en Moneda Base:</th>
                                    <th id="totalAmount" class="text-danger">$0.00</th>
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
        await this.loadExpenses();
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
            // Usar el nuevo service en lugar de api.get directamente
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
            // Si el error es por permisos (no super_admin), simplemente ocultar el selector
            if (error.status === 403) {
                console.log('Usuario no es super_admin, ocultando selector de empresas');
                const filterCompanyDiv = document.getElementById('filterCompany')?.closest('.col-md-3');
                if (filterCompanyDiv) filterCompanyDiv.style.display = 'none';
            }
        }
    },

    async loadAccounts() {
        try {
            const response = await accountService.getAll('expense');
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

    async loadExpenses() {
        try {
            // Construir filtros para la API
            const apiFilters = {};

            // Solo enviar empresa si está seleccionada y no es "todas"
            if (this.filters.company_id && this.filters.company_id !== '') {
                apiFilters.company_id = this.filters.company_id;
            }

            // Solo enviar año si está seleccionado y no es "todos"
            if (this.filters.year && this.filters.year !== '') {
                apiFilters.year = this.filters.year;
            }

            // Solo enviar mes si está seleccionado y no es "todos"
            if (this.filters.month && this.filters.month !== '') {
                apiFilters.month = this.filters.month;
            }

            // Solo enviar cuenta si está seleccionada
            if (this.filters.account_id && this.filters.account_id !== '') {
                apiFilters.account_id = this.filters.account_id;
            }

            console.log('Filtros aplicados:', apiFilters); // Para depuración

            const response = await transactionService.getExpenses(apiFilters);

            if (response.success && response.data) {
                this.expenses = response.data.expenses || response.data;
                this.renderDataTable();

                // Mostrar mensaje con los resultados
                const totalRegistros = this.expenses.length;
                showAlert(`Se encontraron ${totalRegistros} egresos`, 'info');
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
            showAlert('Error al cargar los egresos', 'danger');
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // Calcular total
        const total = this.expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount_base_currency || exp.amount) || 0), 0);

        const tableData = this.expenses.map(expense => {
            const isBankExpense = expense.payment_method === 'bank';
            const row = [
                expense.id,
                formatDate(expense.date),
            ];

            if (isSuperAdmin) {
                row.push(expense.company_name || '-');
            }

            row.push(
                expense.account_name || '-',
                isBankExpense ?
                    '<span class="badge bg-secondary"><i class="bi bi-bank"></i> Banco</span>' :
                    '<span class="badge bg-danger"><i class="bi bi-cash"></i> Efectivo</span>',
                expense.currency_code || 'VES',
                `${parseFloat(expense.amount).toFixed(2)} ${expense.currency_code || 'VES'}`,
                expense.exchange_rate || 1,
                formatCurrency(parseFloat(expense.amount_base_currency || expense.amount)),
                expense.description || '-',
                expense.reference || '-',
                isBankExpense ? `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning edit-expense" data-id="${expense.id}" title="Editar descripción (solo descripción)">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-expense" data-id="${expense.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            ` : `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-expense" data-id="${expense.id}" title="Editar egreso">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-expense" data-id="${expense.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
            );
            return row;
        });

        this.dataTable = $('#expenseTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[2, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: tableData[0]?.length - 1, orderable: false, searchable: false }
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1'
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1'
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1'
                },
                {
                    // Reemplazar el botón de PDF original con uno personalizado
                    text: '<i class="bi bi-file-pdf"></i> PDF Personalizado',
                    className: 'btn btn-sm btn-danger me-1',
                    action: () => this.exportToPDFWithGrouping()
                },
                {
                    extend: 'print',
                    text: '<i class="bi bi-printer"></i> Imprimir',
                    className: 'btn btn-sm btn-secondary me-1'
                }
            ],
            drawCallback: () => {
                document.getElementById('totalAmount').innerHTML = formatCurrency(total);
                this.attachTableEvents();
            }
        });

        // Agregar evento al selector de agrupación
        const groupBySelect = document.getElementById('pdfGroupBySelect');
        if (groupBySelect) {
            groupBySelect.addEventListener('change', (e) => {
                this.pdfGroupBy = e.target.value;
            });
        }

        // ✅ Agregar evento al checkbox
        const includeTablesCheckbox = document.getElementById('includeDetailedTables');
        if (includeTablesCheckbox) {
            includeTablesCheckbox.addEventListener('change', (e) => {
                this.includeDetailedTables = e.target.checked;
            });
        }

        // ✅ Actualizar el indicador de filtros activos DESPUÉS de renderizar la tabla
        this.updateActiveFiltersIndicator();

        this.attachTableEvents();
    },

    // Nuevo método para exportar a PDF con agrupación
    exportToPDFWithGrouping() {
        if (!this.expenses || this.expenses.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';

        // Determinar si está mostrando todas las empresas
        const showAllCompanies = isSuperAdmin && (!this.filters.company_id || this.filters.company_id === '');

        // Preparar información de filtros para el PDF
        const filtersInfo = {
            company_name: this.filters.company_id && this.filters.company_id !== '' ?
                this.companies.find(c => c.id == this.filters.company_id)?.name : null,
            year: this.filters.year,
            month_name: this.filters.month && this.filters.month !== '' ?
                this.getMonthName(this.filters.month) : null,
            account_name: this.filters.account_id && this.filters.account_id !== '' ?
                this.accounts.find(a => a.id == this.filters.account_id)?.name : null
        };

        // Exportar usando el servicio
        pdfExportService.exportExpensesToPDF(
            this.expenses,
            filtersInfo,
            this.pdfGroupBy,
            isSuperAdmin,
            showAllCompanies,  // ← Nuevo parámetro
            this.includeDetailedTables  // ← Nuevo parámetro
        );

        const groupByText = this.getGroupByText(this.pdfGroupBy);
        const tablesText = this.includeDetailedTables ? 'con tablas detalladas' : 'solo resumen y gráficos';
        if (showAllCompanies) {
            showAlert(`Exportando PDF agrupado por empresa y luego por ${groupByText} ${tablesText}...`, 'success');
        } else {
            showAlert(`Exportando PDF agrupado por ${groupByText} ${tablesText}...`, 'success');
        }
    },

    // Método auxiliar para obtener nombre del mes
    getMonthName(monthNumber) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[parseInt(monthNumber) - 1];
    },

    // Método auxiliar para obtener texto de agrupación
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

    // Metodo para mostrar modal de edición de egreso
    showExpenseModal(expense = null) {
        const isEdit = !!expense;
        const isBankExpense = expense?.payment_method === 'bank';
        const title = isEdit ? (isBankExpense ? 'Editar Descripción - Egreso Bancario' : 'Editar Egreso') : 'Nuevo Egreso';

        // Para edición de egreso bancario, solo mostramos el campo de descripción
        if (isEdit && isBankExpense) {
            this.showBankExpenseEditModal(expense);
            return;
        }

        // Para nuevo egreso o egreso en efectivo, mostrar modal completo
        this.showFullExpenseModal(expense);
    },

    /**
    * Modal simplificado para editar solo la descripción de egresos bancarios
    */
    showBankExpenseEditModal(expense) {
        const modalHtml = `
        <div class="modal fade" id="expenseModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning text-dark">
                        <h5 class="modal-title">
                            <i class="bi bi-pencil-square"></i> Editar Descripción - Egreso Bancario
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-3">
                            <i class="bi bi-info-circle"></i>
                            <strong>Información del egreso bancario:</strong><br>
                            Este egreso fue importado desde un estado de cuenta bancario.
                            Solo puede editar la descripción. Los demás campos son de solo lectura.
                        </div>
                        
                        <input type="hidden" id="expenseId" value="${expense.id}">
                        
                        <!-- Información de solo lectura -->
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Fecha</label>
                                <div class="form-control-plaintext">
                                    <strong>${formatDate(expense.date)}</strong>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Cuenta</label>
                                <div class="form-control-plaintext">
                                    <strong>${expense.account_name || '-'}</strong>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Monto</label>
                                <div class="form-control-plaintext">
                                    <strong>${parseFloat(expense.amount).toFixed(2)} ${expense.currency_code || 'VES'}</strong>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Monto en moneda base</label>
                                <div class="form-control-plaintext">
                                    <strong>${formatCurrency(expense.amount_base_currency || expense.amount)}</strong>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Referencia</label>
                                <div class="form-control-plaintext">
                                    <strong>${expense.reference || '-'}</strong>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-muted">Método de pago</label>
                                <div class="form-control-plaintext">
                                    <span class="badge bg-secondary">🏦 Banco</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Campo editable: descripción -->
                        <div class="mb-3">
                            <label class="form-label required">
                                <i class="bi bi-textarea"></i> Descripción
                            </label>
                            <textarea class="form-control" id="expenseDescription" rows="4" 
                                      placeholder="Edite la descripción del egreso bancario...">${expense.description || ''}</textarea>
                            <small class="text-muted">Este es el único campo que puede editar.</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-warning" id="saveBankExpenseBtn">
                            <i class="bi bi-save"></i> Guardar Descripción
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        // Remover modal existente
        const existingModal = document.getElementById('expenseModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('expenseModal'));
        modal.show();

        // Configurar evento de guardar para egreso bancario
        const saveBtn = document.getElementById('saveBankExpenseBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.updateBankExpenseDescription(expense);
            });
        }
    },

    /**
    * Actualizar solo la descripción de un egreso bancario
    */
    async updateBankExpenseDescription(expense) {
        try {
            const id = expense.id;
            const description = document.getElementById('expenseDescription')?.value;

            const expenseData = {
                description: description || null
            };

            const response = await transactionService.updateExpense(id, expenseData);

            if (response.success) {
                showAlert('Descripción del egreso bancario actualizada exitosamente', 'success');
                await this.loadExpenses(); // Recargar la tabla
                this.closeModal();
            } else {
                showAlert(response.message || 'Error al actualizar la descripción', 'danger');
            }

        } catch (error) {
            console.error('Error en updateBankExpenseDescription:', error);
            showAlert(error.message || 'Error al actualizar la descripción', 'danger');
        }
    },

    /**
    * Modal completo para nuevo egreso o egreso en efectivo
    */
    showFullExpenseModal(expense = null) {
        const isEdit = !!expense;
        const title = isEdit ? 'Editar Egreso en Efectivo' : 'Nuevo Egreso';

        const modalHtml = `
        <div class="modal fade" id="expenseModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-cash-stack"></i> ${title}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="expenseForm">
                            <input type="hidden" id="expenseId" value="${expense?.id || ''}">
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Fecha</label>
                                    <input type="date" class="form-control" id="expenseDate" 
                                           value="${expense?.date || new Date().toISOString().split('T')[0]}" required>
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Cuenta de Egreso</label>
                                    <select class="form-select" id="expenseAccount" required>
                                        <option value="">Seleccione una cuenta</option>
                                        ${this.accounts.filter(acc => acc.type === 'expense').map(acc => `
                                            <option value="${acc.id}" ${expense?.account_id == acc.id ? 'selected' : ''}>
                                                ${acc.name} ${acc.category ? `(${acc.category})` : ''}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label required">Monto</label>
                                    <input type="number" step="0.01" class="form-control" id="expenseAmount" 
                                           value="${expense?.amount || ''}" placeholder="0.00" required>
                                </div>
                                
                                <div class="col-md-4 mb-3">
                                    <label class="form-label required">Moneda</label>
                                    <select class="form-select" id="expenseCurrency" required>
                                        <option value="">Seleccione una moneda</option>
                                        ${this.currencies.map(curr => `
                                            <option value="${curr.id}" 
                                                data-code="${curr.code}"
                                                data-symbol="${curr.symbol}"
                                                ${expense?.currency_id == curr.id ? 'selected' : ''}>
                                                ${curr.code} - ${curr.name} (${curr.symbol})
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="col-md-4 mb-3">
                                    <label class="form-label">Tasa de cambio</label>
                                    <div class="input-group">
                                        <span class="input-group-text">
                                            <i class="bi bi-currency-exchange"></i>
                                        </span>
                                        <input type="text" class="form-control" id="exchangeRateInfo" 
                                               readonly placeholder="Se calculará automáticamente">
                                    </div>
                                    <small class="text-muted" id="rateDateInfo"></small>
                                </div>
                            </div>
                            
                            <div class="alert alert-secondary mb-3" id="baseAmountInfo" style="display: none;">
                                <i class="bi bi-currency-exchange"></i>
                                <strong>Monto en moneda base (${this.baseCurrency?.code || 'VES'}):</strong>
                                <span id="baseAmountDisplay">0.00</span>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Referencia</label>
                                    <input type="text" class="form-control" id="expenseReference" 
                                           value="${expense?.reference || ''}" placeholder="N° de comprobante, factura, etc.">
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label required">Método de Pago</label>
                                    <select class="form-select" id="expensePaymentMethod" required>
                                        <option value="cash" ${expense?.payment_method === 'cash' || !expense ? 'selected' : ''}>
                                            💵 Efectivo
                                        </option>
                                        <option value="bank" ${expense?.payment_method === 'bank' ? 'selected' : ''} 
                                                ${expense?.id ? 'disabled' : ''}>
                                            🏦 Banco (Solo lectura - gestión desde estados de cuenta)
                                        </option>
                                    </select>
                                    ${expense?.id && expense?.payment_method === 'bank' ?
                '<small class="text-muted">Los egresos bancarios solo permiten editar la descripción.</small>' :
                '<small class="text-muted">Los egresos bancarios se gestionan desde la carga de estados de cuenta</small>'}
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control" id="expenseDescription" rows="3" 
                                          placeholder="Descripción detallada del egreso...">${expense?.description || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-danger" id="saveExpenseBtn">
                            <i class="bi bi-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'} Egreso
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        // Remover modal existente
        const existingModal = document.getElementById('expenseModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Configurar eventos para tasa de cambio
        this.setupExchangeRateEvents();

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('expenseModal'));
        modal.show();

        // Configurar guardar
        const saveBtn = document.getElementById('saveExpenseBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => await this.saveExpense(expense));
        }
    },

    /**
     * Cargar monedas disponibles
     */
    async loadCurrencies() {
        try {
            const response = await api.get('api/currencies');
            if (response.success && response.data) {
                this.currencies = response.data;
                // Encontrar moneda base
                this.baseCurrency = this.currencies.find(c => c.is_base == 1);
                console.log('Monedas cargadas:', this.currencies.length);
                console.log('Moneda base:', this.baseCurrency);
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    },

    /**
    * Obtener tasa de cambio en tiempo real
    */
    async getExchangeRate(fromCurrencyId, toCurrencyId, date) {
        try {
            const response = await api.get(`api/exchange-rates?from=${fromCurrencyId}&to=${toCurrencyId}&date=${date}`);
            if (response.success && response.data && response.data.rate) {
                return {
                    success: true,
                    rate: parseFloat(response.data.rate)
                };
            }
            return { success: false, rate: null };
        } catch (error) {
            console.error('Error getting exchange rate:', error);
            return { success: false, rate: null };
        }
    },

    /**
    * Configurar eventos para obtener tasa de cambio en tiempo real
    */
    setupExchangeRateEvents() {
        const dateInput = document.getElementById('expenseDate');
        const currencySelect = document.getElementById('expenseCurrency');
        const amountInput = document.getElementById('expenseAmount');
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

            // Obtener moneda seleccionada
            const selectedCurrency = this.currencies.find(c => c.id == currencyId);

            // Si es moneda base, no hay conversión
            if (selectedCurrency?.is_base == 1) {
                if (rateInfo) rateInfo.value = '1.00 (Moneda base)';
                if (baseAmountSpan) baseAmountSpan.textContent = amount.toFixed(2);
                if (baseAmountDiv) baseAmountDiv.style.display = 'block';
                if (rateDateInfo) rateDateInfo.textContent = '';
                return;
            }

            // Buscar tasa de cambio
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

        // Agregar eventos
        if (dateInput) dateInput.addEventListener('change', updateExchangeRate);
        if (currencySelect) currencySelect.addEventListener('change', updateExchangeRate);
        if (amountInput) amountInput.addEventListener('input', updateExchangeRate);

        // Ejecutar una vez para inicializar
        updateExchangeRate();
    },

    /**
     * Guardar o actualizar egreso
     */
    async saveExpense(existingExpense = null) {
        try {
            const id = document.getElementById('expenseId')?.value;
            const date = document.getElementById('expenseDate')?.value;
            const accountId = document.getElementById('expenseAccount')?.value;
            const amount = document.getElementById('expenseAmount')?.value;
            const currencyId = document.getElementById('expenseCurrency')?.value;
            const reference = document.getElementById('expenseReference')?.value;
            const description = document.getElementById('expenseDescription')?.value;
            const paymentMethod = document.getElementById('expensePaymentMethod')?.value;

            // Validaciones
            if (!date) {
                showAlert('La fecha es requerida', 'warning');
                return;
            }

            if (!accountId) {
                showAlert('Debe seleccionar una cuenta de egreso', 'warning');
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

            // Validar fecha futura
            const today = new Date().toISOString().split('T')[0];
            if (date > today) {
                showAlert('No se puede registrar un egreso con fecha futura', 'warning');
                return;
            }

            const expenseData = {
                account_id: parseInt(accountId),
                amount: parseFloat(amount),
                currency_id: parseInt(currencyId),  // ← NUEVO
                date: date,
                reference: reference || null,
                description: description || null,
                payment_method: paymentMethod
            };

            let response;

            if (id && id !== '') {
                response = await transactionService.updateExpense(parseInt(id), expenseData);
                if (response.success) {
                    showAlert('Egreso actualizado exitosamente', 'success');
                    this.loadExpenses();
                    this.closeModal();
                }
            } else {
                response = await transactionService.createExpense(expenseData);
                if (response.success) {
                    showAlert('Egreso registrado exitosamente', 'success');
                    this.loadExpenses();
                    this.closeModal();
                }
            }

            if (!response.success) {
                showAlert(response.message || 'Error al guardar el egreso', 'danger');
            }

        } catch (error) {
            console.error('Error en saveExpense:', error);
            showAlert(error.message || 'Error al guardar el egreso', 'danger');
        }
    },
    
    /**
     * Cerrar el modal
     */
    closeModal() {
        const modal = document.getElementById('expenseModal');
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

    /**
    * Adjuntar eventos de la tabla (editar/eliminar)
    */
    attachTableEvents() {
        // Eventos de edición
        document.querySelectorAll('.edit-expense').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const expense = this.expenses.find(e => e.id === id);
                if (expense) {
                    // Verificar si es egreso bancario
                    if (expense.payment_method === 'bank') {
                        // Mostrar modal de edición limitada
                        this.showBankExpenseEditModal(expense);
                    } else {
                        this.showFullExpenseModal(expense);
                    }
                }
            });
        });

        // Eventos de eliminación (mantener igual)
        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const expense = this.expenses.find(e => e.id === id);
                if (!expense) return;

                const isBankExpense = expense.payment_method === 'bank';
                const warningMsg = isBankExpense ?
                    `⚠️ ADVERTENCIA: Este es un egreso bancario (importado desde estado de cuenta).\n\n¿Está seguro de eliminarlo? Esta acción no se puede deshacer.` :
                    `¿Está seguro de eliminar el egreso de ${formatCurrency(expense.amount)} del ${formatDate(expense.date)}?`;

                const confirmed = confirm(warningMsg);
                if (!confirmed) return;

                try {
                    const response = await transactionService.deleteExpense(id);
                    if (response.success) {
                        showAlert('Egreso eliminado exitosamente', 'success');
                        await this.loadExpenses();
                    } else {
                        showAlert(response.message || 'Error al eliminar el egreso', 'danger');
                    }
                } catch (error) {
                    console.error('Error al eliminar:', error);
                    showAlert(error.message || 'Error al eliminar el egreso', 'danger');
                }
            });
        });
    },

    // Función para configurar los event listeners
    setupEventListeners() {
        const addBtn = document.getElementById('addExpenseBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showExpenseModal());

        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                // Obtener valores actuales de los selects
                this.filters = {
                    company_id: document.getElementById('filterCompany')?.value || '',
                    year: document.getElementById('filterYear')?.value || '',
                    month: document.getElementById('filterMonth')?.value || '',
                    account_id: document.getElementById('filterAccount')?.value || ''
                };
                this.loadExpenses();
            });
        }

        const resetBtn = document.getElementById('resetFiltersBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAllFilters();
            });
        }
    },

    // Función para actualizar el indicador visual
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

        // 🔴 IMPORTANTE: Eliminar el indicador existente ANTES de crear uno nuevo
        const existingIndicator = document.querySelector('.active-filters-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // Si hay filtros activos, crear el nuevo indicador
        if (activeFilters.length > 0) {
            const indicatorHtml = `
            <div class="alert alert-secondary mt-2 active-filters-indicator">
                <i class="bi bi-funnel-fill"></i> <strong>Filtros activos:</strong> ${activeFilters.join(' | ')}
                <button type="button" class="btn-close float-end" id="clearFiltersBtn" aria-label="Cerrar" style="font-size: 0.75rem;"></button>
            </div>
        `;

            // Buscar el contenedor adecuado para insertar el indicador
            const cardBody = document.querySelector('#expenseTable').closest('.card-body');
            if (cardBody) {
                // Buscar si ya hay un contenedor de filtros activos
                let filterContainer = document.querySelector('.filters-indicator-container');

                if (!filterContainer) {
                    filterContainer = document.createElement('div');
                    filterContainer.className = 'filters-indicator-container';
                    // Insertar al principio del card-body
                    cardBody.insertBefore(filterContainer, cardBody.firstChild);
                }

                filterContainer.innerHTML = indicatorHtml;

                // Agregar evento para limpiar filtros desde el botón de cerrar
                const clearBtn = document.getElementById('clearFiltersBtn');
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        this.resetAllFilters();
                    });
                }
            }
        } else {
            // Si no hay filtros activos, asegurarse de que el contenedor esté vacío
            const filterContainer = document.querySelector('.filters-indicator-container');
            if (filterContainer) {
                filterContainer.innerHTML = '';
            }
        }
    },

    // Función para resetear todos los filtros
    resetAllFilters() {
        // Resetear selects
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

        // Resetear objeto de filtros
        this.filters = {
            company_id: '',
            year: '',
            month: '',
            account_id: ''
        };

        // Eliminar el indicador visual
        const existingIndicator = document.querySelector('.active-filters-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // Limpiar el contenedor
        const filterContainer = document.querySelector('.filters-indicator-container');
        if (filterContainer) {
            filterContainer.innerHTML = '';
        }

        // Recargar los datos
        this.loadExpenses();

        showAlert('Filtros reiniciados - Mostrando todos los egresos', 'success');
    },

    // Función para escapar HTML y prevenir inyección
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};