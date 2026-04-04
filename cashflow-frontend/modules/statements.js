// modules/statements.js - Versión con tabla simple sin paginación

import { api } from '../services/apiService.js';
import { uploadService } from '../services/uploadService.js';
import { bankService } from '../services/bankService.js';
import { bankAccountService } from '../services/bankAccountService.js';
import { accountService } from '../services/accountService.js';
import { formatAmountWithDecimals, formatCurrency, formatDate, showAlert } from '../utils/helpers.js';

export const statementsModule = {
    banks: [],
    bankAccounts: [],
    incomeAccounts: [],
    expenseAccounts: [],
    currentSessionId: null,
    fullPreviewData: [],
    transactionMappings: {},

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Carga Masiva de Estados de Cuenta</h1>
            </div>
            
            <!-- Panel de carga - Parte superior -->
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-cloud-upload"></i> Cargar Archivo</h5>
                </div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <label class="form-label fw-semibold">Banco *</label>
                            <select class="form-select" id="bankSelect" required>
                                <option value="">Seleccione un banco</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-semibold">Cuenta Bancaria</label>
                            <select class="form-select" id="bankAccountSelect">
                                <option value="">Seleccione una cuenta (opcional)</option>
                            </select>
                            <small class="text-muted d-block mt-1">Si selecciona una cuenta, se usará su moneda para conversión</small>
                        </div>
                        <div class="col-md-5">
                            <label class="form-label fw-semibold">Archivo *</label>
                            <div class="row g-2">
                                <div class="col-12">
                                    <input type="file" class="form-control" id="statementFile" accept=".xlsx,.xls,.csv">
                                    <small class="text-muted d-block mt-1">Formatos: XLSX, XLS, CSV (máx 5MB)</small>
                                </div>
                                <div class="row col-12 g-2">
                                    <div class="col-6"></div>
                                    <div class="col-6">
                                        <button class="btn btn-primary w-100" id="uploadBtn">
                                            <i class="bi bi-cloud-upload"></i> Cargar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            
            <!-- Resumen de la carga -->
            <div id="summaryPanel" style="display: none;">
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="card bg-light">
                            <div class="card-body text-center">
                                <h6 class="text-muted">Total Transacciones</h6>
                                <h3 id="totalTransactions" class="mb-0">0</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light">
                            <div class="card-body text-center">
                                <h6 class="text-muted">Ingresos</h6>
                                <h3 id="totalIncome" class="mb-0 text-success">$0</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light">
                            <div class="card-body text-center">
                                <h6 class="text-muted">Egresos</h6>
                                <h3 id="totalExpense" class="mb-0 text-danger">$0</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light">
                            <div class="card-body text-center">
                                <h6 class="text-muted">Neto</h6>
                                <h3 id="totalNet" class="mb-0">$0</h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Panel de previsualización y mapeo -->
            <div id="mappingPanel" class="card shadow-sm" style="display: none;">
                <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
                    <h5 class="mb-0"><i class="bi bi-eye"></i> Previsualización y Mapeo</h5>
                    <div>
                        <button class="btn btn-sm btn-light me-2" id="quickMapIncomeBtn" title="Mapear todos los ingresos a la misma cuenta">
                            <i class="bi bi-cash-stack"></i> Mapear Ingresos
                        </button>
                        <button class="btn btn-sm btn-light me-2" id="quickMapExpenseBtn" title="Mapear todos los egresos a la misma cuenta">
                            <i class="bi bi-cash"></i> Mapear Egresos
                        </button>
                        <button class="btn btn-sm btn-warning" id="quickMapAllBtn" title="Mapear todas las transacciones a la misma cuenta">
                            <i class="bi bi-check-all"></i> Mapear Todo
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="alert alert-warning mb-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <strong>Importante:</strong> Asigne cada transacción a una cuenta contable.
                    </div>
                    
                    <!-- Barra de progreso -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between mb-1">
                            <span>Progreso de mapeo:</span>
                            <span id="mappingInfoText">0 de 0 transacciones mapeadas</span>
                        </div>
                        <div class="progress">
                            <div id="mappingProgress" class="progress-bar bg-info" role="progressbar" style="width: 0%">0%</div>
                        </div>
                    </div>
                    
                    <!-- Tabla simple con scroll -->
                    <div style="max-height: 500px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.375rem;">
                        <table class="table table-hover table-striped mb-0" id="previewTable">
                            <thead style="position: sticky; top: 0; background-color: #f8f9fa; z-index: 10;">
                                <tr>
                                    <th style="min-width: 100px;">Fecha</th>
                                    <th style="min-width: 120px;">Referencia</th>
                                    <th style="min-width: 250px;">Descripción</th>
                                    <th style="min-width: 120px;">Monto</th>
                                    <th style="min-width: 100px;">Tipo</th>
                                    <th style="min-width: 250px;">Cuenta</th>
                                </tr>
                            </thead>
                            <tbody id="previewTableBody">
                                <tr>
                                    <td colspan="6" class="text-center text-muted">Cargando...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-3 d-flex justify-content-end gap-2">
                        <button class="btn btn-secondary" id="cancelImportBtn">
                            <i class="bi bi-x-circle"></i> Cancelar
                        </button>
                        <button class="btn btn-success" id="saveMappingsBtn" disabled>
                            <i class="bi bi-save"></i> Importar Transacciones
                        </button>
                    </div>
                </div>
            </div>
        `;

        await this.loadBanks();
        await this.loadBankAccounts();
        await this.loadAccounts();
        this.setupEventListeners();
    },

    async loadBanks() {
        try {
            const response = await uploadService.getBanks();
            if (response.success && response.data) {
                this.banks = response.data;
                const select = document.getElementById('bankSelect');
                select.innerHTML = '<option value="">Seleccione un banco</option>' +
                    this.banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading banks:', error);
            showAlert('Error al cargar los bancos', 'danger');
        }
    },

    async loadBankAccounts() {
        try {
            const response = await uploadService.getBankAccounts();
            if (response.success && response.data) {
                this.bankAccounts = response.data;
                this.updateBankAccountsFilter();
            }
        } catch (error) {
            console.error('Error loading bank accounts:', error);
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

    updateBankAccountsFilter() {
        const bankId = document.getElementById('bankSelect').value;
        const bankAccountSelect = document.getElementById('bankAccountSelect');

        if (!bankId) {
            bankAccountSelect.innerHTML = '<option value="">Seleccione una cuenta (opcional)</option>' +
                this.bankAccounts.map(ba => `<option value="${ba.id}">${ba.bank_name} - ${ba.account_number} (${ba.currency_code})</option>`).join('');
            return;
        }

        const filtered = this.bankAccounts.filter(ba => ba.bank_id == bankId);
        bankAccountSelect.innerHTML = '<option value="">Seleccione una cuenta (opcional)</option>' +
            filtered.map(ba => `<option value="${ba.id}">${ba.account_number} (${ba.currency_code})</option>`).join('');
    },

    setupEventListeners() {
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadFile());
        }

        const cancelBtn = document.getElementById('cancelImportBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelImport());
        }

        const saveBtn = document.getElementById('saveMappingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveMappings());
        }

        const quickMapIncomeBtn = document.getElementById('quickMapIncomeBtn');
        if (quickMapIncomeBtn) {
            quickMapIncomeBtn.addEventListener('click', () => this.showQuickMapModal('income'));
        }

        const quickMapExpenseBtn = document.getElementById('quickMapExpenseBtn');
        if (quickMapExpenseBtn) {
            quickMapExpenseBtn.addEventListener('click', () => this.showQuickMapModal('expense'));
        }

        const quickMapAllBtn = document.getElementById('quickMapAllBtn');
        if (quickMapAllBtn) {
            quickMapAllBtn.addEventListener('click', () => this.showQuickMapModal('all'));
        }

        const bankSelect = document.getElementById('bankSelect');
        if (bankSelect) {
            bankSelect.addEventListener('change', () => this.updateBankAccountsFilter());
        }
    },

    async uploadFile() {
        const bankId = document.getElementById('bankSelect').value;
        const bankAccountId = document.getElementById('bankAccountSelect').value;
        const fileInput = document.getElementById('statementFile');
        const file = fileInput.files[0];

        if (!bankId) {
            showAlert('Seleccione un banco', 'warning');
            return;
        }

        if (!file) {
            showAlert('Seleccione un archivo', 'warning');
            return;
        }

        const uploadBtn = document.getElementById('uploadBtn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Procesando...';

        try {
            const response = await uploadService.uploadStatement(bankId, bankAccountId, file);

            if (response.success && response.data) {
                this.currentSessionId = response.data.session_id;
                // ✅ Asegurar que los datos incluyen el id
                this.fullPreviewData = response.data.preview.map((item, index) => ({
                    ...item,
                    id: response.data.preview_ids ? response.data.preview_ids[index] : index + 1
                }));
                this.transactionMappings = {};

                this.renderPreviewTable();
                this.updateSummary();
                this.showMappingPanel();

                showAlert(`Archivo procesado. ${this.fullPreviewData.length} transacciones encontradas.`, 'success');
            } else {
                showAlert(response.message || 'Error al procesar el archivo', 'danger');
            }

        } catch (error) {
            console.error('Error uploading file:', error);
            showAlert(error.message || 'Error al procesar el archivo', 'danger');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
        }
    },

    renderPreviewTable() {
        const tbody = document.getElementById('previewTableBody');

        if (!this.fullPreviewData || this.fullPreviewData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay datos para mostrar</td></tr>';
            return;
        }

        let html = '';

        this.fullPreviewData.forEach((transaction, index) => {
            const accounts = transaction.transaction_type === 'income' ? this.incomeAccounts : this.expenseAccounts;
            const savedMapping = this.transactionMappings[transaction.id];

            let selectHtml = `<select class="form-select form-select-sm account-select" data-id="${transaction.id}" data-type="${transaction.transaction_type}" style="min-width: 200px;">
            <option value="">Seleccione una cuenta...</option>`;

            accounts.forEach(acc => {
                const selected = savedMapping == acc.id ? 'selected' : '';
                selectHtml += `<option value="${acc.id}" ${selected}>${acc.name} (${acc.category})</option>`;
            });

            selectHtml += `</select>`;

            // ✅ Usar la función importada o local
            const formattedAmount = typeof formatAmountWithDecimals === 'function'
                ? formatAmountWithDecimals(Math.abs(transaction.amount))
                : this.formatAmountWithDecimals(Math.abs(transaction.amount));

            html += `
            <tr>
                <td style="white-space: nowrap;">${transaction.date}</td>
                <td style="white-space: nowrap;">${transaction.reference || '-'}</td>
                <td title="${transaction.description}">${transaction.description.length > 80 ? transaction.description.substring(0, 80) + '...' : transaction.description}</td>
                <td class="${transaction.transaction_type === 'income' ? 'text-success' : 'text-danger'} fw-bold" style="white-space: nowrap;">
                    ${formattedAmount}
                </td>
                <td style="white-space: nowrap;">
                    <span class="badge ${transaction.transaction_type === 'income' ? 'bg-success' : 'bg-danger'}">
                        ${transaction.transaction_type === 'income' ? 'Ingreso' : 'Egreso'}
                    </span>
                </td>
                <td>${selectHtml}</td>
            </td>
        `;
        });

        tbody.innerHTML = html;
        this.attachSelectEvents();
        this.updateMappingProgress();
    },

    attachSelectEvents() {
        document.querySelectorAll('.account-select').forEach(select => {
            const transactionId = parseInt(select.dataset.id);

            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);

            if (this.transactionMappings && this.transactionMappings[transactionId]) {
                newSelect.value = this.transactionMappings[transactionId];
                if (newSelect.value) {
                    newSelect.classList.add('border-success');
                }
            }

            newSelect.addEventListener('change', () => {
                const id = parseInt(newSelect.dataset.id);
                const accountId = newSelect.value;

                if (accountId) {
                    this.transactionMappings[id] = parseInt(accountId);
                    newSelect.classList.add('border-success');
                } else {
                    delete this.transactionMappings[id];
                    newSelect.classList.remove('border-success');
                }
                this.updateMappingProgress();
            });
        });
    },

    updateMappingProgress() {
        const totalTransactions = this.fullPreviewData ? this.fullPreviewData.length : 0;
        const mappedCount = Object.keys(this.transactionMappings || {}).length;
        const percent = totalTransactions > 0 ? (mappedCount / totalTransactions) * 100 : 0;

        const progressBar = document.getElementById('mappingProgress');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.textContent = `${Math.round(percent)}%`;
            progressBar.className = `progress-bar ${percent === 100 ? 'bg-success' : 'bg-info'}`;
        }

        const infoText = document.getElementById('mappingInfoText');
        if (infoText) {
            infoText.innerHTML = `${mappedCount} de ${totalTransactions} transacciones mapeadas`;
            if (mappedCount === totalTransactions && totalTransactions > 0) {
                infoText.innerHTML += '<span class="text-success ms-2">✓ Listo para importar</span>';
            }
        }

        const saveBtn = document.getElementById('saveMappingsBtn');
        if (saveBtn) {
            saveBtn.disabled = mappedCount !== totalTransactions;
        }
    },

    updateSummary() {
        if (!this.fullPreviewData) return;

        const totalTransactions = this.fullPreviewData.length;
        const totalIncome = this.fullPreviewData.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalExpense = this.fullPreviewData.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalNet = totalIncome - totalExpense;

        document.getElementById('totalTransactions').textContent = totalTransactions;
        document.getElementById('totalIncome').innerHTML = formatAmountWithDecimals(totalIncome.toFixed(2));
        document.getElementById('totalExpense').innerHTML = formatAmountWithDecimals(totalExpense.toFixed(2));
        document.getElementById('totalNet').innerHTML = formatAmountWithDecimals(totalNet.toFixed(2));
        document.getElementById('totalNet').className = `mb-0 ${totalNet >= 0 ? 'text-success' : 'text-danger'}`;

        document.getElementById('summaryPanel').style.display = 'block';
    },

    showMappingPanel() {
        document.getElementById('mappingPanel').style.display = 'block';
    },

    showQuickMapModal(type) {
        const accounts = type === 'income' ? this.incomeAccounts : (type === 'expense' ? this.expenseAccounts : [...this.incomeAccounts, ...this.expenseAccounts]);

        const modalHtml = `
            <div class="modal fade" id="quickMapModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-check-all"></i> Mapeo Rápido
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Seleccione la cuenta para todas las transacciones de tipo 
                            <strong>${type === 'income' ? 'INGRESO' : (type === 'expense' ? 'EGRESO' : 'TODAS')}</strong>:</p>
                            <select class="form-select" id="quickMapAccount">
                                <option value="">Seleccione una cuenta...</option>
                                ${accounts.map(acc => `<option value="${acc.id}">${acc.name} (${acc.category})</option>`).join('')}
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="confirmQuickMapBtn">Aplicar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('quickMapModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('quickMapModal');
        const modal = new bootstrap.Modal(modalElement);

        const confirmBtn = document.getElementById('confirmQuickMapBtn');
        confirmBtn.addEventListener('click', () => {
            const accountId = document.getElementById('quickMapAccount').value;
            if (!accountId) {
                showAlert('Seleccione una cuenta', 'warning');
                return;
            }

            this.fullPreviewData.forEach((transaction, index) => {
                if (type === 'all' || transaction.transaction_type === type) {
                    this.transactionMappings[index] = parseInt(accountId);
                }
            });

            this.renderPreviewTable();
            this.updateMappingProgress();
            modal.hide();
            showAlert(`Mapeo rápido aplicado correctamente`, 'success');
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    async saveMappings() {
        const totalTransactions = this.fullPreviewData ? this.fullPreviewData.length : 0;
        const mappedCount = Object.keys(this.transactionMappings || {}).length;

        if (mappedCount !== totalTransactions) {
            showAlert(`Faltan ${totalTransactions - mappedCount} transacciones por mapear`, 'warning');
            return;
        }

        const mappings = Object.entries(this.transactionMappings).map(([transactionId, accountId]) => ({
            transaction_id: parseInt(transactionId),
            account_id: parseInt(accountId)
        }));

        const saveBtn = document.getElementById('saveMappingsBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Importando...';

        try {
            const response = await uploadService.mapTransactions(this.currentSessionId, mappings);
            if (response.success) {
                let message = response.message;
                if (response.data && response.data.duplicated > 0) {
                    message += `\n\n⚠️ ${response.data.duplicated} transacciones duplicadas fueron omitidas.`;
                }
                showAlert(message, response.data.duplicated > 0 ? 'warning' : 'success');
                this.cancelImport();
            } else {
                showAlert(response.message || 'Error al importar las transacciones', 'danger');
            }
        } catch (error) {
            console.error('Error saving mappings:', error);
            showAlert(error.message || 'Error al importar las transacciones', 'danger');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    },
    cancelImport() {
        document.getElementById('bankSelect').value = '';
        document.getElementById('bankAccountSelect').innerHTML = '<option value="">Seleccione una cuenta (opcional)</option>';
        document.getElementById('statementFile').value = '';
        document.getElementById('summaryPanel').style.display = 'none';
        document.getElementById('mappingPanel').style.display = 'none';
        document.getElementById('previewTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted">Cargando...</td></tr>';

        this.currentSessionId = null;
        this.fullPreviewData = [];
        this.transactionMappings = {};

        showAlert('Importación cancelada', 'info');
    }

};