import { accountService } from '../services/accountService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const accountsModule = {
    accounts: [],
    dataTable: null,
    currentType: 'income',

    async render(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Gestión de Cuentas</h1>
                <button class="btn btn-primary" id="addAccountBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Cuenta
                </button>
            </div>
            
            <!-- Tabs para ingresos/egresos -->
            <ul class="nav nav-tabs mb-3" id="accountTabs">
                <li class="nav-item">
                    <button class="nav-link active" data-type="income">
                        <i class="bi bi-cash-stack me-1"></i> Cuentas de Ingresos
                    </button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-type="expense">
                        <i class="bi bi-cash me-1"></i> Cuentas de Egresos
                    </button>
                </li>
            </ul>
            
            <!-- Tabla de cuentas con DataTables -->
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="accountsTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th>Categoría</th>
                                    <th>Descripción</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="accountsTableBody">
                                <tr><td colspan="7" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        await this.loadAccounts();
    },

    async loadAccounts() {
        const container = document.getElementById('accountsTableBody');

        try {
            const response = await accountService.getAll(this.currentType);

            if (response.success && response.data) {
                this.accounts = response.data;
                this.renderDataTable();
            } else {
                container.innerHTML = '<tr><td colspan="7" class="text-center">No hay cuentas registradas</td></tr>';
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            container.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar las cuentas</td></tr>';
        }
    },

    renderDataTable() {
        // Destruir tabla existente si ya está inicializada
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        // Preparar datos para DataTables
        const tableData = this.accounts.map(account => [
            account.id,
            account.name,
            `<span class="badge ${account.type === 'income' ? 'bg-success' : 'bg-danger'}">
            ${account.type === 'income' ? 'Ingreso' : 'Egreso'}
        </span>`,
            this.getCategoryLabel(account.category),
            account.description || '-',
            `
            <div class="form-check form-switch">
                <input class="form-check-input toggle-status" type="checkbox" 
                       data-id="${account.id}" 
                       ${account.is_active ? 'checked' : ''}
                       role="switch"
                       id="toggle_${account.id}">
            </div>
        `,
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

        // Inicializar DataTables
        this.dataTable = $('#accountsTable').DataTable({
            data: tableData,
            language: {
                url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json'
            },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 5, orderable: false, searchable: false }, // Columna estado
                { targets: 6, orderable: false, searchable: false }  // Columna acciones
            ],
            dom: 'Bfrtip',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary'
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info'
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success'
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger'
                },
                {
                    extend: 'print',
                    text: '<i class="bi bi-printer"></i> Imprimir',
                    className: 'btn btn-sm btn-secondary'
                }
            ],
            drawCallback: () => {
                this.attachTableEvents();
                this.attachStatusToggleEvents();
            }
        });

        this.attachTableEvents();
        this.attachStatusToggleEvents();
    },

    /**
     * Adjuntar eventos de toggle de estado
     */
    attachStatusToggleEvents() {
        document.querySelectorAll('.toggle-status').forEach(toggle => {
            // Remover event listeners anteriores para evitar duplicados
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);

            newToggle.addEventListener('change', async (e) => {
                e.preventDefault();

                const accountId = parseInt(newToggle.dataset.id);
                const isActive = newToggle.checked;
                const statusSpan = newToggle.closest('td').querySelector('.status-text');

                // Mostrar loading en el toggle
                newToggle.disabled = true;

                try {
                    const response = await accountService.update(accountId, { is_active: isActive });

                    if (response.success) {
                        // Actualizar texto del estado
                        if (statusSpan) {
                            statusSpan.textContent = isActive ? 'Activo' : 'Inactivo';
                            statusSpan.className = `badge ${isActive ? 'bg-success' : 'bg-secondary'} status-text`;
                        }

                        showAlert(`Cuenta ${isActive ? 'activada' : 'desactivada'} exitosamente`, 'success');

                        // Actualizar el estado en el array local
                        const account = this.accounts.find(a => a.id === accountId);
                        if (account) {
                            account.is_active = isActive;
                        }
                    } else {
                        // Revertir el toggle si hubo error
                        newToggle.checked = !isActive;
                        showAlert(response.message || 'Error al cambiar el estado', 'danger');
                    }
                } catch (error) {
                    console.error('Error toggling account status:', error);
                    newToggle.checked = !isActive;
                    showAlert(error.message || 'Error al cambiar el estado', 'danger');
                } finally {
                    newToggle.disabled = false;
                }
            });
        });
    },

    attachTableEvents() {
        // Eventos de edición
        document.querySelectorAll('.edit-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const account = this.accounts.find(a => a.id === id);
                if (account) this.showAccountModal(account);
            });
        });

        // Eventos de eliminación
        document.querySelectorAll('.delete-account').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                await this.deleteAccount(id);
            });
        });
    },

    getCategoryLabel(category) {
        const labels = {
            'ventas': 'Ventas',
            'alquileres': 'Alquileres',
            'servicios': 'Servicios',
            'intereses': 'Intereses',
            'otros_ingresos': 'Otros Ingresos',
            'impuestos': 'Impuestos',
            'nomina': 'Nómina',
            'honorarios': 'Honorarios',
            'proveedores': 'Proveedores',
            'servicios_publicos': 'Servicios Públicos',
            'otros_egresos': 'Otros Egresos'
        };
        return labels[category] || category;
    },

    async deleteAccount(id) {
        const account = this.accounts.find(a => a.id === id);
        if (!account) return;

        const confirmed = confirm(`¿Está seguro de eliminar la cuenta "${account.name}"?\n\nEsta acción no eliminará las transacciones asociadas.`);

        if (!confirmed) return;

        try {
            const response = await accountService.delete(id);
            if (response.success) {
                showAlert('Cuenta eliminada exitosamente', 'success');
                await this.loadAccounts();
            } else {
                showAlert(response.message || 'Error al eliminar la cuenta', 'danger');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showAlert(error.message || 'Error al eliminar la cuenta', 'danger');
        }
    },

    showAccountModal(account = null) {
        const isEditing = !!account;
        const type = account ? account.type : this.currentType;

        const modalHtml = `
            <div class="modal fade" id="accountModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-bank2"></i> ${isEditing ? 'Editar Cuenta' : 'Nueva Cuenta'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="accountForm">
                                <div class="mb-3">
                                    <label class="form-label">Nombre de la cuenta *</label>
                                    <input type="text" class="form-control" id="accountName" 
                                           value="${account ? this.escapeHtml(account.name) : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Tipo *</label>
                                    <select class="form-select" id="accountType">
                                        <option value="income" ${type === 'income' ? 'selected' : ''}>Ingreso</option>
                                        <option value="expense" ${type === 'expense' ? 'selected' : ''}>Egreso</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Categoría *</label>
                                    <select class="form-select" id="accountCategory" required>
                                        ${this.getCategoryOptions(type, account ? account.category : '')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Descripción</label>
                                    <textarea class="form-control" id="accountDescription" rows="2">${account ? this.escapeHtml(account.description || '') : ''}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveAccountBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('accountModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('accountModal');
        const modal = new bootstrap.Modal(modalElement);

        // Cambiar opciones de categoría cuando cambia el tipo
        const typeSelect = document.getElementById('accountType');
        const categorySelect = document.getElementById('accountCategory');

        typeSelect.addEventListener('change', (e) => {
            const newType = e.target.value;
            categorySelect.innerHTML = this.getCategoryOptions(newType, '');
        });

        // Guardar cuenta
        const saveBtn = document.getElementById('saveAccountBtn');
        saveBtn.addEventListener('click', async () => {
            const name = document.getElementById('accountName').value.trim();
            const type = document.getElementById('accountType').value;
            const category = document.getElementById('accountCategory').value;
            const description = document.getElementById('accountDescription').value.trim();

            if (!name) {
                showAlert('Por favor ingrese el nombre de la cuenta', 'warning');
                return;
            }

            const accountData = { name, type, category, description };

            // Si es edición, incluir el estado
            if (isEditing) {
                const statusCheckbox = document.getElementById('accountStatus');
                if (statusCheckbox) {
                    // ✅ Usar 1 o 0 como número, no como string
                    accountData.is_active = statusCheckbox.checked ? 1 : 0;

                    // Para debugging
                    console.log('Estado enviado:', accountData.is_active, typeof accountData.is_active);
                }
            }

            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await accountService.update(account.id, accountData);
                    if (response.success) showAlert('Cuenta actualizada exitosamente', 'success');
                } else {
                    response = await accountService.create(accountData);
                    if (response.success) showAlert('Cuenta creada exitosamente', 'success');
                }

                modal.hide();
                await this.loadAccounts();

            } catch (error) {
                console.error('Error saving account:', error);
                showAlert(error.message || 'Error al guardar la cuenta', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        });

        modal.show();

        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });
    },

    getCategoryOptions(type, selected = '') {
        const categories = type === 'income'
            ? [
                { value: 'ventas', label: 'Ventas' },
                { value: 'alquileres', label: 'Alquileres' },
                { value: 'servicios', label: 'Servicios' },
                { value: 'intereses', label: 'Intereses' },
                { value: 'otros_ingresos', label: 'Otros Ingresos' }
            ]
            : [
                { value: 'impuestos', label: 'Impuestos' },
                { value: 'nomina', label: 'Nómina' },
                { value: 'honorarios', label: 'Honorarios' },
                { value: 'proveedores', label: 'Proveedores' },
                { value: 'servicios_publicos', label: 'Servicios Públicos' },
                { value: 'otros_egresos', label: 'Otros Egresos' }
            ];

        return categories.map(cat =>
            `<option value="${cat.value}" ${selected === cat.value ? 'selected' : ''}>${cat.label}</option>`
        ).join('');
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    setupEventListeners() {
        // Botón agregar cuenta
        const addBtn = document.getElementById('addAccountBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAccountModal());
        }

        // Tabs
        const tabs = document.querySelectorAll('#accountTabs .nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentType = tab.dataset.type;
                await this.loadAccounts();
            });
        });
    }
};