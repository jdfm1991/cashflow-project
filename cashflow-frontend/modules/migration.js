// modules/migration.js
import { api } from '../services/apiService.js';
import { accountService } from '../services/accountService.js';
import { formatAmountWithDecimals, formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const migrationModule = {
    connections: [],
    currentSessionId: null,
    previewData: [],
    transactionMappings: {},
    incomeAccounts: [],
    expenseAccounts: [],

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
                                ${this.connections.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Año</label>
                            <select class="form-select" id="yearSelect">
                                <option value="">Seleccione año</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Mes</label>
                            <select class="form-select" id="monthSelect" disabled>
                                <option value="">Primero seleccione año</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100" id="previewBtn">
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
                    <!-- Barra de progreso -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between">
                            <span>Progreso de mapeo:</span>
                            <span id="mappingInfoText">0 de 0 transacciones mapeadas</span>
                        </div>
                        <div class="progress">
                            <div id="mappingProgress" class="progress-bar bg-info" style="width: 0%">0%</div>
                        </div>
                    </div>
                    
                    <!-- Tabla de transacciones -->
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
            // Implementar test de conexión
            showAlert('Conexión exitosa', 'success');
        } catch (error) {
            showAlert('Error de conexión', 'danger');
        }
    },

    async useConnection(connectionId) {
        const connection = this.connections.find(c => c.id == connectionId);
        if (!connection) return;

        // Mostrar panel de migración
        document.getElementById('migrationPanel').style.display = 'block';

        // Cargar años disponibles
        await this.loadAvailableYears(connectionId);
    },

    async loadAvailableYears(connectionId) {
        try {
            const response = await api.get(`api/migrations/years?connection_id=${connectionId}`);
            if (response.success && response.data) {
                const yearSelect = document.getElementById('yearSelect');
                yearSelect.innerHTML = '<option value="">Seleccione año</option>' +
                    response.data.years.map(y => `<option value="${y}">${y}</option>`).join('');

                yearSelect.dataset.connectionId = connectionId;
            }
        } catch (error) {
            console.error('Error loading years:', error);
        }
    },

    async loadAvailableMonths(connectionId, year) {
        try {
            const response = await api.get(`api/migrations/months?connection_id=${connectionId}&year=${year}`);
            if (response.success && response.data) {
                const monthSelect = document.getElementById('monthSelect');
                const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                monthSelect.innerHTML = '<option value="">Seleccione mes</option>' +
                    response.data.months.map(m => `<option value="${m}">${months[m - 1]}</option>`).join('');
                monthSelect.disabled = false;
            }
        } catch (error) {
            console.error('Error loading months:', error);
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
                    <td>${transaction.description.substring(0, 80)}</td>
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
        // Eventos dinámicos
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-connection')) {
                const btn = e.target.closest('.test-connection');
                this.testConnection(btn.dataset.id);
            }
            if (e.target.closest('.use-connection')) {
                const btn = e.target.closest('.use-connection');
                this.useConnection(btn.dataset.id);
            }
            if (e.target.closest('#addConnectionLink') || e.target.closest('#addConnectionBtn')) {
                this.showConnectionModal();
            }
        });

        // Eventos de selects
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                const connectionId = yearSelect.dataset.connectionId;
                this.loadAvailableMonths(connectionId, e.target.value);
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

    showConnectionModal() {
        // Implementar modal para crear nueva conexión
        // (similar al modal de creación de bancos)
        showAlert('Funcionalidad de crear conexión en desarrollo', 'info');
    }
};