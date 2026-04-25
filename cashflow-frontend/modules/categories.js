// modules/categories.js - VERSIÓN CORREGIDA
import { api } from '../services/apiService.js';
import { showAlert } from '../utils/helpers.js';

export const categoriesModule = {
    categories: [],
    incomeCategories: [],
    expenseCategories: [],
    currentType: 'income',

    async render(container) {
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        
        // Primero renderizar el HTML
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">
                    <i class="bi bi-tags"></i> Categorías de Cuentas
                </h1>
                ${isSuperAdmin ? `
                <button class="btn btn-primary" id="addCategoryBtn">
                    <i class="bi bi-plus-circle"></i> Nueva Categoría
                </button>
                ` : ''}
            </div>
            
            <!-- Pestañas para tipo de categoría -->
            <ul class="nav nav-tabs mb-4">
                <li class="nav-item">
                    <a class="nav-link active" data-type="income" href="#" id="tabIncome">
                        <i class="bi bi-cash-stack text-success"></i> Ingresos
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" data-type="expense" href="#" id="tabExpense">
                        <i class="bi bi-cash text-danger"></i> Egresos
                    </a>
                </li>
            </ul>
            
            <!-- Tabla de categorías -->
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <h5 class="mb-0" id="tableTitle">Categorías de Ingresos</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover table-striped" id="categoriesTable">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Icono</th>
                                    <th>Color</th>
                                    <th>Descripción</th>
                                    <th>Estado</th>
                                    <th>Orden</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="categoriesTableBody">
                                <tr><td colspan="8" class="text-center">Cargando categorías...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Luego cargar los datos
        await this.loadCategories();
        
        this.setupEventListeners(isSuperAdmin);
        this.renderTable();
    },
    
    async loadCategories() {
        try {
            console.log('Cargando categorías...');
            const response = await api.get('api/categories');
            console.log('Respuesta categorías:', response);
            
            if (response.success && response.data && Array.isArray(response.data)) {
                this.categories = response.data;
                this.incomeCategories = this.categories.filter(c => c.type === 'income');
                this.expenseCategories = this.categories.filter(c => c.type === 'expense');
                console.log('Categorías de ingresos:', this.incomeCategories.length);
                console.log('Categorías de egresos:', this.expenseCategories.length);
            } else {
                console.error('Formato de respuesta inválido:', response);
                this.categories = [];
                this.incomeCategories = [];
                this.expenseCategories = [];
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            showAlert('Error al cargar las categorías: ' + (error.message || 'Error desconocido'), 'danger');
            this.categories = [];
            this.incomeCategories = [];
            this.expenseCategories = [];
        }
    },
    
    renderTable() {
        console.log('renderTable - currentType:', this.currentType);
        
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const categories = this.currentType === 'income' ? this.incomeCategories : this.expenseCategories;
        const tbody = document.getElementById('categoriesTableBody');
        
        if (!tbody) {
            console.error('tbody no encontrado');
            return;
        }
        
        if (!categories || categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay categorías registradas</td></tr>';
            return;
        }
        
        let html = '';
        categories.forEach(cat => {
            html += `
                <tr data-id="${cat.id}">
                    <td>${cat.id}</td>
                    <td>${this.escapeHtml(cat.name)}</td>
                    <td><i class="${cat.icon || 'bi-tag'}"></i> ${cat.icon || 'bi-tag'}</td>
                    <td><span class="badge" style="background-color: ${cat.color || '#6c757d'}; color: white;">${cat.color || '#6c757d'}</span></td>
                    <td>${this.escapeHtml(cat.description || '-').substring(0, 100)}</td>
                    <td>${cat.is_active ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
                    <td>${cat.sort_order || 0}</td>
                    <td>${this.getActionsButtons(cat, isSuperAdmin)}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        this.attachTableEvents();
        
        const titleElement = document.getElementById('tableTitle');
        if (titleElement) {
            titleElement.innerHTML = this.currentType === 'income' ? 'Categorías de Ingresos' : 'Categorías de Egresos';
        }
        
        console.log('Tabla renderizada con', categories.length, 'categorías');
    },
    
    getActionsButtons(category, isSuperAdmin) {
        if (!isSuperAdmin) {
            return `<span class="text-muted">Solo lectura</span>`;
        }
        
        if (category.is_system) {
            return `<span class="text-muted"><i class="bi bi-lock-fill"></i> Sistema</span>`;
        }
        
        return `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary edit-category" data-id="${category.id}" title="Editar categoría">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger delete-category" data-id="${category.id}" data-name="${category.name}" title="Eliminar categoría">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    },
    
    attachTableEvents() {
        // Editar categoría
        document.querySelectorAll('.edit-category').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(newBtn.dataset.id);
                const category = this.categories.find(c => c.id === id);
                if (category) this.showCategoryModal(category);
            });
        });
        
        // Eliminar categoría
        document.querySelectorAll('.delete-category').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(newBtn.dataset.id);
                const name = newBtn.dataset.name;
                
                const confirmed = confirm(`¿Está seguro de eliminar la categoría "${name}"?`);
                if (!confirmed) return;
                
                try {
                    const response = await api.delete(`api/categories/${id}`);
                    if (response.success) {
                        showAlert('Categoría eliminada exitosamente', 'success');
                        await this.loadCategories();
                        this.renderTable();
                    } else {
                        showAlert(response.message || 'Error al eliminar', 'danger');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    showAlert(error.message || 'Error al eliminar la categoría', 'danger');
                }
            });
        });
    },
    
    showCategoryModal(category = null) {
        const isEdit = !!category;
        const title = isEdit ? 'Editar Categoría' : 'Nueva Categoría';
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        
        if (!isSuperAdmin) {
            showAlert('No tienes permisos para esta acción', 'warning');
            return;
        }
        
        const existingModal = document.getElementById('categoryModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHtml = `
            <div class="modal fade" id="categoryModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-tag"></i> ${title}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="categoryForm">
                                <input type="hidden" id="categoryId" value="${category?.id || ''}">
                                
                                <div class="mb-3">
                                    <label class="form-label required">Nombre</label>
                                    <input type="text" class="form-control" id="categoryName" 
                                           value="${this.escapeHtml(category?.name || '')}" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label required">Tipo</label>
                                    <select class="form-select" id="categoryType" ${isEdit ? 'disabled' : ''}>
                                        <option value="income" ${category?.type === 'income' ? 'selected' : ''}>Ingreso</option>
                                        <option value="expense" ${category?.type === 'expense' ? 'selected' : ''}>Egreso</option>
                                    </select>
                                    ${isEdit ? '<small class="text-muted">El tipo no se puede modificar después de crear la categoría</small>' : ''}
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Icono (Bootstrap Icon)</label>
                                    <div class="input-group">
                                        <span class="input-group-text" id="iconPreview"><i class="${category?.icon || 'bi-tag'}"></i></span>
                                        <input type="text" class="form-control" id="categoryIcon" 
                                               value="${category?.icon || 'bi-tag'}" placeholder="bi-tag">
                                    </div>
                                    <small class="text-muted">Ejemplos: bi-cash-stack, bi-cart, bi-house</small>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Color</label>
                                    <div class="input-group">
                                        <input type="color" class="form-control form-control-color" id="categoryColor" 
                                               value="${category?.color || '#6c757d'}" style="width: 60px;">
                                        <input type="text" class="form-control" id="categoryColorText" 
                                               value="${category?.color || '#6c757d'}">
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Descripción</label>
                                    <textarea class="form-control" id="categoryDescription" rows="3">${this.escapeHtml(category?.description || '')}</textarea>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Orden</label>
                                    <input type="number" class="form-control" id="categoryOrder" 
                                           value="${category?.sort_order || 0}">
                                    <small class="text-muted">Número más pequeño = aparece primero</small>
                                </div>
                                
                                <div class="mb-3 form-check">
                                    <input type="checkbox" class="form-check-input" id="categoryActive" 
                                           ${category?.is_active == 1 ? 'checked' : ''}>
                                    <label class="form-check-label" for="categoryActive">Activo</label>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-circle"></i> Cancelar
                            </button>
                            <button type="button" class="btn btn-primary" id="saveCategoryBtn">
                                <i class="bi bi-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Sincronizar color
        const colorPicker = document.getElementById('categoryColor');
        const colorText = document.getElementById('categoryColorText');
        const iconInput = document.getElementById('categoryIcon');
        const iconPreview = document.getElementById('iconPreview');
        
        if (colorPicker && colorText) {
            colorPicker.addEventListener('change', () => {
                colorText.value = colorPicker.value;
            });
            colorText.addEventListener('change', () => {
                colorPicker.value = colorText.value;
            });
        }
        
        if (iconInput && iconPreview) {
            iconInput.addEventListener('input', () => {
                iconPreview.innerHTML = `<i class="${iconInput.value}"></i>`;
            });
        }
        
        const modalElement = document.getElementById('categoryModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });
        
        const saveBtn = document.getElementById('saveCategoryBtn');
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', async () => {
                await this.saveCategory(category);
            });
        }
    },
    
    async saveCategory(existingCategory = null) {
        const id = document.getElementById('categoryId')?.value;
        const name = document.getElementById('categoryName')?.value;
        const type = document.getElementById('categoryType')?.value;
        const icon = document.getElementById('categoryIcon')?.value;
        const color = document.getElementById('categoryColorText')?.value;
        const description = document.getElementById('categoryDescription')?.value;
        const sortOrder = document.getElementById('categoryOrder')?.value;
        const isActive = document.getElementById('categoryActive')?.checked ? 1 : 0;
        
        if (!name || !name.trim()) {
            showAlert('El nombre es requerido', 'warning');
            return;
        }
        
        if (!type) {
            showAlert('El tipo es requerido', 'warning');
            return;
        }
        
        const saveBtn = document.getElementById('saveCategoryBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
        }
        
        try {
            const categoryData = {
                name: name.trim(),
                type: type,
                icon: icon || 'bi-tag',
                color: color || '#6c757d',
                description: description || null,
                sort_order: parseInt(sortOrder) || 0,
                is_active: isActive
            };
            
            let response;
            
            if (id && id !== '') {
                response = await api.put(`api/categories/${id}`, categoryData);
                if (response.success) {
                    showAlert('Categoría actualizada exitosamente', 'success');
                    this.closeModal();
                    await this.loadCategories();
                    this.renderTable();
                }
            } else {
                response = await api.post('api/categories', categoryData);
                if (response.success) {
                    showAlert('Categoría creada exitosamente', 'success');
                    this.closeModal();
                    await this.loadCategories();
                    this.renderTable();
                }
            }
            
            if (!response.success) {
                showAlert(response.message || 'Error al guardar', 'danger');
            }
        } catch (error) {
            console.error('Error saving category:', error);
            showAlert(error.message || 'Error al guardar la categoría', 'danger');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-save"></i> ' + (id ? 'Actualizar' : 'Guardar');
            }
        }
    },
    
    closeModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
            setTimeout(() => {
                if (modal && modal.remove) modal.remove();
            }, 300);
        }
    },
    
    setupEventListeners(isSuperAdmin) {
        // Navegación por pestañas
        const tabIncome = document.getElementById('tabIncome');
        const tabExpense = document.getElementById('tabExpense');
        
        if (tabIncome) {
            const newTabIncome = tabIncome.cloneNode(true);
            tabIncome.parentNode.replaceChild(newTabIncome, tabIncome);
            
            newTabIncome.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentType = 'income';
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                newTabIncome.classList.add('active');
                this.renderTable();
            });
        }
        
        if (tabExpense) {
            const newTabExpense = tabExpense.cloneNode(true);
            tabExpense.parentNode.replaceChild(newTabExpense, tabExpense);
            
            newTabExpense.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentType = 'expense';
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                newTabExpense.classList.add('active');
                this.renderTable();
            });
        }
        
        // Botón nueva categoría
        const addBtn = document.getElementById('addCategoryBtn');
        if (addBtn && isSuperAdmin) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            
            newAddBtn.addEventListener('click', () => this.showCategoryModal());
        }
    },
    
    cleanup() {
        console.log('Limpiando módulo de categorías...');
        
        const modal = document.getElementById('categoryModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
            modal.remove();
        }
        
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
        
        this.categories = [];
        this.incomeCategories = [];
        this.expenseCategories = [];
        
        console.log('Limpieza completada');
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};