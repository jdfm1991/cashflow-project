// modules/income.js
import { TransactionModule } from './shared/transactionModule.js';
import { currencyService } from '../services/currencyService.js';
import { transactionService } from '../services/transactionService.js';
import { reconversionService } from '../services/reconversionService.js';
import { showAlert, formatCurrency } from '../utils/helpers.js';
import { api } from '../services/apiService.js';

class IncomeModule extends TransactionModule {
    constructor() {
        super('income');
    }

    async showModal(income = null) {
        const isEdit = !!income;
        const user = api.getUser();
        const isSuperAdmin = user?.role === 'super_admin';
        const config = this.getConfig();

        const modalHtml = `
            <div class="modal fade" id="transactionModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header ${config.headerClass} text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-cash-stack"></i> ${isEdit ? 'Editar' : 'Nuevo'} ${config.entityName}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-secondary mb-3">
                                <i class="bi bi-info-circle"></i>
                                <strong>Información de conversión:</strong><br>
                                <small>
                                    • Si selecciona <strong>Moneda Base (${this.baseCurrency?.code})</strong>, el monto se guardará tal cual.<br>
                                    • Si selecciona <strong>otra moneda</strong>, el monto se convertirá automáticamente a ${this.baseCurrency?.code}.<br>
                                    • El campo "Tasa de cambio" muestra la conversión correspondiente.
                                </small>
                            </div>
                            <form id="transactionForm">
                                <input type="hidden" id="transactionId" value="${income?.id || ''}">
                                ${isSuperAdmin ? `
                                <div class="row mb-3">
                                    <div class="col-md-12">
                                        <label class="form-label required">Empresa</label>
                                        <select class="form-select" id="transactionCompany" required>
                                            <option value="">Seleccione una empresa</option>
                                            ${this.companies.map(c => `
                                                <option value="${c.id}" ${income?.company_id == c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                ` : ''}
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Fecha</label>
                                        <input type="date" class="form-control" id="transactionDate" 
                                               value="${income?.date || new Date().toISOString().split('T')[0]}" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Cuenta</label>
                                        <select class="form-select" id="transactionAccount" required>
                                            <option value="">Seleccione una cuenta</option>
                                            ${this.accounts.map(acc => `
                                                <option value="${acc.id}" ${income?.account_id == acc.id ? 'selected' : ''}>
                                                    ${this.escapeHtml(acc.name)} ${acc.category ? `(${acc.category})` : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label required">Monto</label>
                                        <input type="number" step="0.01" class="form-control" id="transactionAmount" 
                                               value="${income?.amount || ''}" placeholder="0.00" required>
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label required">Moneda</label>
                                        <select class="form-select" id="transactionCurrency" required>
                                            <option value="">Seleccione una moneda</option>
                                            ${this.currencies.map(curr => `
                                                <option value="${curr.id}" ${income?.currency_id == curr.id ? 'selected' : ''}>
                                                    ${curr.code} - ${curr.name} (${curr.symbol})
                                                    ${curr.is_base ? ' [Base]' : ''}
                                                    ${curr.is_default ? ' [Default]' : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">Tasa de cambio</label>
                                        <input type="text" class="form-control" id="exchangeRateInfo" readonly placeholder="Se calculará automáticamente">
                                        <small class="text-muted" id="rateDateInfo"></small>
                                    </div>
                                </div>
                                <div class="alert alert-success mb-3" id="baseAmountInfo" style="display: none;">
                                    <i class="bi bi-currency-exchange"></i>
                                    <strong>Monto en moneda base (${this.baseCurrency?.code || 'VES'}):</strong>
                                    <span id="baseAmountDisplay">0.00</span>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Referencia</label>
                                        <input type="text" class="form-control" id="transactionReference" 
                                               value="${income?.reference || ''}" placeholder="N° de comprobante">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Método de Pago</label>
                                        <select class="form-select" id="transactionPaymentMethod" required>
                                            <option value="cash" ${income?.payment_method === 'cash' ? 'selected' : ''}>💵 Efectivo</option>
                                            <option value="bank" ${income?.payment_method === 'bank' ? 'selected' : ''}>🏦 Banco</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Descripción</label>
                                    <textarea class="form-control" id="transactionDescription" rows="3" 
                                              placeholder="Descripción detallada...">${income?.description || ''}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn ${config.buttonClass}" id="saveTransactionBtn">
                                ${isEdit ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('transactionModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.setupExchangeRateEvents();

        const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
        modal.show();

        document.getElementById('saveTransactionBtn')?.addEventListener('click', async () => {
            await this.saveTransaction(income);
            this.closeModal();
        });
    }

    setupExchangeRateEvents() {
        const dateInput = document.getElementById('transactionDate');
        const currencySelect = document.getElementById('transactionCurrency');
        const amountInput = document.getElementById('transactionAmount');
        const rateInfo = document.getElementById('exchangeRateInfo');
        const previewSpan = document.getElementById('baseAmountDisplay');
        const previewDiv = document.getElementById('baseAmountInfo');
        const rateDateInfo = document.getElementById('rateDateInfo');

        let currentRequestId = 0;
        let updateTimeout = null;

        const updateExchangeRate = async () => {
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                const requestId = ++currentRequestId;
                const date = dateInput?.value;
                const currencyId = currencySelect?.value;
                const amount = parseFloat(amountInput?.value) || 0;

                if (!date || !currencyId || amount <= 0) {
                    if (rateInfo) rateInfo.value = 'Esperando datos...';
                    if (previewDiv) previewDiv.style.display = 'none';
                    return;
                }

                const selectedCurrency = this.currencies.find(c => c.id == currencyId);
                const isBaseCurrency = selectedCurrency?.is_base == 1;
                const targetCurrency = isBaseCurrency ? (this.defaultCurrency || this.baseCurrency) : this.baseCurrency;

                if (!targetCurrency) return;

                if (parseInt(currencyId) === targetCurrency.id) {
                    if (rateInfo) rateInfo.value = '1.00 (Misma moneda)';
                    if (previewSpan) previewSpan.textContent = amount.toFixed(2);
                    if (previewDiv) previewDiv.style.display = 'block';
                    return;
                }

                if (rateInfo) rateInfo.value = 'Buscando tasa...';

                const result = await currencyService.getExchangeRate(parseInt(currencyId), targetCurrency.id, date);
                if (requestId !== currentRequestId) return;

                if (result.success && result.rate) {
                    const convertedAmount = isBaseCurrency ? amount / result.rate : amount * result.rate;
                    const fromCode = selectedCurrency?.code;
                    const toCode = targetCurrency?.code;

                    if (rateInfo) rateInfo.value = `${result.rate.toFixed(4)} (1 ${fromCode} = ${result.rate.toFixed(4)} ${toCode})`;
                    if (previewSpan) previewSpan.textContent = convertedAmount.toFixed(2);
                    if (previewDiv) {
                        previewDiv.style.display = 'block';
                        previewDiv.className = isBaseCurrency ? 'alert alert-info mb-3' : 'alert alert-success mb-3';
                        const label = previewDiv.querySelector('strong');
                        if (label) {
                            label.innerHTML = isBaseCurrency 
                                ? '<i class="bi bi-eye"></i> Valor en moneda por defecto (solo vista previa):'
                                : '<i class="bi bi-currency-exchange"></i> Valor en moneda base (se guardará):';
                        }
                    }
                    if (rateDateInfo) rateDateInfo.textContent = `Tasa vigente al ${date}`;
                } else {
                    if (rateInfo) rateInfo.value = '⚠️ No hay tasa disponible';
                    if (previewSpan) previewSpan.textContent = 'Sin conversión';
                    if (previewDiv) previewDiv.style.display = 'block';
                    previewDiv.className = 'alert alert-warning mb-3';
                }
            }, 300);
        };

        const bindEvent = (el, event, handler) => {
            if (el) {
                el.removeEventListener(event, handler);
                el.addEventListener(event, handler);
            }
        };

        bindEvent(dateInput, 'change', updateExchangeRate);
        bindEvent(currencySelect, 'change', updateExchangeRate);
        bindEvent(amountInput, 'input', updateExchangeRate);

        setTimeout(updateExchangeRate, 100);

        this._cleanupExchangeRateEvents = () => {
            dateInput?.removeEventListener('change', updateExchangeRate);
            currencySelect?.removeEventListener('change', updateExchangeRate);
            amountInput?.removeEventListener('input', updateExchangeRate);
            if (updateTimeout) clearTimeout(updateTimeout);
        };
    }

    async saveTransaction(existingTransaction = null) {
        try {
            const user = api.getUser();
            const isSuperAdmin = user?.role === 'super_admin';
            const config = this.getConfig();

            const id = document.getElementById('transactionId')?.value;
            const companyId = isSuperAdmin ? document.getElementById('transactionCompany')?.value : null;
            const date = document.getElementById('transactionDate')?.value;
            const accountId = document.getElementById('transactionAccount')?.value;
            const amount = parseFloat(document.getElementById('transactionAmount')?.value);
            const currencyId = parseInt(document.getElementById('transactionCurrency')?.value);
            const reference = document.getElementById('transactionReference')?.value;
            const description = document.getElementById('transactionDescription')?.value;
            const paymentMethod = document.getElementById('transactionPaymentMethod')?.value;

            // Validaciones
            if (isSuperAdmin && !companyId) return showAlert('Debe seleccionar una empresa', 'warning');
            if (!date) return showAlert('La fecha es requerida', 'warning');
            if (!accountId) return showAlert('Debe seleccionar una cuenta', 'warning');
            if (!amount || amount <= 0) return showAlert('El monto debe ser mayor a 0', 'warning');
            if (!currencyId) return showAlert('Debe seleccionar una moneda', 'warning');

            const today = new Date().toISOString().split('T')[0];
            if (date > today) return showAlert('No se puede registrar con fecha futura', 'warning');

            const selectedCurrency = this.currencies.find(c => c.id === currencyId);
            const isBaseCurrency = selectedCurrency?.is_base === 1;
            const defaultCurrency = this.defaultCurrency || this.baseCurrency;

            let finalAmount = amount;
            let finalCurrencyId = currencyId;
            let finalAmountBaseCurrency = amount;
            let finalExchangeRate = 1;

            if (isBaseCurrency) {
                // Caso: Moneda Base → convertir a moneda por defecto
                if (!defaultCurrency) return showAlert('No hay moneda por defecto configurada', 'danger');
                const rateResult = await currencyService.getExchangeRate(currencyId, defaultCurrency.id, date);
                if (rateResult.success && rateResult.rate) {
                    finalAmount = amount / rateResult.rate;
                    finalCurrencyId = defaultCurrency.id;
                    finalAmountBaseCurrency = amount;
                    finalExchangeRate = rateResult.rate;
                } else {
                    return showAlert(`No se encontró tasa de cambio para ${selectedCurrency.code} → ${defaultCurrency.code}`, 'warning');
                }
            } else {
                // Caso: Otra moneda → convertir a moneda base
                const rateResult = await currencyService.convertToBase(amount, currencyId, date);
                if (rateResult.success) {
                    finalAmount = amount;
                    finalCurrencyId = currencyId;
                    finalAmountBaseCurrency = rateResult.converted_amount;
                    finalExchangeRate = rateResult.rate;
                } else {
                    showAlert(`Advertencia: ${rateResult.message}. El monto se guardará sin conversión.`, 'warning');
                    finalAmountBaseCurrency = amount;
                }
            }

            const transactionData = {
                account_id: parseInt(accountId),
                amount: finalAmount,
                currency_id: finalCurrencyId,
                exchange_rate: finalExchangeRate,
                amount_base_currency: finalAmountBaseCurrency,
                date: date,
                reference: reference || null,
                description: description || null,
                payment_method: paymentMethod
            };

            if (isSuperAdmin && companyId) transactionData.company_id = parseInt(companyId);

            let response;

            if (id && id !== '') {
                response = await transactionService[config.updateMethod](parseInt(id), transactionData);
                if (response.success) showAlert(`${config.entityName} actualizado exitosamente`, 'success');
            } else {
                response = await transactionService[config.createMethod](transactionData);
                if (response.success) showAlert(`${config.entityName} registrado exitosamente`, 'success');
            }

            if (response?.success) {
                await this.loadTransactions();
                this.closeModal();
            } else {
                showAlert(response?.message || 'Error al guardar', 'danger');
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            showAlert(error.message || 'Error al guardar', 'danger');
        }
    }

    async showReconversionModal() {
        if (!this.currencies.length) {
            await currencyService.getAll();
            this.currencies = currencyService.currencies;
            this.baseCurrency = currencyService.baseCurrency;
            this.defaultCurrency = currencyService.defaultCurrency;
        }

        const today = new Date().toISOString().split('T')[0];
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const defaultStartDate = oneYearAgo.toISOString().split('T')[0];

        const modalHtml = `
            <div class="modal fade" id="reconversionModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning">
                            <h5 class="modal-title">
                                <i class="bi bi-arrow-repeat"></i> Reconversión Masiva de ${this.getConfig().entityName}s
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i>
                                <strong>¿Qué hace esta herramienta?</strong><br>
                                Convierte los montos de ${this.getConfig().entityName}s históricos a una nueva moneda,
                                usando las tasas de cambio históricas de cada fecha.
                            </div>
                            <form id="reconversionForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Desde</label>
                                        <input type="date" class="form-control" id="reconvertStartDate" value="${defaultStartDate}" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label required">Hasta</label>
                                        <input type="date" class="form-control" id="reconvertEndDate" value="${today}" required>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label required">Moneda Destino</label>
                                    <select class="form-select" id="targetCurrency" required>
                                        <option value="">Seleccione una moneda</option>
                                        ${this.currencies.filter(c => c.is_active).map(c => `
                                            <option value="${c.id}" ${c.is_default ? 'selected' : ''}>
                                                ${c.code} - ${c.name} (${c.symbol})
                                                ${c.is_base ? ' [Actual Base]' : ''}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="createBackup">
                                        <label class="form-check-label">Crear respaldo antes de reconvertir</label>
                                    </div>
                                </div>
                                <div class="alert alert-warning" id="previewInfo" style="display: none;">
                                    <div id="previewContent"></div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="previewBtn">Previsualizar</button>
                            <button type="button" class="btn btn-warning" id="executeBtn" disabled>Ejecutar Reconversión</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('reconversionModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('reconversionModal'));

        document.getElementById('previewBtn')?.addEventListener('click', async () => {
            const startDate = document.getElementById('reconvertStartDate').value;
            const endDate = document.getElementById('reconvertEndDate').value;
            const targetCurrencyId = document.getElementById('targetCurrency').value;

            if (!startDate || !endDate || !targetCurrencyId) {
                showAlert('Complete todos los campos', 'warning');
                return;
            }

            const previewBtn = document.getElementById('previewBtn');
            const executeBtn = document.getElementById('executeBtn');
            const previewInfo = document.getElementById('previewInfo');
            const previewContent = document.getElementById('previewContent');

            previewBtn.disabled = true;
            previewBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Calculando...';

            try {
                const estimation = await reconversionService.calculateEstimation(
                    this.type, startDate, endDate, parseInt(targetCurrencyId), null
                );

                if (!estimation.hasData) {
                    previewInfo.style.display = 'block';
                    previewContent.innerHTML = `<div class="alert alert-warning">${estimation.message}</div>`;
                    executeBtn.disabled = true;
                    return;
                }

                const targetCurrency = this.currencies.find(c => c.id == targetCurrencyId);
                const sourceCurrency = this.baseCurrency;

                previewInfo.style.display = 'block';
                previewContent.innerHTML = `
                    <table class="table table-sm table-bordered">
                        <tr><th>Período:</th><td>${startDate} al ${endDate}</td></tr>
                        <tr><th>Transacciones:</th><td>${estimation.count}</td></tr>
                        <tr><th>Monto total actual:</th><td class="text-primary"><strong>${currencyService.formatInBase(estimation.total)}</strong></td></tr>
                        <tr><th>Moneda origen:</th><td>${sourceCurrency?.code} - ${sourceCurrency?.name}</td></tr>
                        <tr><th>Moneda destino:</th><td>${targetCurrency?.code} - ${targetCurrency?.name}</td></tr>
                        <tr><th>Tasa conversión:</th><td>${estimation.rate ? `1 ${sourceCurrency?.code} = ${estimation.rate.toFixed(4)} ${targetCurrency?.code}` : '<span class="text-danger">No disponible</span>'}</td></tr>
                    </table>
                    ${estimation.rate ? `<div class="alert alert-success mt-2"><strong>Nuevo total estimado:</strong> ${currencyService.formatInDefault(estimation.estimatedTotal)}</div>` : '<div class="alert alert-danger">Configure las tasas de cambio faltantes</div>'}
                `;
                executeBtn.disabled = !estimation.rate;
            } finally {
                previewBtn.disabled = false;
                previewBtn.innerHTML = '<i class="bi bi-eye"></i> Previsualizar';
            }
        });

        document.getElementById('executeBtn')?.addEventListener('click', async () => {
            const startDate = document.getElementById('reconvertStartDate').value;
            const endDate = document.getElementById('reconvertEndDate').value;
            const targetCurrencyId = document.getElementById('targetCurrency').value;
            const createBackup = document.getElementById('createBackup').checked;

            const confirmed = confirm(`⚠️ ¿Está seguro? Esta acción actualizará permanentemente los montos.`);
            if (!confirmed) return;

            const executeBtn = document.getElementById('executeBtn');
            executeBtn.disabled = true;
            executeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Reconvirtiendo...';

            try {
                const config = this.getConfig();
                const result = await reconversionService.executeReconversion(this.type, {
                    start_date: startDate,
                    end_date: endDate,
                    target_currency_id: parseInt(targetCurrencyId),
                    create_backup: createBackup
                });
                if (result.success) {
                    showAlert(`✅ Reconversión completada: ${result.data.affected} registros actualizados`, 'success');
                    modal.hide();
                    await this.loadTransactions();
                }
            } catch (error) {
                showAlert(error.message, 'danger');
            } finally {
                executeBtn.disabled = false;
                executeBtn.innerHTML = 'Ejecutar Reconversión';
            }
        });

        modal.show();
    }
}

// ✅ Exportar una instancia del módulo (esto es lo que main.js espera)
export const incomeModule = new IncomeModule();