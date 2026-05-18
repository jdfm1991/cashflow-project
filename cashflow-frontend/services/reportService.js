import { api } from './apiService.js';
import { transactionService } from './transactionService.js';
import { accountService } from './accountService.js';
import { companyService } from './companyService.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';


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
            const year = new Date(income.date).getFullYear();
            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0
                };
            }
            years[year].incomes.push(income);
            years[year].totalIncome += parseFloat(income.amount_base_currency || income.amount);
            const accountName = income.account_name || 'Sin cuenta';
            if (!years[year].incomeByAccount[accountName]) {
                years[year].incomeByAccount[accountName] = 0;
            }
            years[year].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
        });

        expenses.forEach(expense => {
            const year = new Date(expense.date).getFullYear();
            if (!years[year]) {
                years[year] = {
                    year: year,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0
                };
            }
            years[year].expenses.push(expense);
            years[year].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);
            const accountName = expense.account_name || 'Sin cuenta';
            if (!years[year].expenseByAccount[accountName]) {
                years[year].expenseByAccount[accountName] = 0;
            }
            years[year].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
        });

        return Object.values(years).sort((a, b) => a.year - b.year);
    },

    /**
     * Agrupar por mes
     */
    groupByMonth(incomes, expenses, startDate, endDate) {
        const months = {};
        const start = new Date(startDate);
        const end = new Date(endDate);

        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const endClone = new Date(end);
        endClone.setDate(1);
        endClone.setMonth(endClone.getMonth() + 1);
        endClone.setDate(0);
        endClone.setHours(23, 59, 59, 999);

        const current = new Date(start);
        while (current <= endClone) {
            const year = current.getFullYear();
            const month = current.getMonth() + 1;
            const key = `${year}-${month}`;
            months[key] = {
                year: year,
                month: month,
                monthName: current.toLocaleString('es', { month: 'long' }),
                incomes: [],
                expenses: [],
                incomeByAccount: {},
                expenseByAccount: {},
                totalIncome: 0,
                totalExpense: 0,
                sortKey: current.getTime()
            };
            current.setMonth(current.getMonth() + 1);
        }

        incomes.forEach(income => {
            const date = new Date(income.date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (months[key]) {
                months[key].incomes.push(income);
                months[key].totalIncome += parseFloat(income.amount_base_currency || income.amount);
                const accountName = income.account_name || 'Sin cuenta';
                if (!months[key].incomeByAccount[accountName]) {
                    months[key].incomeByAccount[accountName] = 0;
                }
                months[key].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
            }
        });

        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (months[key]) {
                months[key].expenses.push(expense);
                months[key].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);
                const accountName = expense.account_name || 'Sin cuenta';
                if (!months[key].expenseByAccount[accountName]) {
                    months[key].expenseByAccount[accountName] = 0;
                }
                months[key].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
            }
        });

        return Object.values(months).sort((a, b) => a.sortKey - b.sortKey);
    },

    /**
     * Agrupar por trimestre
     */
    groupByQuarter(incomes, expenses, startDate, endDate) {
        const quarters = {};
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startQuarter = Math.floor(start.getMonth() / 3);
        start.setMonth(startQuarter * 3);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const endClone = new Date(end);
        const endQuarter = Math.floor(endClone.getMonth() / 3);
        endClone.setMonth((endQuarter * 3) + 2);
        endClone.setDate(1);
        endClone.setMonth(endClone.getMonth() + 1);
        endClone.setDate(0);
        endClone.setHours(23, 59, 59, 999);

        const current = new Date(start);
        while (current <= endClone) {
            const year = current.getFullYear();
            const quarter = Math.floor(current.getMonth() / 3) + 1;
            const key = `${year}-Q${quarter}`;
            if (!quarters[key]) {
                quarters[key] = {
                    year: year,
                    quarter: quarter,
                    quarterName: `${quarter}° Trimestre`,
                    incomes: [],
                    expenses: [],
                    incomeByAccount: {},
                    expenseByAccount: {},
                    totalIncome: 0,
                    totalExpense: 0,
                    sortKey: current.getTime()
                };
            }
            current.setMonth(current.getMonth() + 3);
        }

        incomes.forEach(income => {
            const date = new Date(income.date);
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const key = `${date.getFullYear()}-Q${quarter}`;
            if (quarters[key]) {
                quarters[key].incomes.push(income);
                quarters[key].totalIncome += parseFloat(income.amount_base_currency || income.amount);
                const accountName = income.account_name || 'Sin cuenta';
                if (!quarters[key].incomeByAccount[accountName]) {
                    quarters[key].incomeByAccount[accountName] = 0;
                }
                quarters[key].incomeByAccount[accountName] += parseFloat(income.amount_base_currency || income.amount);
            }
        });

        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const key = `${date.getFullYear()}-Q${quarter}`;
            if (quarters[key]) {
                quarters[key].expenses.push(expense);
                quarters[key].totalExpense += parseFloat(expense.amount_base_currency || expense.amount);
                const accountName = expense.account_name || 'Sin cuenta';
                if (!quarters[key].expenseByAccount[accountName]) {
                    quarters[key].expenseByAccount[accountName] = 0;
                }
                quarters[key].expenseByAccount[accountName] += parseFloat(expense.amount_base_currency || expense.amount);
            }
        });

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
    }
};