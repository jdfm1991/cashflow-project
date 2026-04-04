// modules/companies.js
import { api } from '../services/apiService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const companiesModule = {
    companies: [],
    dataTable: null,

    async render(container) {
        // Verificar permisos (solo super_admin)
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
                <h1 class="h3">Gestión de Empresas</h1>
                <button class="btn btn-primary" id="addCompanyBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Empresa
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="companiesTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Razón Social</th>
                                    <th>NIT/RUC</th>
                                    <th>Email</th>
                                    <th>Teléfono</th>
                                    <th>Plan</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="companiesTableBody">
                                <tr><td colspan="9" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        await this.loadCompanies();
        this.setupEventListeners();
    },

    async loadCompanies() {
        try {
            const response = await api.get('api/companies');
            if (response.success && response.data) {
                this.companies = response.data;
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading companies:', error);
            showAlert('Error al cargar las empresas', 'danger');
        }
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.companies.map(company => [
            company.id,
            company.name,
            company.business_name || '-',
            company.tax_id || '-',
            company.email || '-',
            company.phone || '-',
            `<span class="badge ${company.subscription_plan === 'free' ? 'bg-secondary' : 'bg-primary'}">
                ${company.subscription_plan || 'free'}
            </span>`,
            `<span class="badge ${company.is_active ? 'bg-success' : 'bg-danger'}">
                ${company.is_active ? 'Activo' : 'Inactivo'}
            </span>`,
            `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-company" data-id="${company.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-company" data-id="${company.id}" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `
        ]);

        this.dataTable = $('#companiesTable').DataTable({
            data: tableData,
            language: { url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json' },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 8, orderable: false, searchable: false }
            ],
            drawCallback: () => this.attachTableEvents()
        });

        this.attachTableEvents();
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-company').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const company = this.companies.find(c => c.id === id);
                if (company) this.showCompanyModal(company);
            });
        });

        document.querySelectorAll('.delete-company').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const company = this.companies.find(c => c.id === id);
                if (!company) return;
                
                const confirmed = confirm(`¿Está seguro de eliminar la empresa "${company.name}"?\n\nEsta acción eliminará todos los datos asociados.`);
                if (!confirmed) return;
                
                try {
                    const response = await api.delete(`api/companies/${id}`);
                    if (response.success) {
                        showAlert('Empresa eliminada exitosamente', 'success');
                        await this.loadCompanies();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar la empresa', 'danger');
                }
            });
        });
    },

    showCompanyModal(company = null) {
        const isEditing = !!company;
        
        const modalHtml = `
            <div class="modal fade" id="companyModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-building"></i> ${isEditing ? 'Editar Empresa' : 'Nueva Empresa'}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="companyForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Nombre *</label>
                                            <input type="text" class="form-control" id="companyName" 
                                                   value="${company ? company.name : ''}" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Razón Social</label>
                                            <input type="text" class="form-control" id="businessName" 
                                                   value="${company ? company.business_name || '' : ''}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">NIT/RUC</label>
                                            <input type="text" class="form-control" id="taxId" 
                                                   value="${company ? company.tax_id || '' : ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Email</label>
                                            <input type="email" class="form-control" id="companyEmail" 
                                                   value="${company ? company.email || '' : ''}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Teléfono</label>
                                            <input type="text" class="form-control" id="companyPhone" 
                                                   value="${company ? company.phone || '' : ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Plan</label>
                                            <select class="form-select" id="subscriptionPlan">
                                                <option value="free" ${company && company.subscription_plan === 'free' ? 'selected' : ''}>Free</option>
                                                <option value="basic" ${company && company.subscription_plan === 'basic' ? 'selected' : ''}>Basic</option>
                                                <option value="pro" ${company && company.subscription_plan === 'pro' ? 'selected' : ''}>Pro</option>
                                                <option value="enterprise" ${company && company.subscription_plan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label class="form-label">Dirección</label>
                                            <textarea class="form-control" id="companyAddress" rows="2">${company ? company.address || '' : ''}</textarea>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Estado</label>
                                            <select class="form-select" id="companyStatus">
                                                <option value="1" ${company && company.is_active ? 'selected' : ''}>Activo</option>
                                                <option value="0" ${company && !company.is_active ? 'selected' : ''}>Inactivo</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="saveCompanyBtn">
                                ${isEditing ? 'Actualizar' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('companyModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('companyModal');
        const modal = new bootstrap.Modal(modalElement);
        
        const saveBtn = document.getElementById('saveCompanyBtn');
        saveBtn.addEventListener('click', async () => {
            const data = {
                name: document.getElementById('companyName').value.trim(),
                business_name: document.getElementById('businessName').value.trim(),
                tax_id: document.getElementById('taxId').value.trim(),
                email: document.getElementById('companyEmail').value.trim(),
                phone: document.getElementById('companyPhone').value.trim(),
                address: document.getElementById('companyAddress').value.trim(),
                subscription_plan: document.getElementById('subscriptionPlan').value,
                is_active: parseInt(document.getElementById('companyStatus').value)
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
                    response = await api.put(`api/companies/${company.id}`, data);
                    if (response.success) showAlert('Empresa actualizada exitosamente', 'success');
                } else {
                    response = await api.post('api/companies', data);
                    if (response.success) showAlert('Empresa creada exitosamente', 'success');
                }
                
                modal.hide();
                await this.loadCompanies();
            } catch (error) {
                showAlert(error.message || 'Error al guardar la empresa', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });
        
        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },

    setupEventListeners() {
        const addBtn = document.getElementById('addCompanyBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showCompanyModal());
        }
    }
};