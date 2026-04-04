// modules/users.js
import { api } from '../services/apiService.js';
import { formatCurrency, showAlert } from '../utils/helpers.js';

export const usersModule = {
    users: [],
    companies: [],
    dataTable: null,

    async render(container) {
        const user = api.getUser();
        if (user?.role !== 'super_admin') {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    No tienes permisos para acceder a este módulo.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h1 class="h3">Gestión de Usuarios</h1>
                <button class="btn btn-primary" id="addUserBtn">
                    <i class="bi bi-plus-circle"></i> Nuevo Usuario
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <div class="table-responsive">
                        <table id="usersTable" class="table table-hover table-striped" style="width:100%">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Usuario</th>
                                    <th>Email</th>
                                    <th>Nombre</th>
                                    <th>Empresa</th>
                                    <th>Rol Global</th>
                                    <th>Rol Empresa</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                <tr><td colspan="9" class="text-center">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        await this.loadCompanies();
        await this.loadUsers();
        this.setupEventListeners();
    },

    async loadCompanies() {
        try {
            const response = await api.get('api/companies');
            if (response.success && response.data) {
                this.companies = response.data;
            }
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    },

    async loadUsers() {
        try {
            const response = await api.get('api/users');
            if (response.success && response.data) {
                this.users = response.data;
                this.renderDataTable();
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showAlert('Error al cargar los usuarios', 'danger');
        }
    },

    getCompanyName(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        return company ? company.name : '-';
    },

    renderDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableData = this.users.map(user => [
            user.id,
            user.username,
            user.email,
            user.full_name,
            this.getCompanyName(user.company_id),
            this.getRoleLabel(user.role),
            this.getRoleInCompanyLabel(user.role_in_company),
            user.is_active ? 'Activo' : 'Inactivo',
            `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary edit-user" data-id="${user.id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger delete-user" data-id="${user.id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `
        ]);

        // Calcular total de usuarios
        const totalUsers = this.users.length;
        const totalActive = this.users.filter(u => u.is_active).length;
        const totalInactive = totalUsers - totalActive;

        this.dataTable = $('#usersTable').DataTable({
            data: tableData,
            language: {
                url: '/cashflow-project/cashflow-frontend/assets/i18n/es-ES.json'
            },
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
            order: [[1, 'asc']],
            columnDefs: [
                { targets: 0, visible: false },
                { targets: 8, orderable: false, searchable: false }
            ],
            dom: '<"row"<"col-sm-6"B><"col-sm-6"f>>' +
                '<"row"<"col-sm-12"tr>>' +
                '<"row"<"col-sm-5"i><"col-sm-7"p>>',
            buttons: [
                {
                    extend: 'copy',
                    text: '<i class="bi bi-files"></i> Copiar',
                    className: 'btn btn-sm btn-secondary me-1',
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    }
                },
                {
                    extend: 'csv',
                    text: '<i class="bi bi-filetype-csv"></i> CSV',
                    className: 'btn btn-sm btn-info me-1',
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    }
                },
                {
                    extend: 'excel',
                    text: '<i class="bi bi-file-excel"></i> Excel',
                    className: 'btn btn-sm btn-success me-1',
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    },
                    title: 'Reporte_Usuarios',
                    filename: 'usuarios_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-')
                },
                {
                    extend: 'pdf',
                    text: '<i class="bi bi-file-pdf"></i> PDF',
                    className: 'btn btn-sm btn-danger me-1',
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    },
                    title: 'Reporte de Usuarios',
                    filename: 'usuarios_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
                    orientation: 'landscape',
                    pageSize: 'A4',
                    customize: function (doc) {
                        // Agregar información adicional al PDF
                        doc.content.splice(0, 0, {
                            text: [
                                { text: 'FlowControl - Sistema de Flujo de Caja\n', fontSize: 16, bold: true },
                                { text: 'Reporte de Usuarios\n', fontSize: 14 },
                                { text: `Generado: ${new Date().toLocaleString()}`, fontSize: 10, italics: true }
                            ],
                            margin: [0, 0, 0, 20]
                        });

                        // Agregar resumen de estadísticas
                        doc.content.push({
                            text: [
                                `Total Usuarios: ${totalUsers} | `,
                                `Activos: ${totalActive} | `,
                                `Inactivos: ${totalInactive}`
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
                    exportOptions: {
                        columns: [1, 2, 3, 4, 5, 6, 7]
                    },
                    title: 'Reporte de Usuarios',
                    customize: function (win) {
                        $(win.document.body).find('table').addClass('table table-bordered');
                        $(win.document.body).prepend(`
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2>FlowControl - Sistema de Flujo de Caja</h2>
                            <h3>Reporte de Usuarios</h3>
                            <p>Generado: ${new Date().toLocaleString()}</p>
                            <hr>
                        </div>
                    `);
                    }
                }
            ],
            drawCallback: () => {
                this.attachTableEvents();
                this.updateTableFooter(totalUsers, totalActive, totalInactive);
            }
        });

        this.attachTableEvents();
    },

    /**
     * Actualizar el footer de la tabla con estadísticas
     */
    updateTableFooter(totalUsers, totalActive, totalInactive) {
        // Verificar si el footer ya existe
        let footer = document.getElementById('usersTableFooter');
        if (!footer) {
            const tfoot = document.querySelector('#usersTable tfoot');
            if (!tfoot) {
                const table = document.getElementById('usersTable');
                const tfootElement = document.createElement('tfoot');
                table.appendChild(tfootElement);
            }
            footer = document.querySelector('#usersTable tfoot');
            footer.id = 'usersTableFooter';
        }

        footer.innerHTML = `
        <tr class="table-active">
            <td colspan="4" class="text-end fw-bold">Resumen:</td>
            <td><strong>Total:</strong> ${totalUsers}</td>
            <td><strong>Activos:</strong> ${totalActive}</td>
            <td><strong>Inactivos:</strong> ${totalInactive}</td>
            <td></td>
        </tr>
    `;
    },

    /**
     * Obtener etiqueta del rol global
     */
    getRoleLabel(role) {
        const labels = {
            'user': '<span class="badge bg-secondary">User</span>',
            'admin': '<span class="badge bg-primary">Admin</span>',
            'super_admin': '<span class="badge bg-warning">Super Admin</span>'
        };
        return labels[role] || role;
    },

    /**
     * Obtener etiqueta del rol en empresa
     */
    getRoleInCompanyLabel(role) {
        const labels = {
            'user': '<span class="badge bg-secondary">User</span>',
            'admin': '<span class="badge bg-info">Admin</span>',
            'owner': '<span class="badge bg-success">Owner</span>'
        };
        return labels[role] || role;
    },

    attachTableEvents() {
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const user = this.users.find(u => u.id === id);
                if (user) this.showUserModal(user);
            });
        });

        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const user = this.users.find(u => u.id === id);
                if (!user) return;

                const confirmed = confirm(`¿Está seguro de eliminar al usuario "${user.username}"?`);
                if (!confirmed) return;

                try {
                    const response = await api.delete(`api/users/${id}`);
                    if (response.success) {
                        showAlert('Usuario eliminado exitosamente', 'success');
                        await this.loadUsers();
                    }
                } catch (error) {
                    showAlert(error.message || 'Error al eliminar el usuario', 'danger');
                }
            });
        });
    },

    showUserModal(user = null) {
        const isEditing = !!user;

        const modalHtml = `
        <div class="modal fade" id="userModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-person"></i> ${isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="userForm">
                            <div class="mb-3">
                                <label class="form-label">Usuario *</label>
                                <input type="text" class="form-control" id="username" 
                                       value="${user ? user.username : ''}" 
                                       ${isEditing ? 'readonly' : ''} required>
                                <small class="text-muted">${isEditing ? 'El nombre de usuario no se puede modificar' : ''}</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email *</label>
                                <input type="email" class="form-control" id="email" 
                                       value="${user ? user.email : ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Nombre Completo *</label>
                                <input type="text" class="form-control" id="fullName" 
                                       value="${user ? user.full_name : ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Empresa *</label>
                                <select class="form-select" id="companyId" required>
                                    <option value="">Seleccione una empresa</option>
                                    ${this.companies.map(c => `
                                        <option value="${c.id}" ${user && user.company_id === c.id ? 'selected' : ''}>
                                            ${c.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Rol Global</label>
                                <select class="form-select" id="role">
                                    <option value="user" ${user && user.role === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    <option value="super_admin" ${user && user.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Rol en Empresa</label>
                                <select class="form-select" id="roleInCompany">
                                    <option value="user" ${user && user.role_in_company === 'user' ? 'selected' : ''}>User</option>
                                    <option value="admin" ${user && user.role_in_company === 'admin' ? 'selected' : ''}>Admin</option>
                                    <option value="owner" ${user && user.role_in_company === 'owner' ? 'selected' : ''}>Owner</option>
                                </select>
                            </div>
                            
                            <!-- ✅ SECCIÓN DE CONTRASEÑA - VISIBLE EN AMBOS MODOS -->
                            <div class="mb-3">
                                <label class="form-label">
                                    ${isEditing ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                                </label>
                                <input type="password" class="form-control" id="password" 
                                       ${!isEditing ? 'required' : ''}
                                       placeholder="${isEditing ? 'Dejar en blanco para mantener la actual' : 'Ingrese una contraseña'}">
                                ${isEditing ? '<small class="text-muted">Complete este campo solo si desea cambiar la contraseña</small>' : ''}
                            </div>
                            
                            <!-- ✅ CAMPO DE CONFIRMACIÓN DE CONTRASEÑA -->
                            <div class="mb-3" id="confirmPasswordGroup">
                                <label class="form-label">Confirmar Contraseña</label>
                                <input type="password" class="form-control" id="confirmPassword">
                                <small class="text-muted">Repita la contraseña para confirmar</small>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Estado</label>
                                <select class="form-select" id="userStatus">
                                    <option value="1" ${user && user.is_active ? 'selected' : ''}>Activo</option>
                                    <option value="0" ${user && !user.is_active ? 'selected' : ''}>Inactivo</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="saveUserBtn">
                            ${isEditing ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

        const existingModal = document.getElementById('userModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById('userModal');
        const modal = new bootstrap.Modal(modalElement);

        // ✅ Validación de contraseñas en tiempo real
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const confirmGroup = document.getElementById('confirmPasswordGroup');

        // Mostrar/ocultar confirmación según si hay contraseña
        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                if (passwordInput.value) {
                    confirmGroup.style.display = 'block';
                    confirmPasswordInput.required = true;
                } else {
                    confirmGroup.style.display = 'none';
                    confirmPasswordInput.required = false;
                    confirmPasswordInput.value = '';
                }
            });

            // Si es edición y no hay contraseña, ocultar confirmación inicialmente
            if (isEditing && !passwordInput.value) {
                confirmGroup.style.display = 'none';
                confirmPasswordInput.required = false;
            }
        }

        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.addEventListener('click', async () => {
            const data = {
                username: document.getElementById('username').value.trim(),
                email: document.getElementById('email').value.trim(),
                full_name: document.getElementById('fullName').value.trim(),
                company_id: parseInt(document.getElementById('companyId').value),
                role: document.getElementById('role').value,
                role_in_company: document.getElementById('roleInCompany').value,
                is_active: parseInt(document.getElementById('userStatus').value)
            };

            if (!data.username || !data.email || !data.full_name || !data.company_id) {
                showAlert('Por favor complete los campos requeridos', 'warning');
                return;
            }

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validación de contraseña
            if (password || !isEditing) {
                if (!password && !isEditing) {
                    showAlert('La contraseña es requerida', 'warning');
                    return;
                }

                if (password.length < 6) {
                    showAlert('La contraseña debe tener al menos 6 caracteres', 'warning');
                    return;
                }

                if (password !== confirmPassword) {
                    showAlert('Las contraseñas no coinciden', 'warning');
                    return;
                }

                data.password = password;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';

            try {
                let response;
                if (isEditing) {
                    response = await api.put(`api/users/${user.id}`, data);
                    if (response.success) showAlert('Usuario actualizado exitosamente', 'success');
                } else {
                    response = await api.post('api/users', data);
                    if (response.success) showAlert('Usuario creado exitosamente', 'success');
                }

                modal.hide();
                await this.loadUsers();
            } catch (error) {
                showAlert(error.message || 'Error al guardar el usuario', 'danger');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = isEditing ? 'Actualizar' : 'Crear';
            }
        });

        modal.show();
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    },
    setupEventListeners() {
        const addBtn = document.getElementById('addUserBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showUserModal());
        }
    }
};