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
            
            <!-- Panel de conexiones -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-info text-white">
                    <h5 class="mb-0"><i class="bi bi-plug"></i> Conexiones a Bases de Datos Externas</h5>
                </div>
                <div class="card-body">
                    <div id="connectionsList">
                        ${this.renderConnectionsList()}
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
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Año</label>
                            <select class="form-select" id="yearSelect" disabled>
                                <option value="">Primero seleccione conexión</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Mes</label>
                            <select class="form-select" id="monthSelect" disabled>
                                <option value="">Primero seleccione año</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100" id="previewBtn" disabled>
                                <i class="bi bi-eye"></i> Previsualizar
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
            return `<div class="alert alert-info">No hay conexiones configuradas. <a href="#" id="addConnectionLink">Cree una nueva</a></div>`;
        }

        return `
            <div class="row">
                ${this.connections.map(conn => `
                    <div class="col-md-6 mb-3">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">
                                    <i class="bi bi-server"></i> ${conn.name}
                                    ${conn.company_name ? `<span class="badge bg-secondary ms-2">${conn.company_name}</span>` : ''}
                                </h6>
                                <p class="card-text small text-muted">
                                    Host: ${conn.host}:${conn.port}<br>
                                    Base de datos: ${conn.db_name}<br>
                                    Tabla: ${conn.table_name}
                                </p>
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
                `).join('')}
            </div>
        `;
    },

    async loadConnections() {
        try {
            const response = await api.get('api/migrations/connections');
            if (response.success && response.data) {
                this.connections = response.data;
                console.log('Conexiones cargadas:', this.connections.length);
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

        // Configurar selector de conexión
        const connectionSelect = document.getElementById('connectionSelect');
        if (connectionSelect) {
            connectionSelect.value = connectionId;
            connectionSelect.disabled = false;
        }

        // ✅ Limpiar selects de año y mes
        const yearSelect = document.getElementById('yearSelect');
        const monthSelect = document.getElementById('monthSelect');
        const previewBtn = document.getElementById('previewBtn');

        if (yearSelect) {
            yearSelect.innerHTML = '<option value="">Cargando años...</option>';
            yearSelect.disabled = true;
        }
        if (monthSelect) {
            monthSelect.innerHTML = '<option value="">Primero seleccione año</option>';
            monthSelect.disabled = true;
        }
        if (previewBtn) previewBtn.disabled = true;

        // Cargar años disponibles
        await this.loadAvailableYears(connectionId);
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

    async preview() {
        const connectionId = document.getElementById('connectionSelect').value;
        const year = document.getElementById('yearSelect').value;
        const month = document.getElementById('monthSelect').value;

        if (!connectionId || !year || !month) {
            showAlert('Seleccione conexión, año y mes', 'warning');
            return;
        }

        const previewBtn = document.getElementById('previewBtn');
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';

        try {
            const response = await api.post('api/migrations/preview', {
                connection_id: parseInt(connectionId),
                year: parseInt(year),
                month: parseInt(month)
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
                        ${ formattedAmount }
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
            monthSelect.addEventListener('change', (e) => {
                const previewBtn = document.getElementById('previewBtn');
                if (previewBtn) {
                    previewBtn.disabled = !e.target.value;
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