// modules/exchange-rates.js
import { api } from '../services/apiService.js';
import { currencyService } from '../services/currencyService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const exchangeRatesModule = {
    rates: [],
    currencies: [],
    dataTable: null,
    dateFilter: '',

    async render(container) {
        // Cargar monedas primero
        await currencyService.getAll();
        
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Tasas de Cambio</h1>
                <button class="btn btn-primary" id="addRateBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Tasa
                </button>
            </div>
            
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i>
                <strong>Sistema Multimoneda</strong><br>
                Las tasas de cambio se utilizan para convertir automáticamente todas las transacciones a la moneda base 
                <strong>${currencyService.baseCurrency?.code || 'No definida'}</strong>.
                Configure las tasas para cada par de monedas que utilice.
            </div>
            
            <div class="card shadow-sm mb-4">
                <div class="card-body">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-calendar"></i> Filtrar por fecha
                            </label>
                            <input type="date" class="form-control" id="rateDate" value="${this.dateFilter}">
                            <small class="text-muted">Dejar vacío para ver las tasas más recientes</small>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">
                                <i class="bi bi-arrow-left-right"></i> Moneda Origen
                            </label>
                            <select class="form-select" id="filterFromCurrency">
                                <option value="">Todas</option>
                                ${currencyService.currencies.map(c => `
                                    <option value="${c.id}">${c.code} - ${c.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">&nbsp;</label>
                            <button class="btn btn-primary w-100" id="refreshRatesBtn">
                                <i class="bi bi-arrow-repeat"></i> Actualizar
                            </button>
                        </div>
                    </div>
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
                                <tr><td colspan="7" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        await this.loadRates();
        this.setupEventListeners();
    },

    async loadRates() {
        const date = document.getElementById('rateDate')?.value || '';
        const fromCurrency = document.getElementById('filterFromCurrency')?.value || '';

        try {
            let url = 'api/exchange-rates/all';
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (fromCurrency) params.append('from', fromCurrency);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await api.get(url);
            if (response.success && response.data) {
                this.rates = Array.isArray(response.data) ? response.data : [response.data];
                this.renderDataTable();
                
                // Mostrar información
                const infoDiv = document.getElementById('rateInfo');
                if (infoDiv) {
                    if (date) {
                        infoDiv.innerHTML = `<div class="alert alert-info mt-2">Mostrando tasas vigentes al ${date}</div>`;
                    } else {
                        infoDiv.innerHTML = `<div class="alert alert-info mt-2">Mostrando las tasas más recientes de cada par de monedas</div>`;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('Error al cargar las tasas de cambio', 'danger');
            this.rates = [];
            this.renderDataTable();
        }
    },

    getCurrencyName(currencyId) {
        const currency = currencyService.currencies.find(c => c.id === currencyId);
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
            parseFloat(rate.rate).toFixed(6),
            rate.effective_date,
            rate.source === 'manual' ? 
                '<span class="badge bg-info">Manual</span>' : 
                '<span class="badge bg-secondary">API</span>',
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
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[4, 'desc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 6, orderable: false, searchable: false }
            ],
            dom: 'Bfrtip',
            buttons: [
                { extend: 'copy', text: '<i class="bi bi-files"></i> Copiar', className: 'btn btn-sm btn-secondary me-1' },
                { extend: 'csv', text: '<i class="bi bi-filetype-csv"></i> CSV', className: 'btn btn-sm btn-info me-1' },
                { extend: 'excel', text: '<i class="bi bi-file-excel"></i> Excel', className: 'btn btn-sm btn-success me-1' },
                {
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    action: () => this.exportToPDF()
                },
                { extend: 'print', text: '<i class="bi bi-printer"></i> Imprimir', className: 'btn btn-sm btn-secondary me-1' }
            ],
            drawCallback: () => this.attachTableEvents()
        });
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

                const confirmed = confirm(`¿Está seguro de eliminar esta tasa de cambio?\n\n` +
                    `${rate.from_currency_code} → ${rate.to_currency_code} - ${rate.rate}`);
                if (!confirmed) return;

                try {
                    const response = await api.delete(`api/exchange-rates/${id}`);
                    if (response.success) {
                        showAlert('Tasa eliminada exitosamente', 'success');
                        currencyService.clearCache();
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
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i>
                                <strong>Conversión automática</strong><br>
                                Esta tasa se usará para convertir automáticamente las transacciones 
                                de <strong>${rate?.from_currency_name || 'la moneda origen'}</strong> 
                                a <strong>${rate?.to_currency_name || 'la moneda destino'}</strong>.
                            </div>
                            <form id="rateForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Moneda Origen</label>
                                        <select class="form-select" id="fromCurrency" required>
                                            <option value="">Seleccione</option>
                                            ${currencyService.currencies.map(c => `
                                                <option value="${c.id}" ${rate && rate.from_currency_id === c.id ? 'selected' : ''}>
                                                    ${c.code} - ${c.name} ${c.is_base ? '(Base)' : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Moneda Destino</label>
                                        <select class="form-select" id="toCurrency" required>
                                            <option value="">Seleccione</option>
                                            ${currencyService.currencies.map(c => `
                                                <option value="${c.id}" ${rate && rate.to_currency_id === c.id ? 'selected' : ''}>
                                                    ${c.code} - ${c.name} ${c.is_base ? '(Base)' : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label required">Tasa de Cambio *</label>
                                    <input type="number" class="form-control" id="rateValue" 
                                           step="0.00000001" value="${rate ? rate.rate : ''}" 
                                           placeholder="Ej: 36.50" required>
                                    <small class="text-muted">Ej: 1 USD = 36.50 VES → ingresar 36.50</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label required">Fecha Efectiva *</label>
                                    <input type="date" class="form-control" id="effectiveDate" 
                                           value="${rate ? rate.effective_date : today}" required>
                                    <small class="text-muted">Fecha desde la cual aplica esta tasa</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Fuente</label>
                                    <select class="form-select" id="source">
                                        <option value="manual" ${rate && rate.source === 'manual' ? 'selected' : ''}>Manual</option>
                                        <option value="api" ${rate && rate.source === 'api' ? 'selected' : ''}>API Externa</option>
                                        <option value="banco_central" ${rate && rate.source === 'banco_central' ? 'selected' : ''}>Banco Central</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notas</label>
                                    <textarea class="form-control" id="notes" rows="2" 
                                              placeholder="Observaciones sobre esta tasa...">${rate?.notes || ''}</textarea>
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
            const notes = document.getElementById('notes').value;

            if (!fromCurrency || !toCurrency || !rateValue || !effectiveDate) {
                showAlert('Por favor complete los campos requeridos', 'warning');
                return;
            }

            if (fromCurrency === toCurrency) {
                showAlert('Las monedas deben ser diferentes', 'warning');
                return;
            }

            if (rateValue <= 0) {
                showAlert('La tasa debe ser mayor a 0', 'warning');
                return;
            }

            const data = {
                from_currency_id: parseInt(fromCurrency),
                to_currency_id: parseInt(toCurrency),
                rate: rateValue,
                effective_date: effectiveDate,
                source: source,
                notes: notes || null
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
                currencyService.clearCache();
                await this.loadRates();
            } catch (error) {
                if (error.message && error.message.includes('Ya existe')) {
                    showAlert(error.message, 'warning');
                } else {
                    showAlert(error.message || 'Error al guardar la tasa', 'danger');
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    exportToPDF() {
        if (!this.rates || this.rates.length === 0) {
            showAlert('No hay datos para exportar', 'warning');
            return;
        }

        // Implementar exportación a PDF
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permite las ventanas emergentes');
            return;
        }

        const html = this.generateRatesHTML();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    },

    generateRatesHTML() {
        const date = document.getElementById('rateDate')?.value || 'todas las fechas';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte de Tasas de Cambio</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #007bff; text-align: center; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .date { text-align: center; color: #6c757d; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #007bff; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px; border: 1px solid #dee2e6; }
                    tr:nth-child(even) { background: #f8f9fa; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Reporte de Tasas de Cambio</h1>
                    <div>FlowControl - Sistema de Flujo de Caja</div>
                </div>
                <div class="date">
                    Filtro: ${date}<br>
                    Generado: ${new Date().toLocaleString('es-ES')}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Moneda Origen</th>
                            <th>Moneda Destino</th>
                            <th>Tasa</th>
                            <th>Fecha Efectiva</th>
                            <th>Fuente</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.rates.map(rate => `
                            <tr>
                                <td>${this.getCurrencyName(rate.from_currency_id)}</td>
                                <td>${this.getCurrencyName(rate.to_currency_id)}</td>
                                <td class="text-right">${parseFloat(rate.rate).toFixed(6)}</td>
                                <td>${rate.effective_date}</td>
                                <td>${rate.source === 'manual' ? 'Manual' : rate.source}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Este reporte fue generado automáticamente por el Sistema de Flujo de Caja</p>
                    <p>© ${new Date().getFullYear()} - Todos los derechos reservados</p>
                </div>
            </body>
            </html>
        `;
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

        const fromFilter = document.getElementById('filterFromCurrency');
        if (fromFilter) {
            fromFilter.addEventListener('change', () => this.loadRates());
        }
    }
};