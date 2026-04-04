// modules/exchange-rates.js
import { api } from '../services/apiService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const exchangeRatesModule = {
    rates: [],
    currencies: [],
    dataTable: null,

    async render(container) {
        container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3">Tasas de Cambio</h1>
            <button class="btn btn-primary" id="addRateBtn">
                <i class="bi bi-plus-circle"></i> Nueva Tasa
            </button>
        </div>
        
        <div class="row mb-3">
            <div class="col-md-4">
                <label class="form-label">Filtrar por fecha</label>
                <input type="date" class="form-control" id="rateDate" value="">
                <small class="text-muted">Dejar vacío para ver todas las tasas</small>
            </div>
            <div class="col-md-2">
                <label class="form-label">&nbsp;</label>
                <button class="btn btn-primary w-100" id="refreshRatesBtn">
                    <i class="bi bi-arrow-repeat"></i> Actualizar
                </button>
            </div>
            <div class="col-md-6">
                <div id="filterInfo"></div>
            </div>
        </div>
        
        <div class="card shadow-sm">
            <div class="card-body">
                <div class="table-responsive">
                    <table id="ratesTable" class="table table-hover table-striped" style="width:100%">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Moneda Origen</th>
                                <th>Moneda Destino</th>
                                <th>Tasa</th>
                                <th>Fecha Efectiva</th>
                                <th>Fuente</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="ratesTableBody">
                            <tr><td colspan="7" class="text-center">Cargando...</td><tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

        await this.loadCurrencies();
        await this.loadRates();
        this.setupEventListeners();
    },

    async loadCurrencies() {
        try {
            const response = await api.get('api/currencies');
            if (response.success && response.data) {
                this.currencies = response.data;
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
        }
    },

    async loadRates() {
        const date = document.getElementById('rateDate')?.value || '';

        try {
            let url = 'api/exchange-rates';
            if (date) {
                url += `?date=${date}`;
            }

            const response = await api.get(url);
            if (response.success && response.data) {
                // Si es un array (múltiples tasas) o un objeto (tasa específica)
                const ratesData = Array.isArray(response.data) ? response.data : [response.data];

                this.rates = ratesData.map(rate => ({
                    ...rate,
                    rate: typeof rate.rate === 'number' ? rate.rate : parseFloat(rate.rate || 0)
                }));
                this.renderDataTable();

                // Mostrar información sobre el filtro aplicado
                const infoDiv = document.getElementById('filterInfo');
                if (infoDiv) {
                    if (date) {
                        infoDiv.innerHTML = `<div class="alert alert-info">Mostrando tasas vigentes al ${date}</div>`;
                    } else {
                        infoDiv.innerHTML = `<div class="alert alert-info">Mostrando las tasas más recientes de cada par de monedas</div>`;
                    }
                }
            } else {
                this.rates = [];
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('Error al cargar las tasas de cambio', 'danger');
            this.rates = [];
            this.renderDataTable();
        }
    },

    getCurrencyName(currencyId) {
        const currency = this.currencies.find(c => c.id === currencyId);
        return currency ? `${currency.code} - ${currency.name}` : '-';
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.rates.map(rate => [
            rate.id,
            this.getCurrencyName(rate.from_currency_id),
            this.getCurrencyName(rate.to_currency_id),
            // ✅ Asegurar que rate.rate es un número
            typeof rate.rate === 'number' ? rate.rate.toFixed(4) : parseFloat(rate.rate || 0).toFixed(4),
            rate.effective_date,
            rate.source || 'manual',
            `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary edit-rate" data-id="${rate.id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger delete-rate" data-id="${rate.id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `
        ]);

        this.dataTable = $('#ratesTable').DataTable({
            data: tableData,
            language: {
                url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json'
            },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[4, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 6, orderable: false, searchable: false }
            ],
            dom: '<"row"<"col-sm-6"B><"col-sm-6"f>>' +
                '<"row"<"col-sm-12"tr>>' +
                '<"row"<"col-sm-5"i><"col-sm-7"p>>',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5] }
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5] }
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5] },
                    title: 'Tasas_de_Cambio',
                    filename: 'tasas_cambio_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5] },
                    title: 'Reporte de Tasas de Cambio',
                    filename: 'tasas_cambio_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
                    orientation: 'landscape',
                    pageSize: 'A4'
                },
                {
                    extend: 'print',
                    text: '<i class="bi bi-printer"></i> Imprimir',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5] }
                }
            ],
            drawCallback: () => this.attachTableEvents()
        });

        this.attachTableEvents();
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-rate').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const rate = this.rates.find(r => r.id === id);
                if (rate) this.showRateModal(rate);
            });
        });

        document.querySelectorAll('.delete-rate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const rate = this.rates.find(r => r.id === id);
                if (!rate) return;

                const confirmed = confirm(`¿Está seguro de eliminar esta tasa de cambio?`);
                if (!confirmed) return;

                try {
                    const response = await api.delete(`api/exchange-rates/${id}`);
                    if (response.success) {
                        showAlert('Tasa eliminada exitosamente', 'success');
                        await this.loadRates();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar la tasa', 'danger');
                }
            });
        });
    },

    showRateModal(rate = null) {
        const isEditing = !!rate;
        const today = new Date().toISOString().split('T')[0];

        const modalHtml = `
            <div class="modal fade" id="rateModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-graph-up"></i> ${isEditing ? 'Editar Tasa' : 'Nueva Tasa'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="rateForm">
                                <div class="mb-3">
                                    <label class="form-label">Moneda Origen *</label>
                                    <select class="form-select" id="fromCurrency" required>
                                        <option value="">Seleccione</option>
                                        ${this.currencies.map(c => `
                                            <option value="${c.id}" ${rate && rate.from_currency_id === c.id ? 'selected' : ''}>
                                                ${c.code} - ${c.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Moneda Destino *</label>
                                    <select class="form-select" id="toCurrency" required>
                                        <option value="">Seleccione</option>
                                        ${this.currencies.map(c => `
                                            <option value="${c.id}" ${rate && rate.to_currency_id === c.id ? 'selected' : ''}>
                                                ${c.code} - ${c.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Tasa de Cambio *</label>
                                    <input type="number" class="form-control" id="rateValue" 
                                           step="0.00000001" value="${rate ? rate.rate : ''}" required>
                                    <small class="text-muted">Ej: 1 USD = 4000 COP → ingresar 4000</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Fecha Efectiva *</label>
                                    <input type="date" class="form-control" id="effectiveDate" 
                                           value="${rate ? rate.effective_date : today}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Fuente</label>
                                    <select class="form-select" id="source">
                                        <option value="manual" ${rate && rate.source === 'manual' ? 'selected' : ''}>Manual</option>
                                        <option value="api" ${rate && rate.source === 'api' ? 'selected' : ''}>API</option>
                                        <option value="banco" ${rate && rate.source === 'banco' ? 'selected' : ''}>Banco Central</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveRateBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('rateModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('rateModal');
        const modal = new bootstrap.Modal(modalElement);

        const saveBtn = document.getElementById('saveRateBtn');
        saveBtn.addEventListener('click', async () => {
            const fromCurrency = document.getElementById('fromCurrency').value;
            const toCurrency = document.getElementById('toCurrency').value;
            const rateValue = parseFloat(document.getElementById('rateValue').value);
            const effectiveDate = document.getElementById('effectiveDate').value;
            const source = document.getElementById('source').value;

            if (!fromCurrency || !toCurrency || !rateValue || !effectiveDate) {
                showAlert('Por favor complete los campos requeridos', 'warning');
                return;
            }

            if (fromCurrency === toCurrency) {
                showAlert('Las monedas deben ser diferentes', 'warning');
                return;
            }

            const data = {
                from_currency_id: parseInt(fromCurrency),
                to_currency_id: parseInt(toCurrency),
                rate: rateValue,
                effective_date: effectiveDate,
                source: source
            };

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await api.put(`api/exchange-rates/${rate.id}`, data);
                    if (response.success) showAlert('Tasa actualizada exitosamente', 'success');
                } else {
                    response = await api.post('api/exchange-rates', data);
                    if (response.success) showAlert('Tasa creada exitosamente', 'success');
                }

                modal.hide();
                await this.loadRates();
            } catch (error) {
                showAlert(error.message || 'Error al guardar la tasa', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addRateBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showRateModal());
        }

        const refreshBtn = document.getElementById('refreshRatesBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRates());
        }

        const dateInput = document.getElementById('rateDate');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.loadRates());
        }
    }
};