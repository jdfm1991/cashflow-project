import { api } from '../services/apiService.js';
import { transactionService } from '../services/transactionService.js';
import { accountService } from '../services/accountService.js';
import { currencyService } from '../services/currencyService.js';
import { formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const incomeModule = {
    incomes: [],
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
                <h1 class="h3">Registro de Ingresos en Efectivo</h1>
                <button class="btn btn-primary" id="addIncomeBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Ingreso
                </button>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                Este módulo es exclusivo para registrar ingresos en efectivo (billetes/divisas).
                Los ingresos bancarios se gestionan desde la Carga Masiva de Estados de Cuenta.
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
                            <button class="btn btn-primary w-100" id="applyFilters">
                                <i class="bi bi-search"></i> Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tabla de ingresos -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Listado de Ingresos en Efectivo</h5>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="incomeTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
                                    <th>Cuenta</th>
                                    <th>Origen</th>        <!-- Nueva columna -->
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
                                <tr><td colspan="10" class="text-center">Cargando...</td></tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th colspan="8" class="text-end">Total en Moneda Base:</th>
                                    <th id="totalAmount" class="text-success">$0.00</th>
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
        await this.loadIncomes();
        this.setupEventListeners();
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

    async loadCurrencies() {
        try {
            const response = await currencyService.getAll();
            if (response.success && response.data) {
                this.currencies = response.data;
                this.baseCurrency = this.currencies.find(c => c.is_base);
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    },

    async loadIncomes() {
        try {
            const response = await transactionService.getIncomes(this.filters);
            if (response.success && response.data) {
                this.incomes = response.data.incomes || response.data;
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading incomes:', error);
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const total = this.incomes.reduce((sum, inc) => sum + (parseFloat(inc.amount_base_currency || inc.amount) || 0), 0);

        const self = this;

        // ✅ Asegurar que la variable se llama 'income' dentro del map
        const tableData = this.incomes.map(income => {
            const isBankIncome = income.payment_method === 'bank';

            return [
                income.id,
                formatDate(income.date),
                income.account_name || '-',
                isBankIncome ?
                    '<span class="badge bg-secondary">Banco</span>' :
                    '<span class="badge bg-success">Efectivo</span>',
                income.currency_code || 'VES',
                `${parseFloat(income.amount).toFixed(2)} ${income.currency_code || 'VES'}`,
                income.exchange_rate || 1,
                formatCurrency(parseFloat(income.amount_base_currency || income.amount)),
                income.description || '-',
                income.reference || '-',
                isBankIncome ? `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" disabled title="Ingreso bancario - No editable">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-income" data-id="${income.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            ` : `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-income" data-id="${income.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-income" data-id="${income.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
            ];
        });

        // Calcular total para el PDF
        const totalAmount = this.incomes.reduce((sum, inc) => sum + (parseFloat(inc.amount_base_currency || inc.amount) || 0), 0);

        this.dataTable = $('#incomeTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 10, orderable: false, searchable: false }  // Índice actualizado
            ],
            dom: '<"row"<"col-sm-6"B><"col-sm-6"f>>' +
                '<"row"<"col-sm-12"tr>>' +
                '<"row"<"col-sm-5"i><"col-sm-7"p>>',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] }  // ✅ AQUÍ
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] }  // ✅ AQUÍ
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },  // ✅ AQUÍ
                    title: 'Ingresos_Efectivo',
                    filename: 'Relación_de_ingresos_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },  // ✅ AQUÍ
                    title: 'Reporte de Ingresos en Efectivo',
                    filename: 'Relación_de_ingresos_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
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
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8, 9] },  // ✅ AQUÍ
                    title: 'Reporte de Ingresos en Efectivo',
                    customize: function (win) {
                        // ... configuración de impresión
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

    showIncomeModal(income = null) {
        const isEditing = !!income;
        const today = new Date().toISOString().split('T')[0];
        const isBankIncome = income && income.payment_method === 'bank'; // Si viene de carga masiva

        // Determinar si la referencia debe ser editable
        const isReferenceEditable = !isBankIncome; // Solo editable si NO es de banco

        const modalHtml = `
            <div class="modal fade" id="incomeModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header ${isBankIncome ? 'bg-secondary' : 'bg-success'} text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-cash-stack"></i> 
                                ${isEditing ? 'Editar Ingreso' : 'Nuevo Ingreso en Efectivo'}
                                ${isBankIncome ? ' <span class="badge bg-warning text-dark">(Importado de Banco)</span>' : ''}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="incomeForm">
                                <!-- Cuenta (siempre editable) -->
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Cuenta *</label>
                                    <select class="form-select" id="incomeAccount" required>
                                        <option value="">Seleccione una cuenta</option>
                                        ${this.accounts.map(acc => `
                                            <option value="${acc.id}" ${income && income.account_id === acc.id ? 'selected' : ''}>
                                                ${acc.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                
                                <!-- Moneda y Monto -->
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Moneda *</label>
                                            <select class="form-select" id="currencyId" ${isBankIncome ? 'disabled' : ''} required>
                                                ${this.currencies.map(c => `
                                                    <option value="${c.id}" data-code="${c.code}" data-symbol="${c.symbol}" 
                                                            ${income && income.currency_id === c.id ? 'selected' : ''}>
                                                        ${c.code} - ${c.name} (${c.symbol})
                                                    </option>
                                                `).join('')}
                                            </select>
                                            ${isBankIncome ? '<small class="text-muted">La moneda no se puede modificar en ingresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Monto *</label>
                                            <div class="input-group">
                                                <input type="number" class="form-control" id="incomeAmount" 
                                                    step="0.01" value="${income ? income.amount : ''}" 
                                                    placeholder="0.00" ${isBankIncome ? 'readonly' : ''} required>
                                                <span class="input-group-text" id="currencySymbol">Bs.</span>
                                            </div>
                                            ${isBankIncome ? '<small class="text-muted">El monto no se puede modificar en ingresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                </div>

                                <!-- Fecha y Referencia -->
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Fecha *</label>
                                            <input type="date" class="form-control" id="incomeDate" 
                                                value="${income ? income.date : today}" 
                                                max="${today}" ${isBankIncome ? 'readonly' : ''} required>
                                            ${isBankIncome ? '<small class="text-muted">La fecha no se puede modificar en ingresos bancarios</small>' : ''}
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Referencia</label>
                                            <input type="text" class="form-control" id="incomeReference" 
                                                value="${income ? (income.reference || '') : ''}"
                                                placeholder="Recibo #, comprobante, etc."
                                                ${isBankIncome ? 'readonly' : ''}>
                                            <small class="text-muted">
                                                ${isBankIncome ? 'Referencia del estado de cuenta (no editable)' : 'Opcional - Número de recibo, factura, etc.'}
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <!-- Conversión de moneda (solo visible si aplica) -->
                                <div id="conversionSection" class="alert alert-info" style="display: none;">
                                    <!-- ... contenido de conversión ... -->
                                </div>

                                <!-- Descripción -->
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">Descripción</label>
                                    <textarea class="form-control" id="incomeDescription" rows="2" 
                                            placeholder="Descripción del ingreso...">${income ? income.description || '' : ''}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-${isBankIncome ? 'secondary' : 'success'}" id="saveIncomeBtn" ${isBankIncome ? 'disabled' : ''}>
                                ${isEditing ? 'Actualizar' : 'Guardar'}
                            </button>
                            ${isBankIncome ? '<small class="text-muted ms-2">Los ingresos bancarios no se pueden editar</small>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('incomeModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('incomeModal');
        const modal = new bootstrap.Modal(modalElement);

        this.setupModalEvents(modal, isEditing, income);

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupModalEvents(modal, isEditing, existingIncome) {
        const currencySelect = document.getElementById('currencyId');
        const amountInput = document.getElementById('incomeAmount');
        const conversionSection = document.getElementById('conversionSection');
        const originalAmountDisplay = document.getElementById('originalAmountDisplay');
        const convertedAmountDisplay = document.getElementById('convertedAmountDisplay');
        const exchangeRateDisplay = document.getElementById('exchangeRateDisplay');
        const currencySymbolSpan = document.getElementById('currencySymbol');

        // Actualizar símbolo de moneda al cambiar
        const updateCurrencySymbol = () => {
            const selectedOption = currencySelect.options[currencySelect.selectedIndex];
            const symbol = selectedOption.dataset.symbol || 'Bs.';
            currencySymbolSpan.textContent = symbol;
            this.calculateConversion();
        };

        currencySelect.addEventListener('change', updateCurrencySymbol);
        amountInput.addEventListener('input', () => this.calculateConversion());

        // Método para calcular conversión
        this.calculateConversion = async () => {
            const amount = parseFloat(amountInput.value) || 0;
            const currencyId = parseInt(currencySelect.value);
            const selectedCurrency = this.currencies.find(c => c.id === currencyId);

            console.log('Calculando conversión:', {
                amount,
                currencyId,
                selectedCurrency,
                baseCurrency: this.baseCurrency
            });

            if (this.baseCurrency && selectedCurrency && selectedCurrency.id !== this.baseCurrency.id) {
                conversionSection.style.display = 'block';
                const date = document.getElementById('incomeDate').value;

                originalAmountDisplay.textContent = `${formatCurrency(amount)} ${selectedCurrency.code}`;

                // ✅ Usar códigos de moneda
                const rate = await this.getExchangeRate(selectedCurrency.code, this.baseCurrency.code, date);
                console.log('Tasa obtenida:', rate);

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

        // Inicializar
        updateCurrencySymbol();

        // Guardar ingreso
        const saveBtn = document.getElementById('saveIncomeBtn');
        saveBtn.addEventListener('click', async () => {
            const accountId = document.getElementById('incomeAccount').value;
            const amount = parseFloat(document.getElementById('incomeAmount').value);
            const date = document.getElementById('incomeDate').value;
            const description = document.getElementById('incomeDescription').value;
            const reference = document.getElementById('incomeReference').value;
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
                showAlert('No se puede registrar un ingreso con fecha futura', 'warning');
                return;
            }

            const incomeData = {
                account_id: parseInt(accountId),
                amount: amount,
                date: date,
                description: description,
                reference: reference,
                currency_id: parseInt(currencyId),
                payment_method: 'cash'  // Efectivo
            };

            // Calcular conversión
            if (this.baseCurrency && currencyId && currencyId != this.baseCurrency.id) {
                const rate = await this.getExchangeRate(currencyId, this.baseCurrency.id, date);
                if (rate) {
                    incomeData.exchange_rate = rate;
                    incomeData.amount_base_currency = amount * rate;
                }
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await transactionService.updateIncome(existingIncome.id, incomeData);
                    if (response.success) showAlert('Ingreso actualizado exitosamente', 'success');
                } else {
                    response = await transactionService.createIncome(incomeData);
                    if (response.success) showAlert('Ingreso registrado exitosamente', 'success');
                }

                modal.hide();
                await this.loadIncomes();

            } catch (error) {
                console.error('Error saving income:', error);
                showAlert(error.message || 'Error al guardar el ingreso', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Guardar';
            }
        });
    },

    async getExchangeRate(fromCurrencyCode, toCurrencyCode, date) {
        try {
            console.log(`Consultando tasa: ${fromCurrencyCode} -> ${toCurrencyCode} fecha: ${date}`);

            // Obtener IDs de las monedas
            const fromCurrency = this.currencies.find(c => c.code === fromCurrencyCode);
            const toCurrency = this.currencies.find(c => c.code === toCurrencyCode);

            if (!fromCurrency || !toCurrency) {
                console.error('Moneda no encontrada:', { fromCurrencyCode, toCurrencyCode });
                return null;
            }

            // Usar el servicio api que ya incluye el token
            const response = await api.get(`api/exchange-rates?from=${fromCurrency.id}&to=${toCurrency.id}&date=${date}`);

            console.log('Respuesta de tasa:', response);

            if (response.success && response.data && response.data.rate) {
                return parseFloat(response.data.rate);
            }

            // Si no encuentra, intentar la tasa inversa
            if (response.success && response.data && response.data.rate === null) {
                console.log('Tasa no encontrada, intentando inversa...');
                const inverseResponse = await api.get(`api/exchange-rates?from=${toCurrency.id}&to=${fromCurrency.id}&date=${date}`);

                if (inverseResponse.success && inverseResponse.data && inverseResponse.data.rate) {
                    const inverseRate = parseFloat(inverseResponse.data.rate);
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
        document.querySelectorAll('.edit-income').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const income = this.incomes.find(i => i.id === id);
                if (income) this.showIncomeModal(income);
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
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar el ingreso', 'danger');
                }
            });
        });
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addIncomeBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showIncomeModal());

        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.filters = {
                    start_date: document.getElementById('filterStartDate').value,
                    end_date: document.getElementById('filterEndDate').value,
                    account_id: document.getElementById('filterAccount').value
                };
                this.loadIncomes();
            });
        }

        const filterStart = document.getElementById('filterStartDate');
        const filterEnd = document.getElementById('filterEndDate');
        const filterAccount = document.getElementById('filterAccount');

        if (filterStart) filterStart.addEventListener('change', () => applyFilters?.click());
        if (filterEnd) filterEnd.addEventListener('change', () => applyFilters?.click());
        if (filterAccount) filterAccount.addEventListener('change', () => applyFilters?.click());

        // Botones de exportación
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