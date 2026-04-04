// modules/bank-accounts.js
import { api } from '../services/apiService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const bankAccountsModule = {
    accounts: [],
    banks: [],
    currencies: [],
    dataTable: null,

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Cuentas Bancarias</h1>
                <button class="btn btn-primary" id="addBankAccountBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Cuenta Bancaria
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="bankAccountsTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Banco</th>
                                    <th>Número de Cuenta</th>
                                    <th>Tipo</th>
                                    <th>Moneda</th>
                                    <th>Titular</th>
                                    <th>Saldo Apertura</th>
                                    <th>Saldo Actual</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="bankAccountsTableBody">
                                <tr><td colspan="10" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        await this.loadBanks();
        await this.loadCurrencies();
        await this.loadBankAccounts();
        this.setupEventListeners();
    },

    async loadBanks() {
        try {
            const response = await api.get('api/banks');
            if (response.success && response.data) {
                this.banks = response.data.filter(b => b.is_active);
            }
        } catch (error) {
            console.error('Error loading banks:', error);
        }
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

    async loadBankAccounts() {
        try {
            const response = await api.get('api/bank-accounts');
            if (response.success && response.data) {
                this.accounts = response.data;
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading bank accounts:', error);
            showAlert('Error al cargar las cuentas bancarias', 'danger');
        }
    },

    getBankName(bankId) {
        const bank = this.banks.find(b => b.id === bankId);
        return bank ? bank.name : '-';
    },

    getCurrencySymbol(currencyId) {
        const currency = this.currencies.find(c => c.id === currencyId);
        return currency ? currency.symbol : '$';
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        // Calcular estadísticas
        const totalAccounts = this.accounts.length;
        const totalBalance = this.accounts.reduce((sum, acc) => sum + (parseFloat(acc.current_balance) || 0), 0);
        const activeAccounts = this.accounts.filter(a => a.is_active).length;

        const tableData = this.accounts.map(account => [
            account.id,
            this.getBankName(account.bank_id),
            account.account_number,
            this.getAccountTypeLabel(account.account_type),
            `${this.getCurrencySymbol(account.currency_id)} ${account.currency_code || ''}`,
            account.account_holder || '-',
            formatCurrency(account.opening_balance || 0),
            formatCurrency(account.current_balance || 0),
            `<span class="badge ${account.is_active ? 'bg-success' : 'bg-danger'}">
            ${account.is_active ? 'Activo' : 'Inactivo'}
        </span>`,
            `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary edit-account" data-id="${account.id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger delete-account" data-id="${account.id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `
        ]);

        this.dataTable = $('#bankAccountsTable').DataTable({
            data: tableData,
            language: {
                url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json'
            },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 9, orderable: false, searchable: false }
            ],
            dom: '<"row"<"col-sm-6"B><"col-sm-6"f>>' +
                '<"row"<"col-sm-12"tr>>' +
                '<"row"<"col-sm-5"i><"col-sm-7"p>>',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8] }
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8] }
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8] },
                    title: 'Cuentas_Bancarias',
                    filename: 'cuentas_bancarias_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8] },
                    title: 'Reporte de Cuentas Bancarias',
                    filename: 'cuentas_bancarias_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
                    orientation: 'landscape',
                    pageSize: 'A4',
                    customize: function (doc) {
                        doc.content.splice(0, 0, {
                            text: [
                                { text: 'FlowControl - Sistema de Flujo de Caja\n', fontSize: 16, bold: true },
                                { text: 'Reporte de Cuentas Bancarias\n', fontSize: 14 },
                                { text: `Generado: ${new Date().toLocaleString()}`, fontSize: 10, italics: true }
                            ],
                            margin: [0, 0, 0, 20]
                        });

                        doc.content.push({
                            text: [
                                `Total Cuentas: ${totalAccounts} | `,
                                `Cuentas Activas: ${activeAccounts} | `,
                                `Saldo Total: ${formatCurrency(totalBalance)}`
                            ],
                            fontSize: 10,
                            margin: [0, 0, 0, 10]
                        });
                    }
                },
                {
                    extend: 'print',
                    text: '<i class="bi bi-printer"></i> Imprimir',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: { columns: [1, 2, 3, 4, 5, 6, 7, 8] },
                    title: 'Reporte de Cuentas Bancarias',
                    customize: function (win) {
                        $(win.document.body).find('table').addClass('table table-bordered');
                        $(win.document.body).prepend(`
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2>FlowControl - Sistema de Flujo de Caja</h2>
                            <h3>Reporte de Cuentas Bancarias</h3>
                            <p>Generado: ${new Date().toLocaleString()}</p>
                            <hr>
                        </div>
                    `);
                    }
                }
            ],
            drawCallback: () => {
                this.attachTableEvents();
                this.updateTableFooter(totalAccounts, activeAccounts, totalBalance);
            }
        });

        this.attachTableEvents();
    },

    /**
     * Actualizar el footer de la tabla con estadísticas
     */
    updateTableFooter(totalAccounts, activeAccounts, totalBalance) {
        let footer = document.getElementById('bankAccountsTableFooter');
        if (!footer) {
            const tfoot = document.querySelector('#bankAccountsTable tfoot');
            if (!tfoot) {
                const table = document.getElementById('bankAccountsTable');
                const tfootElement = document.createElement('tfoot');
                table.appendChild(tfootElement);
            }
            footer = document.querySelector('#bankAccountsTable tfoot');
            footer.id = 'bankAccountsTableFooter';
        }

        footer.innerHTML = `
        <tr class="table-active">
            <td colspan="5" class="text-end fw-bold">Resumen:</td>
            <td><strong>Total:</strong> ${totalAccounts}</td>
            <td><strong>Activas:</strong> ${activeAccounts}</td>
            <td colspan="2"><strong>Saldo Total:</strong> ${formatCurrency(totalBalance)}</td>
            <td></td>
        </tr>
    `;
    },

    getAccountTypeLabel(type) {
        const labels = {
            'corriente': 'Corriente',
            'ahorros': 'Ahorros',
            'nomina': 'Nómina',
            'inversion': 'Inversión'
        };
        return labels[type] || type;
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const account = this.accounts.find(a => a.id === id);
                if (account) this.showBankAccountModal(account);
            });
        });

        document.querySelectorAll('.delete-account').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const account = this.accounts.find(a => a.id === id);
                if (!account) return;

                const confirmed = confirm(`¿Está seguro de eliminar la cuenta "${account.account_number}"?\n\nEsta acción no eliminará las transacciones asociadas.`);
                if (!confirmed) return;

                try {
                    const response = await api.delete(`api/bank-accounts/${id}`);
                    if (response.success) {
                        showAlert('Cuenta bancaria eliminada exitosamente', 'success');
                        await this.loadBankAccounts();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar la cuenta', 'danger');
                }
            });
        });
    },

    showBankAccountModal(account = null) {
        const isEditing = !!account;

        const modalHtml = `
            <div class="modal fade" id="bankAccountModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-wallet2"></i> ${isEditing ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="bankAccountForm">
                                <div class="mb-3">
                                    <label class="form-label">Banco *</label>
                                    <select class="form-select" id="bankId" required>
                                        <option value="">Seleccione un banco</option>
                                        ${this.banks.map(b => `
                                            <option value="${b.id}" ${account && account.bank_id === b.id ? 'selected' : ''}>
                                                ${b.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Número de Cuenta *</label>
                                    <input type="text" class="form-control" id="accountNumber" 
                                           value="${account ? account.account_number : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Tipo de Cuenta</label>
                                    <select class="form-select" id="accountType">
                                        <option value="corriente" ${account && account.account_type === 'corriente' ? 'selected' : ''}>Corriente</option>
                                        <option value="ahorros" ${account && account.account_type === 'ahorros' ? 'selected' : ''}>Ahorros</option>
                                        <option value="nomina" ${account && account.account_type === 'nomina' ? 'selected' : ''}>Nómina</option>
                                        <option value="inversion" ${account && account.account_type === 'inversion' ? 'selected' : ''}>Inversión</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Moneda *</label>
                                    <select class="form-select" id="currencyId" required>
                                        <option value="">Seleccione una moneda</option>
                                        ${this.currencies.map(c => `
                                            <option value="${c.id}" ${account && account.currency_id === c.id ? 'selected' : ''}>
                                                ${c.code} - ${c.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Titular de la Cuenta</label>
                                    <input type="text" class="form-control" id="accountHolder" 
                                           value="${account ? account.account_holder || '' : ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Saldo de Apertura</label>
                                    <input type="number" class="form-control" id="openingBalance" 
                                           step="0.01" value="${account ? account.opening_balance || 0 : 0}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Estado</label>
                                    <select class="form-select" id="accountStatus">
                                        <option value="1" ${account && account.is_active ? 'selected' : ''}>Activo</option>
                                        <option value="0" ${account && !account.is_active ? 'selected' : ''}>Inactivo</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveBankAccountBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('bankAccountModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('bankAccountModal');
        const modal = new bootstrap.Modal(modalElement);

        const saveBtn = document.getElementById('saveBankAccountBtn');
        saveBtn.addEventListener('click', async () => {
            const data = {
                bank_id: parseInt(document.getElementById('bankId').value),
                account_number: document.getElementById('accountNumber').value.trim(),
                account_type: document.getElementById('accountType').value,
                currency_id: parseInt(document.getElementById('currencyId').value),
                account_holder: document.getElementById('accountHolder').value.trim(),
                opening_balance: parseFloat(document.getElementById('openingBalance').value) || 0,
                is_active: parseInt(document.getElementById('accountStatus').value)
            };

            if (!data.bank_id || !data.account_number || !data.currency_id) {
                showAlert('Por favor complete los campos requeridos', 'warning');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await api.put(`api/bank-accounts/${account.id}`, data);
                    if (response.success) showAlert('Cuenta actualizada exitosamente', 'success');
                } else {
                    response = await api.post('api/bank-accounts', data);
                    if (response.success) showAlert('Cuenta creada exitosamente', 'success');
                }

                modal.hide();
                await this.loadBankAccounts();
            } catch (error) {
                showAlert(error.message || 'Error al guardar la cuenta', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addBankAccountBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showBankAccountModal());
        }
    }
};