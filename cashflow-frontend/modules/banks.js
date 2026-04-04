// modules/banks.js
import { api } from '../services/apiService.js';
import { showAlert } from '../utils/helpers.js';

export const banksModule = {
    banks: [],
    dataTable: null,

    async render(container) {
        const user = api.getUser();
        if (user?.role !== 'super_admin') {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    No tienes permisos para acceder a este módulo. Esta sección es solo para administradores.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Catálogo de Bancos</h1>
                <button class="btn btn-primary" id="addBankBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Banco
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="banksTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Código</th>
                                    <th>País</th>
                                    <th>Website</th>
                                    <th>Teléfono</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="banksTableBody">
                                <tr><td colspan="8" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        await this.loadBanks();
        this.setupEventListeners();
    },

    async loadBanks() {
        try {
            const response = await api.get('api/banks');
            if (response.success && response.data) {
                this.banks = response.data;
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading banks:', error);
            showAlert('Error al cargar los bancos', 'danger');
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.banks.map(bank => [
            bank.id,
            bank.name,
            bank.code || '-',
            bank.country || '-',
            bank.website ? `<a href="${bank.website}" target="_blank">${bank.website}</a>` : '-',
            bank.phone || '-',
            `<span class="badge ${bank.is_active ? 'bg-success' : 'bg-danger'}">
                ${bank.is_active ? 'Activo' : 'Inactivo'}
            </span>`,
            `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-bank" data-id="${bank.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-bank" data-id="${bank.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
        ]);

        this.dataTable = $('#banksTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 7, orderable: false, searchable: false }
            ],
            drawCallback: () => this.attachTableEvents()
        });

        this.attachTableEvents();
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-bank').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const bank = this.banks.find(b => b.id === id);
                if (bank) this.showBankModal(bank);
            });
        });

        document.querySelectorAll('.delete-bank').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const bank = this.banks.find(b => b.id === id);
                if (!bank) return;
                
                const confirmed = confirm(`¿Está seguro de eliminar el banco "${bank.name}"?\n\nEsto puede afectar cuentas bancarias asociadas.`);
                if (!confirmed) return;
                
                try {
                    const response = await api.delete(`api/banks/${id}`);
                    if (response.success) {
                        showAlert('Banco eliminado exitosamente', 'success');
                        await this.loadBanks();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar el banco', 'danger');
                }
            });
        });
    },

    showBankModal(bank = null) {
        const isEditing = !!bank;
        
        const modalHtml = `
            <div class="modal fade" id="bankModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-bank"></i> ${isEditing ? 'Editar Banco' : 'Nuevo Banco'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="bankForm">
                                <div class="mb-3">
                                    <label class="form-label">Nombre *</label>
                                    <input type="text" class="form-control" id="bankName" 
                                           value="${bank ? bank.name : ''}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Código Bancario</label>
                                    <input type="text" class="form-control" id="bankCode" 
                                           value="${bank ? bank.code || '' : ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">País</label>
                                    <input type="text" class="form-control" id="bankCountry" 
                                           value="${bank ? bank.country || '' : ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Website</label>
                                    <input type="url" class="form-control" id="bankWebsite" 
                                           value="${bank ? bank.website || '' : ''}" 
                                           placeholder="https://www.ejemplo.com">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Teléfono</label>
                                    <input type="text" class="form-control" id="bankPhone" 
                                           value="${bank ? bank.phone || '' : ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Estado</label>
                                    <select class="form-select" id="bankStatus">
                                        <option value="1" ${bank && bank.is_active ? 'selected' : ''}>Activo</option>
                                        <option value="0" ${bank && !bank.is_active ? 'selected' : ''}>Inactivo</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveBankBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('bankModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('bankModal');
        const modal = new bootstrap.Modal(modalElement);
        
        const saveBtn = document.getElementById('saveBankBtn');
        saveBtn.addEventListener('click', async () => {
            const data = {
                name: document.getElementById('bankName').value.trim(),
                code: document.getElementById('bankCode').value.trim(),
                country: document.getElementById('bankCountry').value.trim(),
                website: document.getElementById('bankWebsite').value.trim(),
                phone: document.getElementById('bankPhone').value.trim(),
                is_active: parseInt(document.getElementById('bankStatus').value)
            };
            
            if (!data.name) {
                showAlert('El nombre es requerido', 'warning');
                return;
            }
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';
            
            try {
                let response;
                if (isEditing) {
                    response = await api.put(`api/banks/${bank.id}`, data);
                    if (response.success) showAlert('Banco actualizado exitosamente', 'success');
                } else {
                    response = await api.post('api/banks', data);
                    if (response.success) showAlert('Banco creado exitosamente', 'success');
                }
                
                modal.hide();
                await this.loadBanks();
            } catch (error) {
                showAlert(error.message || 'Error al guardar el banco', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });
        
        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addBankBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showBankModal());
        }
    }
};