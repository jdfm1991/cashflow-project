// modules/expense.js
import { transactionService } from '../services/transactionService.js';
import { accountService } from '../services/accountService.js';
import { currencyService } from '../services/currencyService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const expenseModule = {
    expenses: [],
    accounts: [],
    currencies: [],
    baseCurrency: null,
    filters: {
        start_date: '',
        end_date: '',
        account_id: ''
    },
    dataTable: null,

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Registro de Egresos en Efectivo</h1>
                <button class="btn btn-danger" id="addExpenseBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Egreso
                </button>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                Este módulo es exclusivo para registrar egresos en efectivo (billetes/divisas).
                Los egresos bancarios se gestionan desde la Carga Masiva de Estados de Cuenta.
            </div>
            
            <!-- Filtros -->
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label">Fecha desde</label>
                            <input type="date" class="form-control" id="filterStartDate">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Fecha hasta</label>
                            <input type="date" class="form-control" id="filterEndDate">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">Cuenta</label>
                            <select class="form-select" id="filterAccount">
                                <option value="">Todas las cuentas</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-danger w-100" id="applyFilters">
                                <i class="bi bi-search"></i> Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de egresos -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0">Listado de Egresos en Efectivo</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="expenseTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
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
                                <tr><td colspan="11" class="text-center">Cargando...</td></tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="8" class="text-end">Total en Moneda Base:</th>
                                    <th id="totalAmount" class="text-danger">$0.00</th>
                                    <th colspan="2"></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        await this.loadAccounts();
        await this.loadCurrencies();
        await this.loadExpenses();
        this.setupEventListeners();
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

    async loadCurrencies() {
        try {
            const response = await currencyService.getAll();
            if (response.success && response.data) {
                this.currencies = response.data;
                this.baseCurrency = this.currencies.find(c => c.is_base);
                console.log('Monedas cargadas:', this.currencies);
                console.log('Moneda base:', this.baseCurrency);
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    },

    async loadExpenses() {
        try {
            const response = await transactionService.getExpenses(this.filters);
            console.log('Respuesta completa:', response);

            if (response.success && response.data) {
                // Verificar la estructura de los datos
                if (response.data.expenses) {
                    this.expenses = response.data.expenses;
                } else if (Array.isArray(response.data)) {
                    this.expenses = response.data;
                } else {
                    this.expenses = [];
                }

                console.log('Egresos cargados:', this.expenses);
                this.renderDataTable();
            } else {
                console.error('Error en respuesta:', response);
                this.expenses = [];
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
            this.expenses = [];
            this.renderDataTable();
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const total = this.expenses.reduce((sum, inc) => sum + (parseFloat(inc.amount_base_currency || inc.amount) || 0), 0);

        const self = this;

        const tableData = this.expenses.map(expense => {
            const isBankExpense = expense.payment_method === 'bank';

            return [
                expense.id,
                formatDate(expense.date),
                expense.account_name || '-',
                isBankExpense ?
                    '<span class="badge bg-secondary">Banco</span>' :
                    '<span class="badge bg-danger">Efectivo</span>',
                expense.currency_code || 'VES',
                `${parseFloat(expense.amount).toFixed(2)} ${expense.currency_code || 'VES'}`,
                expense.exchange_rate || 1,
                formatCurrency(parseFloat(expense.amount_base_currency || expense.amount)),
                expense.description || '-',
                expense.reference || '-',
                isBankExpense ? `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" disabled title="Egreso bancario - No editable">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-expense" data-id="${expense.id}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                ` : `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary edit-expense" data-id="${expense.id}" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-expense" data-id="${expense.id}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `
            ];
        });

        const totalAmount = this.expenses.reduce((sum, inc) => sum + (parseFloat(inc.amount_base_currency || inc.amount) || 0), 0);

        this.dataTable = $('#expenseTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 10, orderable: false, searchable: false }
            ],
            dom: '<"row"<"col-sm-6"B><"col-sm-6"f>>' +
                '<"row"<"col-sm-12"tr>>' +
                '<"row"<"col-sm-5"i><"col-sm-7"p>>',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] }
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] }
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                    title: 'Egresos_Efectivo',
                    filename: 'Relación_de_egresos_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                    title: 'Reporte de Egresos en Efectivo',
                    filename: 'Relación_de_engresos_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
                    orientation: 'landscape',
                    pageSize: 'A4',
                    customize: function (doc) {
                        // ... configuración del PDF
                    }
                },
                {
                    extend: 'print',
                    text: '<i class="bi bi-printer"></i> Imprimir',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                    title: 'Reporte de Egresos en Efectivo',
                    customize: function (win) {
                        $(win.document.body).find('table').addClass('table table-bordered');
                        $(win.document.body).prepend(`
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h2>FlowControl - Sistema de Flujo de Caja</h2>
                                <h3>Reporte de Egresos en Efectivo</h3>
                                <p>Generado: ${new Date().toLocaleString()}</p>
                                <hr>
                            </div>
                        `);
                    }
                }
            ],
            drawCallback: () => {
                document.getElementById('totalAmount').innerHTML = formatCurrency(total);
                this.attachTableEvents();
            }
        });

        this.attachTableEvents();
    },

    showExpenseModal(expense = null) {
        const isEditing = !!expense;
        const isBankExpense = expense && expense.payment_method === 'bank';
        const today = new Date().toISOString().split('T')[0];

        const modalHtml = `
            <div class="modal fade" id="expenseModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header ${isBankExpense ? 'bg-secondary' : 'bg-danger'} text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-cash"></i> 
                                ${isEditing ? 'Editar Egreso' : 'Nuevo Egreso en Efectivo'}
                                ${isBankExpense ? ' <span class="badge bg-warning text-dark">(Importado de Banco)</span>' : ''}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="expenseForm">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Cuenta *</label>
                                    <select class="form-select" id="expenseAccount" required>
                                        <option value="">Seleccione una cuenta</option>
                                        ${this.accounts.map(acc => `
                                            <option value="${acc.id}" ${expense && expense.account_id === acc.id ? 'selected' : ''}>
                                                ${acc.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Moneda *</label>
                                            <select class="form-select" id="currencyId" ${isBankExpense ? 'disabled' : ''} required>
                                                ${this.currencies.map(c => `
                                                    <option value="${c.id}" data-code="${c.code}" data-symbol="${c.symbol}" 
                                                            ${expense && expense.currency_id === c.id ? 'selected' : ''}>
                                                        ${c.code} - ${c.name} (${c.symbol})
                                                    </option>
                                                `).join('')}
                                            </select>
                                            ${isBankExpense ? '<small class="text-muted">La moneda no se puede modificar en egresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Monto *</label>
                                            <div class="input-group">
                                                <input type="number" class="form-control" id="expenseAmount" 
                                                       step="0.01" value="${expense ? expense.amount : ''}" 
                                                       placeholder="0.00" ${isBankExpense ? 'readonly' : ''} required>
                                                <span class="input-group-text" id="currencySymbol">Bs.</span>
                                            </div>
                                            ${isBankExpense ? '<small class="text-muted">El monto no se puede modificar en egresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Fecha *</label>
                                            <input type="date" class="form-control" id="expenseDate" 
                                                   value="${expense ? expense.date : today}" 
                                                   max="${today}" ${isBankExpense ? 'readonly' : ''} required>
                                            ${isBankExpense ? '<small class="text-muted">La fecha no se puede modificar en egresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Referencia</label>
                                            <input type="text" class="form-control" id="expenseReference" 
                                                   value="${expense ? (expense.reference || '') : ''}"
                                                   placeholder="Recibo #, comprobante, etc."
                                                   ${isBankExpense ? 'readonly' : ''}>
                                            <small class="text-muted">
                                                ${isBankExpense ? 'Referencia del estado de cuenta (no editable)' : 'Opcional - Número de recibo, factura, etc.'}
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Conversión de moneda -->
                                <div id="conversionSection" class="alert alert-info" style="display: none;">
                                    <div class="row align-items-center">
                                        <div class="col-md-4">
                                            <strong>Conversión a moneda base:</strong>
                                        </div>
                                        <div class="col-md-4">
                                            <span id="originalAmountDisplay">$0.00</span>
                                        </div>
                                        <div class="col-md-4">
                                            <span id="convertedAmountDisplay">$0.00</span>
                                        </div>
                                    </div>
                                    <div class="row mt-2">
                                        <div class="col-md-12">
                                            <small class="text-muted" id="exchangeRateDisplay"></small>
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Descripción</label>
                                    <textarea class="form-control" id="expenseDescription" rows="2" 
                                              placeholder="Descripción del egreso...">${expense ? expense.description || '' : ''}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-${isBankExpense ? 'secondary' : 'danger'}" id="saveExpenseBtn" ${isBankExpense ? 'disabled' : ''}>
                                ${isEditing ? 'Actualizar' : 'Guardar'}
                            </button>
                            ${isBankExpense ? '<small class="text-muted ms-2">Los egresos bancarios no se pueden editar</small>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('expenseModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('expenseModal');
        const modal = new bootstrap.Modal(modalElement);

        this.setupModalEvents(modal, isEditing, expense);

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupModalEvents(modal, isEditing, existingExpense) {
        const currencySelect = document.getElementById('currencyId');
        const amountInput = document.getElementById('expenseAmount');
        const conversionSection = document.getElementById('conversionSection');
        const originalAmountDisplay = document.getElementById('originalAmountDisplay');
        const convertedAmountDisplay = document.getElementById('convertedAmountDisplay');
        const exchangeRateDisplay = document.getElementById('exchangeRateDisplay');
        const currencySymbolSpan = document.getElementById('currencySymbol');

        const updateCurrencySymbol = () => {
            const selectedOption = currencySelect.options[currencySelect.selectedIndex];
            const symbol = selectedOption.dataset.symbol || 'Bs.';
            currencySymbolSpan.textContent = symbol;
            this.calculateConversion();
        };

        currencySelect.addEventListener('change', updateCurrencySymbol);
        amountInput.addEventListener('input', () => this.calculateConversion());

        this.calculateConversion = async () => {
            const amount = parseFloat(amountInput.value) || 0;
            const currencyId = currencySelect.value;
            const selectedCurrency = this.currencies.find(c => c.id == currencyId);

            if (this.baseCurrency && selectedCurrency && selectedCurrency.id !== this.baseCurrency.id) {
                conversionSection.style.display = 'block';
                const date = document.getElementById('expenseDate').value;

                originalAmountDisplay.textContent = `${formatCurrency(amount)} ${selectedCurrency.code}`;

                const rate = await this.getExchangeRate(selectedCurrency.code, this.baseCurrency.code, date);

                if (rate && rate > 0) {
                    const convertedAmount = amount * rate;
                    convertedAmountDisplay.textContent = formatCurrency(convertedAmount);
                    exchangeRateDisplay.textContent = `Tasa: 1 ${selectedCurrency.code} = ${formatCurrency(rate)} ${this.baseCurrency.code}`;
                } else {
                    convertedAmountDisplay.textContent = 'No disponible';
                    exchangeRateDisplay.textContent = '⚠️ No se encontró tasa de cambio para esta fecha. Verifique en Tasas de Cambio.';
                    conversionSection.classList.add('alert-warning');
                    conversionSection.classList.remove('alert-info');
                }
            } else {
                conversionSection.style.display = 'none';
                conversionSection.classList.remove('alert-warning');
                conversionSection.classList.add('alert-info');
            }
        };

        updateCurrencySymbol();

        const saveBtn = document.getElementById('saveExpenseBtn');
        saveBtn.addEventListener('click', async () => {
            const accountId = document.getElementById('expenseAccount').value;
            const amount = parseFloat(document.getElementById('expenseAmount').value);
            const date = document.getElementById('expenseDate').value;
            const description = document.getElementById('expenseDescription').value;
            const reference = document.getElementById('expenseReference').value;
            const currencyId = document.getElementById('currencyId').value;

            if (!accountId) {
                showAlert('Seleccione una cuenta', 'warning');
                return;
            }

            if (!amount || amount <= 0) {
                showAlert('Ingrese un monto válido', 'warning');
                return;
            }

            if (!date) {
                showAlert('Seleccione una fecha', 'warning');
                return;
            }

            if (date > new Date().toISOString().split('T')[0]) {
                showAlert('No se puede registrar un egreso con fecha futura', 'warning');
                return;
            }

            const expenseData = {
                account_id: parseInt(accountId),
                amount: amount,
                date: date,
                description: description,
                reference: reference,
                currency_id: parseInt(currencyId),
                payment_method: 'cash'
            };

            if (this.baseCurrency && currencyId && currencyId != this.baseCurrency.id) {
                const rate = await this.getExchangeRate(currencyId, this.baseCurrency.id, date);
                if (rate) {
                    expenseData.exchange_rate = rate;
                    expenseData.amount_base_currency = amount * rate;
                }
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await transactionService.updateExpense(existingExpense.id, expenseData);
                    if (response.success) showAlert('Egreso actualizado exitosamente', 'success');
                } else {
                    response = await transactionService.createExpense(expenseData);
                    if (response.success) showAlert('Egreso registrado exitosamente', 'success');
                }

                modal.hide();
                await this.loadExpenses();

            } catch (error) {
                console.error('Error saving expense:', error);
                showAlert(error.message || 'Error al guardar el egreso', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Guardar';
            }
        });
    },

    async getExchangeRate(fromCurrencyCode, toCurrencyCode, date) {
        try {
            const token = localStorage.getItem('access_token');

            if (!token) {
                console.error('No hay token de autenticación');
                return null;
            }

            const fromCurrency = this.currencies.find(c => c.code === fromCurrencyCode);
            const toCurrency = this.currencies.find(c => c.code === toCurrencyCode);

            if (!fromCurrency || !toCurrency) {
                console.error('Moneda no encontrada:', { fromCurrencyCode, toCurrencyCode });
                return null;
            }

            const url = `http://localhost:8000/api/exchange-rates?from=${fromCurrency.id}&to=${toCurrency.id}&date=${date}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success && data.data && data.data.rate) {
                return parseFloat(data.data.rate);
            }

            if (data.success && data.data && data.data.rate === null) {
                const inverseResponse = await fetch(`http://localhost:8000/api/exchange-rates?from=${toCurrency.id}&to=${fromCurrency.id}&date=${date}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const inverseData = await inverseResponse.json();

                if (inverseData.success && inverseData.data && inverseData.data.rate) {
                    const inverseRate = parseFloat(inverseData.data.rate);
                    return 1 / inverseRate;
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting exchange rate:', error);
            return null;
        }
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-expense').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const expense = this.expenses.find(e => e.id === id);
                if (expense) this.showExpenseModal(expense);
            });
        });

        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const expense = this.expenses.find(e => e.id === id);
                if (!expense) return;

                const confirmed = confirm(`¿Está seguro de eliminar el egreso de ${formatCurrency(expense.amount)} del ${formatDate(expense.date)}?`);
                if (!confirmed) return;

                try {
                    const response = await transactionService.deleteExpense(id);
                    if (response.success) {
                        showAlert('Egreso eliminado exitosamente', 'success');
                        await this.loadExpenses();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar el egreso', 'danger');
                }
            });
        });
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addExpenseBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showExpenseModal());

        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.filters = {
                    start_date: document.getElementById('filterStartDate').value,
                    end_date: document.getElementById('filterEndDate').value,
                    account_id: document.getElementById('filterAccount').value
                };
                this.loadExpenses();
            });
        }

        const filterStart = document.getElementById('filterStartDate');
        const filterEnd = document.getElementById('filterEndDate');
        const filterAccount = document.getElementById('filterAccount');

        if (filterStart) filterStart.addEventListener('change', () => applyFilters?.click());
        if (filterEnd) filterEnd.addEventListener('change', () => applyFilters?.click());
        if (filterAccount) filterAccount.addEventListener('change', () => applyFilters?.click());

        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                if (this.dataTable) this.dataTable.button('.buttons-excel').trigger();
            });
        }

        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => {
                if (this.dataTable) this.dataTable.button('.buttons-pdf').trigger();
            });
        }
    }
};