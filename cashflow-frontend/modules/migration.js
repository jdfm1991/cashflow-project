// modules/migration.js
import { api } from '../services/apiService.js';
import { accountService } from '../services/accountService.js';
import { formatAmountWithDecimals, formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

// modules/migration.js

export const migrationModule = {
    connections: [],
    currentSessionId: null,
    previewData: [],
    transactionMappings: {},
    incomeAccounts: [],
    expenseAccounts: [],
    currentConnectionId: null,  // ← NUEVO: almacenar conexión actual

    async render(container) {
        await this.loadConnections();
        await this.loadAccounts();

        container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3">
                <i class="bi bi-database-gear"></i> Migración de Datos
            </h1>
            <button class="btn btn-primary" id="addConnectionBtn">
                <i class="bi bi-plus-circle"></i> Nueva Conexión
            </button>
        </div>
        
        <!-- Acordeón de conexiones -->
        <div class="accordion mb-4" id="connectionsAccordion">
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button ${this.connections.length > 0 ? '' : 'collapsed'}" 
                            type="button" 
                            data-bs-toggle="collapse" 
                            data-bs-target="#connectionsCollapse" 
                            aria-expanded="${this.connections.length > 0 ? 'true' : 'false'}" 
                            aria-controls="connectionsCollapse">
                        <div class="d-flex justify-content-between align-items-center w-100 me-3">
                            <span><i class="bi bi-plug"></i> Conexiones a Bases de Datos Externas</span>
                            <span class="badge bg-secondary ms-2">${this.connections.length} conexiones</span>
                        </div>
                    </button>
                </h2>
                <div id="connectionsCollapse" 
                     class="accordion-collapse collapse ${this.connections.length > 0 ? 'show' : ''}" 
                     data-bs-parent="#connectionsAccordion">
                    <div class="accordion-body">
                        <div id="connectionsList">
                            ${this.renderConnectionsList()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Panel de migración -->
        <div class="card shadow-sm" id="migrationPanel" style="display: none;">
            <div class="card-header bg-success text-white">
                <h5 class="mb-0"><i class="bi bi-arrow-left-right"></i> Migrar Datos</h5>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label fw-semibold">Conexión</label>
                        <select class="form-select" id="connectionSelect">
                            <option value="">Seleccione una conexión</option>
                            ${this.connections.map(c => `<option value="${c.id}">${c.name} (${c.company_name || 'Mi empresa'})</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label fw-semibold">Año</label>
                        <select class="form-select" id="yearSelect" disabled>
                            <option value="">Primero seleccione conexión</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label fw-semibold">Mes</label>
                        <select class="form-select" id="monthSelect" disabled>
                            <option value="">Primero seleccione año</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label fw-semibold">Banco</label>
                        <select class="form-select" id="bankSelect" disabled>
                            <option value="">Primero seleccione mes</option>
                        </select>
                    </div>
                    <div class="col-md-1 d-flex align-items-end">
                        <button class="btn btn-primary w-100" id="previewBtn" disabled>
                            <i class="bi bi-eye"></i> Ver
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Panel de previsualización y mapeo -->
        <div id="mappingPanel" class="card shadow-sm mt-4" style="display: none;">
            <div class="card-header bg-warning">
                <h5 class="mb-0"><i class="bi bi-table"></i> Previsualización y Mapeo</h5>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <div class="d-flex justify-content-between">
                        <span>Progreso de mapeo:</span>
                        <span id="mappingInfoText">0 de 0 transacciones mapeadas</span>
                    </div>
                    <div class="progress">
                        <div id="mappingProgress" class="progress-bar bg-info" style="width: 0%">0%</div>
                    </div>
                </div>
                <div id="previewTable"></div>
                <div class="mt-3 d-flex justify-content-end gap-2">
                    <button class="btn btn-secondary" id="cancelMigrationBtn">
                        <i class="bi bi-x-circle"></i> Cancelar
                    </button>
                    <button class="btn btn-success" id="executeMigrationBtn" disabled>
                        <i class="bi bi-download"></i> Ejecutar Migración
                    </button>
                </div>
            </div>
        </div>
    `;

        this.setupEventListeners();
    },

    renderConnectionsList() {
        if (this.connections.length === 0) {
            return `<div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No hay conexiones configuradas. 
                    <a href="#" id="addConnectionLink">Cree una nueva</a>
                </div>`;
        }

        return `
        <div class="row g-3">
            ${this.connections.map(conn => `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="card-title mb-0">
                                    <i class="bi bi-server"></i> ${this.escapeHtml(conn.name)}
                                </h6>
                                ${conn.company_name ? `<span class="badge bg-secondary">${this.escapeHtml(conn.company_name)}</span>` : ''}
                            </div>
                            <div class="small text-muted mb-3">
                                <div><i class="bi bi-hdd-stack"></i> ${this.escapeHtml(conn.host)}:${conn.port}</div>
                                <div><i class="bi bi-database"></i> ${this.escapeHtml(conn.db_name)}</div>
                                <div><i class="bi bi-table"></i> ${this.escapeHtml(conn.table_name)}</div>
                            </div>
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-sm btn-outline-primary test-connection" data-id="${conn.id}">
                                    <i class="bi bi-check-circle"></i> Probar
                                </button>
                                <button class="btn btn-sm btn-outline-success use-connection" data-id="${conn.id}">
                                    <i class="bi bi-arrow-right"></i> Usar
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-connection" data-id="${conn.id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    },

    // Agrega este método helper para evitar XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async loadConnections() {
        try {
            const response = await api.get('api/migrations/connections');
            if (response.success && response.data) {
                const hadConnections = this.connections.length > 0;
                this.connections = response.data;
                console.log('Conexiones cargadas:', this.connections.length);

                // Actualizar el contador de conexiones en el acordeón
                const badge = document.querySelector('#connectionsAccordion .accordion-button .badge');
                if (badge) {
                    badge.textContent = `${this.connections.length} conexiones`;
                }

                // Si antes no había conexiones y ahora hay, mostrar el acordeón
                if (!hadConnections && this.connections.length > 0) {
                    this.openConnectionsAccordion();
                }
            }
        } catch (error) {
            console.error('Error loading connections:', error);
        }
    },

    async loadAccounts() {
        try {
            const incomeResp = await accountService.getAll('income');
            const expenseResp = await accountService.getAll('expense');

            if (incomeResp.success && incomeResp.data) {
                this.incomeAccounts = incomeResp.data;
            }
            if (expenseResp.success && expenseResp.data) {
                this.expenseAccounts = expenseResp.data;
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    },

    async testConnection(connectionId) {
        try {
            showAlert('Probando conexión...', 'info');
            const response = await api.get(`api/migrations/test-connection?connection_id=${connectionId}`);
            if (response.success && response.data.success) {
                showAlert('Conexión exitosa: ' + response.data.message, 'success');
            } else {
                showAlert('Error de conexión: ' + (response.data?.message || 'Desconocido'), 'danger');
            }
        } catch (error) {
            showAlert('Error al probar la conexión', 'danger');
        }
    },

    async useConnection(connectionId) {
        const connection = this.connections.find(c => c.id == connectionId);
        if (!connection) return;

        this.currentConnectionId = connectionId;

        // Mostrar panel de migración
        const migrationPanel = document.getElementById('migrationPanel');
        if (migrationPanel) migrationPanel.style.display = 'block';

        // Cerrar el acordeón para optimizar espacio
        this.closeConnectionsAccordion();

        // Configurar selector de conexión
        const connectionSelect = document.getElementById('connectionSelect');
        if (connectionSelect) {
            connectionSelect.value = connectionId;
            connectionSelect.disabled = false;
        }

        // ✅ Limpiar selects de año y mes
        const yearSelect = document.getElementById('yearSelect');
        const monthSelect = document.getElementById('monthSelect');
        const bankSelect = document.getElementById('bankSelect');
        const previewBtn = document.getElementById('previewBtn');

        if (yearSelect) {
            yearSelect.innerHTML = '<option value="">Cargando años...</option>';
            yearSelect.disabled = true;
        }
        if (monthSelect) {
            monthSelect.innerHTML = '<option value="">Primero seleccione año</option>';
            monthSelect.disabled = true;
        }
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Primero seleccione mes</option>';
            bankSelect.disabled = true;
        }
        if (previewBtn) previewBtn.disabled = true;

        // Cargar años disponibles
        await this.loadAvailableYears(connectionId);
    },

    // Método para cerrar el acordeón
    closeConnectionsAccordion() {
        const accordionCollapse = document.getElementById('connectionsCollapse');
        if (accordionCollapse && accordionCollapse.classList.contains('show')) {
            const button = document.querySelector('#connectionsAccordion .accordion-button');
            if (button) {
                button.classList.add('collapsed');
                button.setAttribute('aria-expanded', 'false');
            }
            // Usar Bootstrap collapse API si está disponible
            if (window.bootstrap && window.bootstrap.Collapse) {
                const bsCollapse = new bootstrap.Collapse(accordionCollapse, {
                    toggle: false
                });
                bsCollapse.hide();
            } else {
                // Fallback: cambiar manualmente la clase
                accordionCollapse.classList.remove('show');
            }
        }
    },

    // Método para abrir el acordeón (opcional, para cuando se necesite)
    openConnectionsAccordion() {
        const accordionCollapse = document.getElementById('connectionsCollapse');
        if (accordionCollapse && !accordionCollapse.classList.contains('show')) {
            const button = document.querySelector('#connectionsAccordion .accordion-button');
            if (button) {
                button.classList.remove('collapsed');
                button.setAttribute('aria-expanded', 'true');
            }
            if (window.bootstrap && window.bootstrap.Collapse) {
                const bsCollapse = new bootstrap.Collapse(accordionCollapse, {
                    toggle: false
                });
                bsCollapse.show();
            } else {
                accordionCollapse.classList.add('show');
            }
        }
    },

    async loadAvailableYears(connectionId) {
        try {
            const response = await api.get(`api/migrations/years?connection_id=${connectionId}`);

            const yearSelect = document.getElementById('yearSelect');
            if (response.success && response.data && response.data.years) {
                const years = response.data.years;

                if (years.length === 0) {
                    yearSelect.innerHTML = '<option value="">No hay años disponibles</option>';
                    yearSelect.disabled = true;
                    showAlert('No se encontraron datos en la base de datos externa', 'warning');
                } else {
                    yearSelect.innerHTML = '<option value="">Seleccione año</option>' +
                        years.map(y => `<option value="${y}">${y}</option>`).join('');
                    yearSelect.disabled = false;

                    // ✅ Guardar el connectionId en el dataset para usarlo después
                    yearSelect.dataset.connectionId = connectionId;
                }
            } else {
                yearSelect.innerHTML = '<option value="">Error al cargar años</option>';
                yearSelect.disabled = true;
            }
        } catch (error) {
            console.error('Error loading years:', error);
            const yearSelect = document.getElementById('yearSelect');
            if (yearSelect) {
                yearSelect.innerHTML = '<option value="">Error al cargar años</option>';
                yearSelect.disabled = true;
            }
            showAlert('Error al cargar los años disponibles', 'danger');
        }
    },

    async loadAvailableMonths(connectionId, year) {
        try {
            const response = await api.get(`api/migrations/months?connection_id=${connectionId}&year=${year}`);

            const monthSelect = document.getElementById('monthSelect');
            const previewBtn = document.getElementById('previewBtn');
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

            if (response.success && response.data && response.data.months) {
                const monthsList = response.data.months;

                if (monthsList.length === 0) {
                    monthSelect.innerHTML = '<option value="">No hay meses disponibles</option>';
                    monthSelect.disabled = true;
                    if (previewBtn) previewBtn.disabled = true;
                } else {
                    monthSelect.innerHTML = '<option value="">Seleccione mes</option>' +
                        monthsList.map(m => `<option value="${m}">${months[m - 1]}</option>`).join('');
                    monthSelect.disabled = false;
                    if (previewBtn) previewBtn.disabled = true; // Hasta que seleccione mes
                }
            } else {
                monthSelect.innerHTML = '<option value="">Error al cargar meses</option>';
                monthSelect.disabled = true;
                if (previewBtn) previewBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error loading months:', error);
            const monthSelect = document.getElementById('monthSelect');
            if (monthSelect) {
                monthSelect.innerHTML = '<option value="">Error al cargar meses</option>';
                monthSelect.disabled = true;
            }
            showAlert('Error al cargar los meses disponibles', 'danger');
        }
    },

    async loadAvailableBanks(connectionId, year, month) {
        try {
            const response = await api.get(`api/migrations/banks?connection_id=${connectionId}&year=${year}&month=${month}`);
            const bankSelect = document.getElementById('bankSelect');
            const previewBtn = document.getElementById('previewBtn');

            if (response.success && response.data && response.data.banks) {
                const banks = response.data.banks;
                if (banks.length === 0) {
                    bankSelect.innerHTML = '<option value="">No hay bancos disponibles</option>';
                    bankSelect.disabled = true;
                    if (previewBtn) previewBtn.disabled = true;
                } else {
                    bankSelect.innerHTML = '<option value="">Seleccione banco</option>' +
                        banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
                    bankSelect.disabled = false;
                    // No habilitar preview todavía, esperar a que seleccione banco
                    if (previewBtn) previewBtn.disabled = true;
                }
            } else {
                bankSelect.innerHTML = '<option value="">Error al cargar bancos</option>';
                bankSelect.disabled = true;
                if (previewBtn) previewBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error loading banks:', error);
            showAlert('Error al cargar los bancos disponibles', 'danger');
        }
    },

    async preview() {
        const connectionId = document.getElementById('connectionSelect').value;
        const year = document.getElementById('yearSelect').value;
        const month = document.getElementById('monthSelect').value;
        const bankId = document.getElementById('bankSelect').value;

        // Depuración: Verificar valores
        console.log('Valores seleccionados:', { connectionId, year, month, bankId });
        console.log('bankId type:', typeof bankId, 'value:', bankId);

        if (!connectionId || !year || !month || !bankId) {
            showAlert('Seleccione conexión, año, mes y banco', 'warning');
            return;
        }

        // Asegurar que bankId sea un número entero
        const bankIdInt = parseInt(bankId);
        if (isNaN(bankIdInt) || bankIdInt <= 0) {
            showAlert('Seleccione un banco válido', 'warning');
            return;
        }

        const previewBtn = document.getElementById('previewBtn');
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';

        try {
            const response = await api.post('api/migrations/preview', {
                connection_id: parseInt(connectionId),
                year: parseInt(year),
                month: parseInt(month),
                bank_id: parseInt(bankId)
            });

            if (response.success && response.data) {
                this.currentSessionId = response.data.session_id;
                this.previewData = response.data.preview;
                this.transactionMappings = {};

                this.renderPreviewTable();
                document.getElementById('mappingPanel').style.display = 'block';
                showAlert(`${response.data.total_transactions} transacciones encontradas`, 'success');
            } else {
                showAlert(response.message || 'Error al previsualizar datos', 'danger');
            }
        } catch (error) {
            console.error('Error previewing:', error);
            showAlert('Error al previsualizar datos', 'danger');
        } finally {
            previewBtn.disabled = false;
            previewBtn.innerHTML = '<i class="bi bi-eye"></i> Previsualizar';
        }
    },

    renderPreviewTable() {
        const container = document.getElementById('previewTable');

        let html = `
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                <table class="table table-hover table-striped">
                    <thead class="sticky-top bg-light">
                        <tr>
                            <th>Fecha</th>
                            <th>Referencia</th>
                            <th>Descripción</th>
                            <th>Monto</th>
                            <th>Tipo</th>
                            <th>Cuenta</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.previewData.forEach((transaction, index) => {
            const accounts = transaction.transaction_type === 'income' ? this.incomeAccounts : this.expenseAccounts;
            const savedMapping = this.transactionMappings[index];

            let selectHtml = `<select class="form-select form-select-sm account-select" data-id="${index}">
                <option value="">Seleccione...</option>`;

            accounts.forEach(acc => {
                const selected = savedMapping == acc.id ? 'selected' : '';
                selectHtml += `<option value="${acc.id}" ${selected}>${acc.name}</option>`;
            });
            selectHtml += `</select>`;

            // ✅ Usar la función importada o local
            const formattedAmount = typeof formatAmountWithDecimals === 'function'
                ? formatAmountWithDecimals(Math.abs(transaction.amount))
                : this.formatAmountWithDecimals(Math.abs(transaction.amount));

            html += `
                <tr>
                    <td>${transaction.date}</td>
                    <td>${transaction.reference || '-'}</td>
                    <td title="${transaction.description}">${transaction.description.substring(0, 80)}${transaction.description.length > 80 ? '...' : ''}</td>
                    <td class="${transaction.transaction_type === 'income' ? 'text-success' : 'text-danger'}">
                        ${formattedAmount}
                    </td>
                    <td>
                        <span class="badge ${transaction.transaction_type === 'income' ? 'bg-success' : 'bg-danger'}">
                            ${transaction.transaction_type === 'income' ? 'Ingreso' : 'Egreso'}
                        </span>
                    </td>
                    <td>${selectHtml}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
        this.attachMappingEvents();
        this.updateMappingProgress();
    },

    attachMappingEvents() {
        document.querySelectorAll('.account-select').forEach(select => {
            const transactionId = parseInt(select.dataset.id);

            select.addEventListener('change', () => {
                const accountId = select.value;
                if (accountId) {
                    this.transactionMappings[transactionId] = parseInt(accountId);
                    select.classList.add('border-success');
                } else {
                    delete this.transactionMappings[transactionId];
                    select.classList.remove('border-success');
                }
                this.updateMappingProgress();
            });
        });
    },

    updateMappingProgress() {
        const total = this.previewData.length;
        const mapped = Object.keys(this.transactionMappings).length;
        const percent = total > 0 ? (mapped / total) * 100 : 0;

        const progressBar = document.getElementById('mappingProgress');
        const infoText = document.getElementById('mappingInfoText');
        const executeBtn = document.getElementById('executeMigrationBtn');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.textContent = `${Math.round(percent)}%`;
            progressBar.className = `progress-bar ${percent === 100 ? 'bg-success' : 'bg-info'}`;
        }

        if (infoText) {
            infoText.textContent = `${mapped} de ${total} transacciones mapeadas`;
            if (mapped === total && total > 0) {
                infoText.innerHTML += '<span class="text-success ms-2">✓ Listo para migrar</span>';
            }
        }

        if (executeBtn) {
            executeBtn.disabled = mapped !== total;
        }
    },

    async executeMigration() {
        if (Object.keys(this.transactionMappings).length !== this.previewData.length) {
            showAlert('Debe mapear todas las transacciones', 'warning');
            return;
        }

        const mappings = Object.entries(this.transactionMappings).map(([transactionId, accountId]) => ({
            transaction_id: parseInt(transactionId) + 1,
            account_id: accountId
        }));

        const connectionId = document.getElementById('connectionSelect').value;
        const year = document.getElementById('yearSelect').value;
        const month = document.getElementById('monthSelect').value;

        const executeBtn = document.getElementById('executeMigrationBtn');
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Migrando...';

        try {
            const response = await api.post('api/migrations/execute', {
                session_id: this.currentSessionId,
                connection_id: parseInt(connectionId),
                year: parseInt(year),
                month: parseInt(month),
                type: 'all',
                mappings: mappings
            });

            if (response.success) {
                let message = `Migración completada: ${response.data.imported} importadas`;
                if (response.data.duplicated > 0) {
                    message += `, ${response.data.duplicated} duplicadas omitidas`;
                }
                if (response.data.failed > 0) {
                    message += `, ${response.data.failed} fallidas`;
                }
                showAlert(message, response.data.failed > 0 ? 'warning' : 'success');

                // Limpiar panel
                document.getElementById('mappingPanel').style.display = 'none';
                document.getElementById('previewTable').innerHTML = '';
                this.currentSessionId = null;
                this.previewData = [];
                this.transactionMappings = {};
            } else {
                showAlert(response.message || 'Error al ejecutar la migración', 'danger');
            }
        } catch (error) {
            console.error('Error executing migration:', error);
            showAlert('Error al ejecutar la migración', 'danger');
        } finally {
            executeBtn.disabled = false;
            executeBtn.innerHTML = '<i class="bi bi-download"></i> Ejecutar Migración';
        }
    },

    setupEventListeners() {
        // Eventos dinámicos para botones de conexión
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-connection')) {
                const btn = e.target.closest('.test-connection');
                this.testConnection(btn.dataset.id);
            }
            if (e.target.closest('.use-connection')) {
                const btn = e.target.closest('.use-connection');
                this.useConnection(btn.dataset.id);
            }
            if (e.target.closest('.delete-connection')) {
                const btn = e.target.closest('.delete-connection');
                this.deleteConnection(btn.dataset.id);
            }
            if (e.target.closest('#addConnectionLink') || e.target.closest('#addConnectionBtn')) {
                this.showConnectionModal();
            }
        });

        // ✅ EVENTO PARA CUANDO CAMBIA EL AÑO
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                const connectionId = yearSelect.dataset.connectionId;
                const year = e.target.value;

                if (connectionId && year) {
                    this.loadAvailableMonths(connectionId, year);
                } else {
                    const monthSelect = document.getElementById('monthSelect');
                    if (monthSelect) {
                        monthSelect.innerHTML = '<option value="">Primero seleccione año</option>';
                        monthSelect.disabled = true;
                    }
                    const previewBtn = document.getElementById('previewBtn');
                    if (previewBtn) previewBtn.disabled = true;
                }
            });
        }

        // ✅ EVENTO PARA CUANDO CAMBIA EL MES
        const monthSelect = document.getElementById('monthSelect');
        if (monthSelect) {
            monthSelect.addEventListener('change', async (e) => {
                const year = document.getElementById('yearSelect').value;
                const month = e.target.value;
                const connectionId = this.currentConnectionId;

                if (connectionId && year && month) {
                    // Limpiar y deshabilitar bankSelect mientras carga
                    const bankSelect = document.getElementById('bankSelect');
                    if (bankSelect) {
                        bankSelect.innerHTML = '<option value="">Cargando bancos...</option>';
                        bankSelect.disabled = true;
                    }
                    const previewBtn = document.getElementById('previewBtn');
                    if (previewBtn) previewBtn.disabled = true;

                    await this.loadAvailableBanks(connectionId, year, month);
                }
            });
        }

        // ✅ EVENTO PARA CUANDO CAMBIA EL BANCO
        const bankSelect = document.getElementById('bankSelect');
        if (bankSelect) {
            // Remove existing event listener to avoid duplicates
            const newBankSelect = bankSelect.cloneNode(true);
            bankSelect.parentNode.replaceChild(newBankSelect, bankSelect);

            newBankSelect.addEventListener('change', (e) => {
                const previewBtn = document.getElementById('previewBtn');
                if (previewBtn) {
                    previewBtn.disabled = !e.target.value;
                    console.log('Banco seleccionado:', e.target.value);
                }
            });
        }

        // ✅ EVENTO PARA CUANDO CAMBIA LA CONEXIÓN EN EL SELECTOR
        const connectionSelect = document.getElementById('connectionSelect');
        if (connectionSelect) {
            connectionSelect.addEventListener('change', async (e) => {
                const connectionId = e.target.value;
                if (connectionId) {
                    this.currentConnectionId = connectionId;

                    // Limpiar selects
                    const yearSelectEl = document.getElementById('yearSelect');
                    const monthSelectEl = document.getElementById('monthSelect');
                    const previewBtn = document.getElementById('previewBtn');

                    if (yearSelectEl) {
                        yearSelectEl.innerHTML = '<option value="">Cargando años...</option>';
                        yearSelectEl.disabled = true;
                    }
                    if (monthSelectEl) {
                        monthSelectEl.innerHTML = '<option value="">Primero seleccione año</option>';
                        monthSelectEl.disabled = true;
                    }
                    if (previewBtn) previewBtn.disabled = true;

                    await this.loadAvailableYears(connectionId);
                }
            });
        }

        // Botón previsualizar
        const previewBtn = document.getElementById('previewBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.preview());
        }

        // Botón cancelar
        const cancelBtn = document.getElementById('cancelMigrationBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('mappingPanel').style.display = 'none';
                this.currentSessionId = null;
                this.previewData = [];
                this.transactionMappings = {};
            });
        }

        // Botón ejecutar
        const executeBtn = document.getElementById('executeMigrationBtn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeMigration());
        }
    },

    async deleteConnection(connectionId) {
        if (!confirm('¿Está seguro de eliminar esta conexión? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            const response = await api.delete(`api/migrations/connections/${connectionId}`);
            if (response.success) {
                showAlert('Conexión eliminada exitosamente', 'success');
                await this.loadConnections();

                // Recargar la lista de conexiones
                const connectionsList = document.getElementById('connectionsList');
                if (connectionsList) {
                    connectionsList.innerHTML = this.renderConnectionsList();
                }

                // Si el panel de migración estaba abierto, cerrarlo
                document.getElementById('migrationPanel').style.display = 'none';
                document.getElementById('mappingPanel').style.display = 'none';
            } else {
                showAlert(response.message || 'Error al eliminar la conexión', 'danger');
            }
        } catch (error) {
            console.error('Error deleting connection:', error);
            showAlert('Error al eliminar la conexión', 'danger');
        }
    },

    showConnectionModal() {
        showAlert('Funcionalidad de crear conexión en desarrollo', 'info');
    }
};