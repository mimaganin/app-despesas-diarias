// app.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPJb5eqA_etrkWuNO8mOkBAGqh4l6B01Q",
  authDomain: "registro-despesas-diarias.firebaseapp.com",
  projectId: "registro-despesas-diarias",
  storageBucket: "registro-despesas-diarias.appspot.com",
  messagingSenderId: "865133835490",
  appId: "1:865133835490:web:35101ac8cf0ed3eb37dabb",
  measurementId: "G-TJLKG5ZEZD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Variáveis Globais
let chart; // Variável global para o gráfico
let isEditing = false; // Flag para indicar se está no modo de edição
let editingIndex = null; // Índice da despesa que está sendo editada

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    setDefaultDate();
    loadExpenses();
    populateFilterYears();
    renderChart();
    renderExpensesTable();
    setupFilterListeners();
});

// Seleção de elementos
const expenseForm = document.getElementById('expense-form');
const exportBtn = document.getElementById('export-btn');
const ctx = document.getElementById('expense-chart').getContext('2d');
const filterYear = document.getElementById('filter-year');
const filterMonth = document.getElementById('filter-month');
const warningDiv = document.getElementById('warning');
const successMessageDiv = document.getElementById('success-message');
const noDataMessageDiv = document.getElementById('no-data-message');
const expensesTableContainer = document.getElementById('expenses-table-container');
const expensesTableBody = document.querySelector('#expenses-table tbody');

// Evento de submissão do formulário
expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const value = parseFloat(document.getElementById('value').value);
    const category = document.getElementById('category').value;
    const dateInput = document.getElementById('date').value;

    if (name && !isNaN(value) && category && dateInput) {
        const expenseDate = new Date(dateInput);
        const expense = {
            name,
            value,
            category,
            date: expenseDate.toISOString()
        };

        if (isEditing && editingIndex !== null) {
            // Atualizar a despesa existente
            updateExpense(editingIndex, expense);
            isEditing = false;
            editingIndex = null;
            expenseForm.querySelector('button[type="submit"]').textContent = 'Adicionar';
            showSuccessMessage('Despesa atualizada com sucesso!');
        } else {
            // Adicionar nova despesa
            saveExpense(expense);
            showSuccessMessage();
        }

        expenseForm.reset();
        setDefaultDate(); // Retorna a data atual após resetar o formulário
        renderChart();
        renderExpensesTable();
        populateFilterYears();
        checkExpenseMonth(expense.date);
    }
});

// Evento de exportação
exportBtn.addEventListener('click', () => {
    const expenses = getFilteredExpenses();
    if (expenses.length === 0) {
        alert('Nenhuma despesa para exportar.');
        return;
    }

    let csvContent = "Nome,Valor,Categoria,Data\n";
    expenses.forEach(exp => {
        const date = new Date(exp.date).toLocaleString('pt-BR', {
            timeZone: 'UTC'
        });
        // Escapar aspas duplas nas strings para evitar quebra do CSV
        const name = exp.name.replace(/"/g, '""');
        const category = exp.category.replace(/"/g, '""');
        const formattedValue = `€${exp.value.toFixed(2)}`; // Adiciona o símbolo de Euro
        csvContent += `"${name}",${formattedValue},"${category}","${date}"\n`;
    });

    // Criação do Blob com o conteúdo CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Verificação de suporte para download de Blob
    if (navigator.msSaveBlob) { // Para IE 10+
        navigator.msSaveBlob(blob, 'despesas.csv');
    } else {
        const link = document.createElement("a");
        if (link.download !== undefined) { // Suporte para navegadores modernos
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "despesas.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Fallback para navegadores que não suportam download via link
            window.open("data:text/csv;charset=utf-8," + encodeURIComponent(csvContent));
        }
    }
});

// Funções para gerenciar despesas no localStorage
function getExpenses() {
    const expenses = localStorage.getItem('expenses');
    return expenses ? JSON.parse(expenses) : [];
}

function saveExpense(expense) {
    const expenses = getExpenses();
    expenses.push(expense);
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function updateExpense(index, updatedExpense) {
    const expenses = getExpenses();
    expenses[index] = updatedExpense;
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function deleteExpense(index) {
    const expenses = getExpenses();
    expenses.splice(index, 1);
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

// Função para carregar despesas
function loadExpenses() {
    renderChart();
    renderExpensesTable();
}

// Função para popular os filtros de ano
function populateFilterYears() {
    const expenses = getExpenses();
    const years = expenses.map(exp => new Date(exp.date).getFullYear());
    const uniqueYears = [...new Set(years)].sort((a, b) => b - a);

    // Limpar opções atuais, mantendo "Todos"
    filterYear.innerHTML = '<option value="all">Todos</option>';
    uniqueYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYear.appendChild(option);
    });
}

// Função para configurar os listeners dos filtros
function setupFilterListeners() {
    filterYear.addEventListener('change', () => {
        renderChart();
        renderExpensesTable();
    });
    filterMonth.addEventListener('change', () => {
        renderChart();
        renderExpensesTable();
    });
}

// Função para obter despesas filtradas
function getFilteredExpenses() {
    const expenses = getExpenses();
    const selectedYear = filterYear.value;
    const selectedMonth = filterMonth.value;

    return expenses.filter(exp => {
        const date = new Date(exp.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // getMonth() retorna 0-11

        let yearMatch = true;
        let monthMatch = true;

        if (selectedYear !== 'all') {
            yearMatch = (year === parseInt(selectedYear));
        }

        if (selectedMonth !== 'all') {
            monthMatch = (month === parseInt(selectedMonth));
        }

        return yearMatch && monthMatch;
    });
}

// Função para renderizar o gráfico de pizza
function renderChart() {
    const expenses = getFilteredExpenses();
    const categories = [
        "Educação",
        "Saúde",
        "Transporte",
        "Lazer",
        "Alimentação",
        "Água-Luz-Internet",
        "Delivery",
        "Assinaturas"
    ];

    const data = {};
    categories.forEach(cat => data[cat] = 0);

    expenses.forEach(exp => {
        if (data[exp.category] !== undefined) {
            data[exp.category] += exp.value;
        }
    });

    const labels = [];
    const values = [];
    const backgroundColors = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#C9CBCF',
        '#8B0000'
    ];

    categories.forEach((cat, index) => {
        if (data[cat] > 0) {
            labels.push(cat);
            values.push(data[cat]);
        }
    });

    if (chart) {
        chart.destroy();
    }

    if (labels.length === 0) {
        // Ocultar o canvas e mostrar a mensagem de ausência de dados
        document.getElementById('expense-chart').style.display = 'none';
        noDataMessageDiv.style.display = 'block';
        expensesTableContainer.style.display = 'none'; // Ocultar tabela quando não há dados
    } else {
        // Mostrar o canvas e ocultar a mensagem de ausência de dados
        document.getElementById('expense-chart').style.display = 'block';
        noDataMessageDiv.style.display = 'none';
        expensesTableContainer.style.display = 'block'; // Mostrar tabela quando há dados

        chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Distribuição de Despesas (€)'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += `€${context.parsed.toFixed(2)}`;
                                }
                                return label;
                            }
                        }
                    }
                }
            },
        });
    }
}

// Função para renderizar a tabela de despesas
function renderExpensesTable() {
    const expenses = getFilteredExpenses();

    // Limpar o corpo da tabela
    expensesTableBody.innerHTML = '';

    if (expenses.length === 0) {
        expensesTableContainer.style.display = 'none';
        return;
    }

    expenses.forEach((exp, index) => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = exp.name;
        tr.appendChild(nameTd);

        const valueTd = document.createElement('td');
        valueTd.textContent = `€${exp.value.toFixed(2)}`;
        tr.appendChild(valueTd);

        const categoryTd = document.createElement('td');
        categoryTd.textContent = exp.category;
        tr.appendChild(categoryTd);

        const dateTd = document.createElement('td');
        const formattedDate = new Date(exp.date).toLocaleDateString('pt-BR');
        dateTd.textContent = formattedDate;
        tr.appendChild(dateTd);

        const actionsTd = document.createElement('td');

        // Botão Editar
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.classList.add('action-btn', 'edit-btn');
        editBtn.addEventListener('click', () => {
            populateFormForEdit(index, exp);
        });
        actionsTd.appendChild(editBtn);

        // Botão Excluir
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Excluir';
        deleteBtn.classList.add('action-btn', 'delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('Tem certeza de que deseja excluir esta despesa?')) {
                deleteExpense(index);
                renderChart();
                renderExpensesTable();
                populateFilterYears();
                showSuccessMessage('Despesa excluída com sucesso!');
            }
        });
        actionsTd.appendChild(deleteBtn);

        tr.appendChild(actionsTd);

        expensesTableBody.appendChild(tr);
    });

    expensesTableContainer.style.display = 'block';
}

// Função para preencher o formulário com os dados da despesa para edição
function populateFormForEdit(index, expense) {
    document.getElementById('name').value = expense.name;
    document.getElementById('value').value = expense.value;
    document.getElementById('category').value = expense.category;
    const date = new Date(expense.date);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months start at 0!
    const dd = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;
    document.getElementById('date').value = formattedDate;

    isEditing = true;
    editingIndex = index;
    expenseForm.querySelector('button[type="submit"]').textContent = 'Atualizar';

    // Desloca a página para o início do formulário
    const formContainer = document.getElementById('expense-form-container');
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

// Função para verificar se a despesa está sendo adicionada no mês atual
function checkExpenseMonth(expenseDateISO) {
    const expenseDate = new Date(expenseDateISO);
    const currentDate = new Date();

    const expenseMonth = expenseDate.getMonth();
    const expenseYear = expenseDate.getFullYear();

    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    console.log(`Despesa: Mês ${expenseMonth + 1}, Ano ${expenseYear}`);
    console.log(`Atual: Mês ${currentMonth + 1}, Ano ${currentYear}`);

    if (expenseMonth !== currentMonth || expenseYear !== currentYear) {
        warningDiv.style.display = 'block';
        console.log("Aviso exibido.");
    } else {
        warningDiv.style.display = 'none';
        console.log("Aviso oculto.");
    }
}

// Função para exibir a mensagem de sucesso
function showSuccessMessage(message = 'Despesa adicionada com sucesso!') {
    successMessageDiv.textContent = message;
    successMessageDiv.style.display = 'block';
    setTimeout(() => {
        successMessageDiv.style.display = 'none';
    }, 3000); // Mensagem desaparece após 3 segundos
}

// Função para definir a data atual no campo de data
function setDefaultDate() {
    const dateInput = document.getElementById('date');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0!
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedToday = `${yyyy}-${mm}-${dd}`;
    dateInput.value = formattedToday;
}

// Funções para PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
        .then(reg => {
            console.log('Service Worker registrado com sucesso:', reg);
        })
        .catch(err => {
            console.error('Falha ao registrar Service Worker:', err);
        });
    }
}