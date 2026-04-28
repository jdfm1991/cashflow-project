// modules/accounts.js
import { accountService } from '../services/accountService.js';
import { api } from '../services/apiService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const accountsModule = {
    accounts: [],
    categories: [],           // ← NUEVO: para almacenar categorías
    incomeCategories: [],     // ← NUEVO: categorías de ingresos
    expenseCategories: [],    // ← NUEVO: categorías de egresos
    dataTable: null,
    currentType: 'income',

    async render(container) {
        // Cargar categorías antes de renderizar
        await this.loadCategories();
        
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

    /**
     * Cargar categorías desde la base de datos
     */
    async loadCategories() {
        try {
            const response = await api.get('api/categories');
            if (response.success && response.data) {
                this.categories = response.data;
                this.incomeCategories = this.categories.filter(c => c.type === 'income');
                this.expenseCategories = this.categories.filter(c => c.type === 'expense');
                console.log('Categorías cargadas:', this.categories.length);
                console.log('Ingresos:', this.incomeCategories.length);
                console.log('Egresos:', this.expenseCategories.length);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            showAlert('Error al cargar las categorías', 'danger');
        }
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
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.accounts.map(account => [
            account.id,
            account.name,
            `<span class="badge ${account.type === 'income' ? 'bg-success' : 'bg-danger'}">
                ${account.type === 'income' ? 'Ingreso' : 'Egreso'}
            </span>`,
            this.getCategoryDisplayName(account.category),  // ← Usar método dinámico
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
                { targets: 5, orderable: false, searchable: false },
                { targets: 6, orderable: false, searchable: false }
            ],
            dom: 'Bfrtip',
            buttons: [
                { extend: 'copy', text: '<i class="bi bi-files"></i> Copiar', className: 'btn btn-sm btn-secondary' },
                { extend: 'csv', text: '<i class="bi bi-filetype-csv"></i> CSV', className: 'btn btn-sm btn-info' },
                { extend: 'excel', text: '<i class="bi bi-file-excel"></i> Excel', className: 'btn btn-sm btn-success' },
                { extend: 'pdf', text: '<i class="bi bi-file-pdf"></i> PDF', className: 'btn btn-sm btn-danger' },
                { extend: 'print', text: '<i class="bi bi-printer"></i> Imprimir', className: 'btn btn-sm btn-secondary' }
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
     * Obtener el nombre de la categoría desde los datos cargados
     */
    getCategoryDisplayName(categoryKey) {
        if (!categoryKey) return '-';
        
        // Buscar en todas las categorías
        const found = this.categories.find(c => c.name === categoryKey || c.id == categoryKey);
        if (found) {
            // Si la categoría tiene icono, mostrarlo
            const icon = found.icon ? `<i class="${found.icon} me-1"></i>` : '';
            return `${icon}${found.name}`;
        }
        
        // Si no se encuentra, mostrar el valor original
        return categoryKey;
    },

    /**
     * Obtener las opciones de categoría para el select (dinámico)
     */
    getCategoryOptions(type, selected = '') {
        const categories = type === 'income' ? this.incomeCategories : this.expenseCategories;
        
        if (categories.length === 0) {
            return '<option value="">Cargando categorías...</option>';
        }
        
        return categories.map(cat => {
            const icon = cat.icon ? `<i class="${cat.icon} me-1"></i>` : '';
            const isSelected = (selected === cat.name || selected == cat.id) ? 'selected' : '';
            return `<option value="${cat.name}" ${isSelected}>${icon}${cat.name}</option>`;
        }).join('');
    },

    attachStatusToggleEvents() {
        document.querySelectorAll('.toggle-status').forEach(toggle => {
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);

            newToggle.addEventListener('change', async (e) => {
                e.preventDefault();

                const accountId = parseInt(newToggle.dataset.id);
                const isActive = newToggle.checked;

                newToggle.disabled = true;

                try {
                    const response = await accountService.update(accountId, { is_active: isActive });

                    if (response.success) {
                        showAlert(`Cuenta ${isActive ? 'activada' : 'desactivada'} exitosamente`, 'success');
                        
                        const account = this.accounts.find(a => a.id === accountId);
                        if (account) {
                            account.is_active = isActive;
                        }
                    } else {
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
        document.querySelectorAll('.edit-account').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const id = parseInt(newBtn.dataset.id);
                const account = this.accounts.find(a => a.id === id);
                if (account) this.showAccountModal(account);
            });
        });

        document.querySelectorAll('.delete-account').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', async () => {
                const id = parseInt(newBtn.dataset.id);
                await this.deleteAccount(id);
            });
        });
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

        // Verificar que las categorías están cargadas
        const categories = type === 'income' ? this.incomeCategories : this.expenseCategories;
        if (categories.length === 0) {
            showAlert('Las categorías aún no se han cargado. Por favor, espere un momento.', 'warning');
            return;
        }

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
                                ${isEditing ? `
                                <div class="mb-3 form-check">
                                    <input type="checkbox" class="form-check-input" id="accountStatus" 
                                           ${account.is_active ? 'checked' : ''}>
                                    <label class="form-check-label" for="accountStatus">Activo</label>
                                </div>
                                ` : ''}
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

            if (!category) {
                showAlert('Por favor seleccione una categoría', 'warning');
                return;
            }

            const accountData = { name, type, category, description };

            if (isEditing) {
                const statusCheckbox = document.getElementById('accountStatus');
                if (statusCheckbox) {
                    accountData.is_active = statusCheckbox.checked ? 1 : 0;
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

                if (response.success) {
                    modal.hide();
                    await this.loadAccounts();
                } else {
                    showAlert(response.message || 'Error al guardar la cuenta', 'danger');
                }

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

    setupEventListeners() {
        const addBtn = document.getElementById('addAccountBtn');
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            newAddBtn.addEventListener('click', () => {
                if (this.categories.length === 0) {
                    showAlert('Cargando categorías, por favor espere...', 'warning');
                    return;
                }
                this.showAccountModal();
            });
        }

        const tabs = document.querySelectorAll('#accountTabs .nav-link');
        tabs.forEach(tab => {
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            newTab.addEventListener('click', async () => {
                tabs.forEach(t => t.classList.remove('active'));
                newTab.classList.add('active');
                this.currentType = newTab.dataset.type;
                await this.loadAccounts();
            });
        });
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Método de limpieza (opcional, para consistencia con otros módulos)
    cleanup() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        this.accounts = [];
        this.categories = [];
        this.incomeCategories = [];
        this.expenseCategories = [];
    }
};