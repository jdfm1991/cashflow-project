import { api } from './apiService.js';
import { transactionService } from './transactionService.js';
import { accountService } from './accountService.js';
import { companyService } from './companyService.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';

// services/reportService.js - Agregar al inicio del archivo

/**
 * Normalizar una fecha para evitar problemas de zona horaria
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {Date} - Fecha normalizada (mediodía UTC)
 */
function normalizeDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    // Crear fecha al mediodía UTC para evitar desplazamiento
    return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
}

/**
 * Obtener año de una fecha normalizada
 */
function getYearFromDate(dateString) {
    const [year] = dateString.split('-');
    return parseInt(year);
}

/**
 * Obtener mes de una fecha normalizada (1-12)
 */
function getMonthFromDate(dateString) {
    const [_, month] = dateString.split('-');
    return parseInt(month);
}


export const reportService = {
    accounts: [],
    companies: [],

    /**
   * Exportar reporte de transacciones
   */
    async exportTransactions(startDate, endDate, format = 'excel') {
        // Para descarga de archivos, necesitamos una petición especial
        const token = localStorage.getItem('access_token');
        const url = `http://localhost:8000/api/reports/transactions?start_date=${startDate}&end_date=${endDate}&format=${format}`;

        window.open(url, '_blank');
    },

    /**
     * Generar reporte de flujo de caja
     */
    async getCashFlow(startDate, endDate, groupBy = 'month') {
        const response = await api.get(`api/reports/cash-flow?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`);
        return response.data;
    },

    /**
     * Generar reporte de cuentas
     */
    async getAccountReport(startDate, endDate, accountType = 'all') {
        const response = await api.get(`api/reports/accounts?start_date=${startDate}&end_date=${endDate}&account_type=${accountType}`);
        return response.data;
    },

    /**
     * Cargar cuentas para el reporte
     */
    async loadAccounts() {
        try {
            const response = await accountService.getAll();
            if (response.success && response.data) {
                this.accounts = response.data;
            }
            return this.accounts;
        } catch (error) {
            console.error('Error loading accounts:', error);
            return [];
        }
    },

    /**
     * Cargar empresas (solo para super_admin)
     */
    async loadCompanies() {
        try {
            const response = await companyService.getAll();
            if (response.success && response.data) {
                this.companies = response.data;
            }
            return this.companies;
        } catch (error) {
            console.error('Error loading companies:', error);
            return [];
        }
    },

    /**
     * Cargar información de la empresa del usuario
     */
    async loadUserCompany() {
        try {
            const response = await companyService.getMyCompany();
            if (response.success && response.data) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('Error loading user company:', error);
            return null;
        }
    },

    /**
     * Generar datos del reporte
     */
    async generateReportData(filters) {
        const { companyId, startDate, endDate, groupBy } = filters;

        const apiFilters = { start_date: startDate, end_date: endDate };
        if (companyId && companyId !== '') {
            apiFilters.company_id = companyId;
        }

        const incomeResponse = await transactionService.getIncomes(apiFilters);
        const expenseResponse = await transactionService.getExpenses(apiFilters);

        let incomes = incomeResponse.success ? (incomeResponse.data.incomes || incomeResponse.data) : [];
        let expenses = expenseResponse.success ? (expenseResponse.data.expenses || expenseResponse.data) : [];

        // Procesar datos según agrupación
        let reportData;
        if (groupBy === 'year') {
            reportData = this.groupByYear(incomes, expenses);
        } else if (groupBy === 'month') {
            reportData = this.groupByMonth(incomes, expenses, startDate, endDate);
        } else {
            reportData = this.groupByQuarter(incomes, expenses, startDate, endDate);
        }

        return reportData;
    },

    /**
     * Agrupar por año
     */
    groupByYear(incomes, expenses) {
        const years = {};

        incomes.forEach(income => {
            // ✅ Usar año directamente de la cadena (sin conversión de fecha)
            const year = getYearFromDate(income.date);

            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    incomeByCurrency: {},
                    expenseByCurrency: {},
                    totalIncome: 0,
                    totalExpense: 0,
                    totalIncomeDivisa: 0,
                    totalExpenseDivisa: 0
                };
            }
            const yearData = years[year];

            const amountBase = parseFloat(income.amount_base_currency || income.amount);
            const amountDivisa = parseFloat(income.amount);
            const currencyCode = income.currency_code || 'USD';

            yearData.totalIncome += amountBase;
            yearData.incomes.push(income);

            if (!yearData.incomeByCurrency[currencyCode]) {
                yearData.incomeByCurrency[currencyCode] = 0;
            }
            yearData.incomeByCurrency[currencyCode] += amountDivisa;

            const accountName = income.account_name || 'Sin cuenta';
            if (!yearData.incomeByAccount[accountName]) {
                yearData.incomeByAccount[accountName] = 0;
            }
            yearData.incomeByAccount[accountName] += amountBase;
        });

        expenses.forEach(expense => {
            // ✅ Usar año directamente de la cadena
            const year = getYearFromDate(expense.date);

            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    incomeByCurrency: {},
                    expenseByCurrency: {},
                    totalIncome: 0,
                    totalExpense: 0,
                    totalIncomeDivisa: 0,
                    totalExpenseDivisa: 0
                };
            }
            const yearData = years[year];

            const amountBase = parseFloat(expense.amount_base_currency || expense.amount);
            const amountDivisa = parseFloat(expense.amount);
            const currencyCode = expense.currency_code || 'USD';

            yearData.totalExpense += amountBase;
            yearData.expenses.push(expense);

            if (!yearData.expenseByCurrency[currencyCode]) {
                yearData.expenseByCurrency[currencyCode] = 0;
            }
            yearData.expenseByCurrency[currencyCode] += amountDivisa;

            const accountName = expense.account_name || 'Sin cuenta';
            if (!yearData.expenseByAccount[accountName]) {
                yearData.expenseByAccount[accountName] = 0;
            }
            yearData.expenseByAccount[accountName] += amountBase;
        });

        const defaultCurrency = 'USD';
        for (const key in years) {
            years[key].totalIncomeDivisa = years[key].incomeByCurrency[defaultCurrency] || 0;
            years[key].totalExpenseDivisa = years[key].expenseByCurrency[defaultCurrency] || 0;
        }

        return Object.values(years).sort((a, b) => a.year - b.year);
    },

    /**
     * Agrupar por mes
     */
    groupByMonth(incomes, expenses, startDate, endDate) {
        const months = {};

        // ✅ Parsear fechas de inicio y fin directamente
        const [startYear, startMonth, startDay] = startDate.split('-');
        const [endYear, endMonth, endDay] = endDate.split('-');

        const startYearNum = parseInt(startYear);
        const startMonthNum = parseInt(startMonth);
        const endYearNum = parseInt(endYear);
        const endMonthNum = parseInt(endMonth);

        // ✅ Generar todos los meses en el rango
        let currentYear = startYearNum;
        let currentMonth = startMonthNum;

        while (currentYear < endYearNum || (currentYear === endYearNum && currentMonth <= endMonthNum)) {
            const key = `${currentYear}-${currentMonth}`;
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

            months[key] = {
                year: currentYear,
                month: currentMonth,
                monthName: monthNames[currentMonth - 1],
                incomes: [],
                expenses: [],
                incomeByAccount: {},
                expenseByAccount: {},
                incomeByCurrency: {},
                expenseByCurrency: {},
                incomeByCurrencyDetails: {},
                expenseByCurrencyDetails: {},
                totalIncome: 0,
                totalExpense: 0,
                totalIncomeDivisa: 0,
                totalExpenseDivisa: 0,
                sortKey: currentYear * 12 + currentMonth
            };

            // Avanzar al siguiente mes
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        // Procesar ingresos
        incomes.forEach(income => {
            // ✅ Extraer año y mes directamente de la cadena
            const [incomeYear, incomeMonth] = income.date.split('-');
            const key = `${parseInt(incomeYear)}-${parseInt(incomeMonth)}`;

            if (months[key]) {
                const month = months[key];
                month.incomes.push(income);

                const amountBase = parseFloat(income.amount_base_currency || income.amount);
                const amountDivisa = parseFloat(income.amount);
                const currencyCode = income.currency_code || 'USD';

                month.totalIncome += amountBase;

                if (!month.incomeByCurrency[currencyCode]) {
                    month.incomeByCurrency[currencyCode] = 0;
                }
                month.incomeByCurrency[currencyCode] += amountDivisa;

                const accountName = income.account_name || 'Sin cuenta';
                if (!month.incomeByAccount[accountName]) {
                    month.incomeByAccount[accountName] = 0;
                }
                month.incomeByAccount[accountName] += amountBase;

                // ✅ Detalle por cuenta y moneda
                if (!month.incomeByCurrencyDetails[accountName]) {
                    month.incomeByCurrencyDetails[accountName] = {};
                }
                if (!month.incomeByCurrencyDetails[accountName][currencyCode]) {
                    month.incomeByCurrencyDetails[accountName][currencyCode] = 0;
                }
                month.incomeByCurrencyDetails[accountName][currencyCode] += amountDivisa;
            }
        });

        // Procesar egresos
        expenses.forEach(expense => {
            // ✅ Extraer año y mes directamente de la cadena
            const [expenseYear, expenseMonth] = expense.date.split('-');
            const key = `${parseInt(expenseYear)}-${parseInt(expenseMonth)}`;

            if (months[key]) {
                const month = months[key];
                month.expenses.push(expense);

                const amountBase = parseFloat(expense.amount_base_currency || expense.amount);
                const amountDivisa = parseFloat(expense.amount);
                const currencyCode = expense.currency_code || 'USD';

                month.totalExpense += amountBase;

                if (!month.expenseByCurrency[currencyCode]) {
                    month.expenseByCurrency[currencyCode] = 0;
                }
                month.expenseByCurrency[currencyCode] += amountDivisa;

                const accountName = expense.account_name || 'Sin cuenta';
                if (!month.expenseByAccount[accountName]) {
                    month.expenseByAccount[accountName] = 0;
                }
                month.expenseByAccount[accountName] += amountBase;

                // ✅ Detalle por cuenta y moneda
                if (!month.expenseByCurrencyDetails[accountName]) {
                    month.expenseByCurrencyDetails[accountName] = {};
                }
                if (!month.expenseByCurrencyDetails[accountName][currencyCode]) {
                    month.expenseByCurrencyDetails[accountName][currencyCode] = 0;
                }
                month.expenseByCurrencyDetails[accountName][currencyCode] += amountDivisa;
            }
        });

        // Calcular totales en divisa por defecto
        const defaultCurrency = 'USD';
        for (const key in months) {
            months[key].totalIncomeDivisa = months[key].incomeByCurrency[defaultCurrency] || 0;
            months[key].totalExpenseDivisa = months[key].expenseByCurrency[defaultCurrency] || 0;
        }

        return Object.values(months).sort((a, b) => a.sortKey - b.sortKey);
    },

    /**
     * Agrupar por trimestre
     */
    groupByQuarter(incomes, expenses, startDate, endDate) {
        const quarters = {};

        // ✅ Parsear fechas directamente
        const [startYear, startMonth] = startDate.split('-');
        const [endYear, endMonth] = endDate.split('-');

        const startYearNum = parseInt(startYear);
        const startMonthNum = parseInt(startMonth);
        const endYearNum = parseInt(endYear);
        const endMonthNum = parseInt(endMonth);

        // Calcular trimestre de inicio
        let startQuarter = Math.floor((startMonthNum - 1) / 3) + 1;
        let currentYear = startYearNum;
        let currentQuarter = startQuarter;

        while (currentYear < endYearNum || (currentYear === endYearNum && currentQuarter <= Math.floor((endMonthNum - 1) / 3) + 1)) {
            const key = `${currentYear}-Q${currentQuarter}`;
            const quarterNames = { 1: '1er Trimestre', 2: '2do Trimestre', 3: '3er Trimestre', 4: '4to Trimestre' };

            quarters[key] = {
                year: currentYear,
                quarter: currentQuarter,
                quarterName: quarterNames[currentQuarter],
                incomes: [],
                expenses: [],
                incomeByAccount: {},
                expenseByAccount: {},
                incomeByCurrency: {},
                expenseByCurrency: {},
                totalIncome: 0,
                totalExpense: 0,
                totalIncomeDivisa: 0,
                totalExpenseDivisa: 0,
                sortKey: currentYear * 4 + currentQuarter
            };

            currentQuarter++;
            if (currentQuarter > 4) {
                currentQuarter = 1;
                currentYear++;
            }
        }

        // Procesar ingresos
        incomes.forEach(income => {
            const [incomeYear, incomeMonth] = income.date.split('-');
            const year = parseInt(incomeYear);
            const month = parseInt(incomeMonth);
            const quarter = Math.floor((month - 1) / 3) + 1;
            const key = `${year}-Q${quarter}`;

            if (quarters[key]) {
                const quarterData = quarters[key];

                const amountBase = parseFloat(income.amount_base_currency || income.amount);
                const amountDivisa = parseFloat(income.amount);
                const currencyCode = income.currency_code || 'USD';

                quarterData.totalIncome += amountBase;
                quarterData.incomes.push(income);

                if (!quarterData.incomeByCurrency[currencyCode]) {
                    quarterData.incomeByCurrency[currencyCode] = 0;
                }
                quarterData.incomeByCurrency[currencyCode] += amountDivisa;

                const accountName = income.account_name || 'Sin cuenta';
                if (!quarterData.incomeByAccount[accountName]) {
                    quarterData.incomeByAccount[accountName] = 0;
                }
                quarterData.incomeByAccount[accountName] += amountBase;
            }
        });

        // Procesar egresos
        expenses.forEach(expense => {
            const [expenseYear, expenseMonth] = expense.date.split('-');
            const year = parseInt(expenseYear);
            const month = parseInt(expenseMonth);
            const quarter = Math.floor((month - 1) / 3) + 1;
            const key = `${year}-Q${quarter}`;

            if (quarters[key]) {
                const quarterData = quarters[key];

                const amountBase = parseFloat(expense.amount_base_currency || expense.amount);
                const amountDivisa = parseFloat(expense.amount);
                const currencyCode = expense.currency_code || 'USD';

                quarterData.totalExpense += amountBase;
                quarterData.expenses.push(expense);

                if (!quarterData.expenseByCurrency[currencyCode]) {
                    quarterData.expenseByCurrency[currencyCode] = 0;
                }
                quarterData.expenseByCurrency[currencyCode] += amountDivisa;

                const accountName = expense.account_name || 'Sin cuenta';
                if (!quarterData.expenseByAccount[accountName]) {
                    quarterData.expenseByAccount[accountName] = 0;
                }
                quarterData.expenseByAccount[accountName] += amountBase;
            }
        });

        const defaultCurrency = 'USD';
        for (const key in quarters) {
            quarters[key].totalIncomeDivisa = quarters[key].incomeByCurrency[defaultCurrency] || 0;
            quarters[key].totalExpenseDivisa = quarters[key].expenseByCurrency[defaultCurrency] || 0;
        }

        return Object.values(quarters).sort((a, b) => a.sortKey - b.sortKey);
    },

    /**
     * Calcular totales generales
     */
    calculateTotals(reportData) {
        const totalIncome = reportData.reduce((sum, p) => sum + p.totalIncome, 0);
        const totalExpense = reportData.reduce((sum, p) => sum + p.totalExpense, 0);
        const totalBalance = totalIncome - totalExpense;
        return { totalIncome, totalExpense, totalBalance };
    },

    /**
     * Obtener cuentas agrupadas por categoría
     */
    getAccountsByCategory(accountsByAccount) {
        const accountsWithCategory = [];

        for (const [accountName, amount] of Object.entries(accountsByAccount)) {
            const accountInfo = this.accounts.find(a => a.name === accountName);
            const category = accountInfo?.category || 'Otros';
            accountsWithCategory.push({ accountName, category, amount });
        }

        const groupedByCategory = {};
        for (const item of accountsWithCategory) {
            if (!groupedByCategory[item.category]) {
                groupedByCategory[item.category] = { total: 0, accounts: [] };
            }
            groupedByCategory[item.category].total += item.amount;
            groupedByCategory[item.category].accounts.push({
                name: item.accountName,
                amount: item.amount
            });
        }

        // Ordenar categorías por total descendente
        const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
            return groupedByCategory[b].total - groupedByCategory[a].total;
        });

        return { groupedByCategory, sortedCategories };
    },

    /**
     * Obtener fechas por defecto (último año)
     */
    getDefaultStartDate() {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        return date.toISOString().split('T')[0];
    },

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Obtener el nombre del mes
     */
    getMonthName(monthNumber) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[parseInt(monthNumber) - 1];
    },

    /**
     * Obtener texto de agrupación
     */
    getGroupByText(groupBy) {
        const texts = {
            'year': 'Año',
            'month': 'Mes',
            'quarter': 'Trimestre'
        };
        return texts[groupBy] || groupBy;
    },
};