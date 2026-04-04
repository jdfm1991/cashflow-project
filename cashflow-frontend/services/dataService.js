// Data Service: Simulates API calls, manages localStorage
const STORAGE_KEY = 'cashflow_data';

export const dataService = {
    // Initialize with mock data if empty
    initMockData() {
        const mock = {
            accounts: [
                { id: 'acc1', name: 'Ventas', type: 'income', category: 'ventas' },
                { id: 'acc2', name: 'Alquileres', type: 'income', category: 'alquileres' },
                { id: 'acc3', name: 'Impuestos', type: 'expense', category: 'impuestos' },
                { id: 'acc4', name: 'Nómina', type: 'expense', category: 'nomina' },
                { id: 'acc5', name: 'Honorarios', type: 'expense', category: 'honorarios' },
                { id: 'acc6', name: 'Proveedores', type: 'expense', category: 'proveedores' }
            ],
            incomes: [
                { id: 'inc1', accountId: 'acc1', amount: 1500, date: '2024-01-15', description: 'Venta producto A' },
                { id: 'inc2', accountId: 'acc2', amount: 800, date: '2024-01-20', description: 'Alquiler oficina' },
                { id: 'inc3', accountId: 'acc1', amount: 2200, date: '2024-02-10', description: 'Venta producto B' }
            ],
            expenses: [
                { id: 'exp1', accountId: 'acc3', amount: 500, date: '2024-01-10', description: 'Pago ISR' },
                { id: 'exp2', accountId: 'acc4', amount: 3000, date: '2024-01-30', description: 'Sueldos enero' },
                { id: 'exp3', accountId: 'acc6', amount: 1200, date: '2024-02-05', description: 'Compra insumos' }
            ]
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
    },

    getData() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    },

    saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    // Accounts CRUD
    getAccounts() {
        return this.getData().accounts;
    },
    addAccount(account) {
        const data = this.getData();
        data.accounts.push({ ...account, id: Date.now().toString() });
        this.saveData(data);
    },
    updateAccount(id, updatedAccount) {
        const data = this.getData();
        const index = data.accounts.findIndex(acc => acc.id === id);
        if (index !== -1) data.accounts[index] = { ...data.accounts[index], ...updatedAccount };
        this.saveData(data);
    },
    deleteAccount(id) {
        const data = this.getData();
        data.accounts = data.accounts.filter(acc => acc.id !== id);
        this.saveData(data);
    },

    // Incomes
    getIncomes() {
        return this.getData().incomes;
    },
    addIncome(income) {
        const data = this.getData();
        data.incomes.push({ ...income, id: Date.now().toString() });
        this.saveData(data);
    },
    deleteIncome(id) {
        const data = this.getData();
        data.incomes = data.incomes.filter(inc => inc.id !== id);
        this.saveData(data);
    },

    // Expenses
    getExpenses() {
        return this.getData().expenses;
    },
    addExpense(expense) {
        const data = this.getData();
        data.expenses.push({ ...expense, id: Date.now().toString() });
        this.saveData(data);
    },
    deleteExpense(id) {
        const data = this.getData();
        data.expenses = data.expenses.filter(exp => exp.id !== id);
        this.saveData(data);
    },

    // Bulk import (for Excel)
    bulkImport(transactions, type) { // type: 'income' or 'expense'
        const data = this.getData();
        const targetArray = type === 'income' ? data.incomes : data.expenses;
        const newTransactions = transactions.map(t => ({ ...t, id: Date.now().toString() + Math.random() }));
        targetArray.push(...newTransactions);
        this.saveData(data);
    }
};