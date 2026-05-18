import { api } from '../services/apiService.js';
import { currencyService } from '../services/currencyService.js';
import { showAlert } from '../utils/helpers.js';

export const currenciesModule = {
    currencies: [],
    dataTable: null,
   

    async render(container) {   
        await currencyService.getAll();     
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Gestión de Monedas</h1>
                <button class="btn btn-primary" id="addCurrencyBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Moneda
                </button>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                <strong>Sistema Multimoneda</strong><br>
                La moneda base (${currencyService.baseCurrency?.code || 'No definida'}) se utiliza para los reportes financieros y conversiones automáticas.
                Todas las transacciones se registran en su moneda original y se convierten automáticamente a la moneda base.
            </div>
            
            <div class="row mb-3">
                <div class="col-md-4">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <h6 class="card-title">Moneda Base del Sistema</h6>
                            <h2 class="mb-0">
                                ${currencyService.baseCurrency ?
                `${currencyService.baseCurrency.symbol} ${currencyService.baseCurrency.code}` :
                'No configurada'}
                            </h2>
                            <small>Para almacenamiento y reportes</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h6 class="card-title">Moneda por Defecto</h6>
                            <h2 class="mb-0">
                                ${currencyService.defaultCurrency ?
                `${currencyService.defaultCurrency.symbol} ${currencyService.defaultCurrency.code}` :
                'No configurada'}
                            </h2>
                            <small>Para conversión y visualización</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card bg-info text-white">
                        <div class="card-body">
                            <h6 class="card-title">Monedas Activas</h6>
                            <h2 class="mb-0">${currencyService.currencies.filter(c => c.is_active).length}</h2>
                            <small>Monedas disponibles para transacciones</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="currenciesTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Código</th>
                                    <th>Nombre</th>
                                    <th>Símbolo</th>
                                    <th>Decimales</th>
                                    <th>Moneda Base</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="currenciesTableBody">
                                <tr><td colspan="8" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        await this.loadCurrencies();
        this.setupEventListeners();
    },

    async loadCurrencies() {
        try {
            const response = await currencyService.getAllWithInactive();
            if (response.success && response.data) {
                this.currencies = response.data;
                // Actualizar servicio
                currencyService.currencies = this.currencies.filter(c => c.is_active);
                currencyService.baseCurrency = this.currencies.find(c => c.is_base === 1);
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading currencies:', error);
            showAlert('Error al cargar las monedas', 'danger');
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.currencies.map(currency => [
            currency.id,
            currency.code,
            currency.name,
            currency.symbol,
            currency.decimal_places,
            currency.is_base ?
                '<span class="badge bg-success"><i class="bi bi-star-fill"></i> Base</span>' :
                `<button class="btn btn-sm btn-outline-primary set-base" data-id="${currency.id}">
                    <i class="bi bi-star"></i> Establecer como base
                </button>`,
            `<span class="badge ${currency.is_active ? 'bg-success' : 'bg-danger'}">
                ${currency.is_active ? 'Activo' : 'Inactivo'}
            </span>`,
            `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-currency" data-id="${currency.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-currency" data-id="${currency.id}" 
                            title="Eliminar" ${currency.is_base ? 'disabled' : ''}>
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
        ]);

        this.dataTable = $('#currenciesTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 7, orderable: false, searchable: false }
            ],
            drawCallback: () => this.attachTableEvents()
        });
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-currency').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const currency = this.currencies.find(c => c.id === id);
                if (currency) this.showCurrencyModal(currency);
            });
        });

        document.querySelectorAll('.delete-currency').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const currency = this.currencies.find(c => c.id === id);
                if (!currency) return;

                const confirmed = confirm(`¿Está seguro de eliminar la moneda "${currency.name}"?\n\nEsta acción no se puede deshacer.`);
                if (!confirmed) return;

                try {
                    const response = await api.delete(`api/currencies/${id}`);
                    if (response.success) {
                        showAlert('Moneda eliminada exitosamente', 'success');
                        await this.loadCurrencies();
                        // Limpiar caché de tasas
                        currencyService.clearCache();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar la moneda', 'danger');
                }
            });
        });

        document.querySelectorAll('.set-base').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const currency = this.currencies.find(c => c.id === id);
                if (!currency) return;

                const confirmed = confirm(`¿Establecer "${currency.name}" como moneda base?\n\n` +
                    `Esto cambiará la moneda base del sistema y afectará:\n` +
                    `• Reportes financieros\n` +
                    `• Conversiones automáticas\n` +
                    `• Visualización de montos\n\n` +
                    `¿Desea continuar?`);

                if (!confirmed) return;

                try {
                    const response = await api.put(`api/currencies/${id}`, { is_base: true });
                    if (response.success) {
                        showAlert('Moneda base actualizada exitosamente', 'success');
                        await this.loadCurrencies();
                        // Limpiar caché de tasas
                        currencyService.clearCache();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al establecer la moneda base', 'danger');
                }
            });
        });
    },

    showCurrencyModal(currency = null) {
        const isEditing = !!currency;

        const modalHtml = `
            <div class="modal fade" id="currencyModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-currency-exchange"></i> ${isEditing ? 'Editar Moneda' : 'Nueva Moneda'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="currencyForm">
                                <div class="mb-3">
                                    <label class="form-label">Código * (ISO 4217)</label>
                                    <input type="text" class="form-control" id="currencyCode" 
                                           value="${currency ? currency.code : ''}" 
                                           maxlength="3" required>
                                    <small class="text-muted">Ej: USD, EUR, COP, MXN</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nombre *</label>
                                    <input type="text" class="form-control" id="currencyName" 
                                           value="${currency ? currency.name : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Símbolo *</label>
                                    <input type="text" class="form-control" id="currencySymbol" 
                                           value="${currency ? currency.symbol : ''}" 
                                           placeholder="$" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Decimales</label>
                                    <input type="number" class="form-control" id="decimalPlaces" 
                                           value="${currency ? currency.decimal_places : 2}" min="0" max="4">
                                    <small class="text-muted">Número de decimales para esta moneda</small>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="isBase" 
                                               ${currency && currency.is_base ? 'checked' : ''}>
                                        <label class="form-check-label">
                                            <i class="bi bi-star"></i> Establecer como moneda base
                                        </label>
                                        <div class="text-muted small">La moneda base se usa para reportes y conversiones automáticas</div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="isDefault" 
                                            ${currency && currency.is_default ? 'checked' : ''}>
                                        <label class="form-check-label">
                                            <i class="bi bi-star-fill text-warning"></i> Establecer como moneda por defecto
                                        </label>
                                        <div class="text-muted small">La moneda por defecto se usa para conversiones automáticas de visualización</div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="isActive" 
                                               ${!currency || currency.is_active ? 'checked' : ''}>
                                        <label class="form-check-label">
                                            <i class="bi bi-check-circle"></i> Activa
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveCurrencyBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('currencyModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('currencyModal');
        const modal = new bootstrap.Modal(modalElement);

        const saveBtn = document.getElementById('saveCurrencyBtn');
        saveBtn.addEventListener('click', async () => {
            const data = {
                code: document.getElementById('currencyCode').value.trim().toUpperCase(),
                name: document.getElementById('currencyName').value.trim(),
                symbol: document.getElementById('currencySymbol').value.trim(),
                decimal_places: parseInt(document.getElementById('decimalPlaces').value) || 2,
                is_base: document.getElementById('isBase').checked,
                is_default: document.getElementById('isDefault').checked, // ✅ Nuevo
                is_active: document.getElementById('isActive').checked
            };

            if (!data.code || !data.name || !data.symbol) {
                showAlert('Por favor complete los campos requeridos', 'warning');
                return;
            }

            if (data.code.length !== 3) {
                showAlert('El código debe tener 3 caracteres', 'warning');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await api.put(`api/currencies/${currency.id}`, data);
                    if (response.success) showAlert('Moneda actualizada exitosamente', 'success');
                } else {
                    response = await api.post('api/currencies', data);
                    if (response.success) showAlert('Moneda creada exitosamente', 'success');
                }

                modal.hide();
                await this.loadCurrencies();
                currencyService.clearCache();
            } catch (error) {
                showAlert(error.message || 'Error al guardar la moneda', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addCurrencyBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showCurrencyModal());
        }
    }
};