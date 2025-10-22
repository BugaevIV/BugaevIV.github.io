// Состояние приложения
let appState = {
    currentScreen: 'welcome',
    currentQuestion: 0,
    userAnswers: [],
    score: 0,
    startTime: null,
    endTime: null,
    userId: null,
    userName: 'Гость'
};

// Хранилище результатов (в реальном приложении заменить на серверную БД)
let resultsStorage = {
    users: [],
    results: [],
    adminKey: 'fencing2024'
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация VK Bridge
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppInit');
        getUserInfo();
    }
    
    // Загрузка сохраненных результатов из localStorage
    loadResults();
    showScreen('welcome');
});

// Получение информации о пользователе
function getUserInfo() {
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppGetUserInfo')
            .then(userInfo => {
                appState.userId = userInfo.id;
                appState.userName = userInfo.first_name + ' ' + userInfo.last_name;
            })
            .catch(error => {
                console.log('Не удалось получить информацию о пользователе');
                generateGuestId();
            });
    } else {
        generateGuestId();
    }
}

// Генерация ID для гостя
function generateGuestId() {
    appState.userId = 'guest_' + Math.random().toString(36).substr(2, 9);
}

// Загрузка результатов из localStorage
function loadResults() {
    const saved = localStorage.getItem('fencingTestResults');
    if (saved) {
        resultsStorage = JSON.parse(saved);
    }
}

// Сохранение результатов в localStorage
function saveResults() {
    localStorage.setItem('fencingTestResults', JSON.stringify(resultsStorage));
}

// Сохранение результата теста
function saveTestResult(score, percentage, timeSpent) {
    const result = {
        id: Date.now(),
        userId: appState.userId,
        userName: appState.userName,
        score: score,
        total: testQuestions.length,
        percentage: percentage,
        timeSpent: timeSpent,
        date: new Date().toISOString(),
        answers: [...appState.userAnswers]
    };
    
    // Проверяем, есть ли уже результат у этого пользователя
    const existingIndex = resultsStorage.results.findIndex(r => r.userId === appState.userId);
    if (existingIndex !== -1) {
        resultsStorage.results[existingIndex] = result;
    } else {
        resultsStorage.results.push(result);
    }
    
    saveResults();
    return result;
}

// Показ экранов
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    document.getElementById(screenName + '-screen').classList.add('active');
    appState.currentScreen = screenName;
    
    // Если показываем админку, обновляем статистику
    if (screenName === 'admin') {
        updateAdminStats();
    }
}

// Начало теста
function startTest() {
    appState.currentQuestion = 0;
    appState.userAnswers = [];
    appState.score = 0;
    appState.startTime = new Date();
    
    showScreen('test');
    displayQuestion();
}

// Отображение вопроса
function displayQuestion() {
    const question = testQuestions[appState.currentQuestion];
    const progress = ((appState.currentQuestion) / testQuestions.length) * 100;
    
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = 
        `${appState.currentQuestion + 1}/${testQuestions.length}`;
    
    document.getElementById('question-text').textContent = question.question;
    
    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';
    
    question.answers.forEach((answer, index) => {
        const answerElement = document.createElement('div');
        answerElement.className = 'answer-option';
        answerElement.innerHTML = `
            <div class="answer-text">${answer}</div>
        `;
        
        answerElement.addEventListener('click', () => selectAnswer(index));
        answersContainer.appendChild(answerElement);
    });
    
    document.getElementById('next-button').disabled = true;
}

// Выбор ответа
function selectAnswer(answerIndex) {
    const question = testQuestions[appState.currentQuestion];
    const answerOptions = document.querySelectorAll('.answer-option');
    
    answerOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    answerOptions[answerIndex].classList.add('selected');
    appState.userAnswers[appState.currentQuestion] = [answerIndex];
    document.getElementById('next-button').disabled = false;
}

// Следующий вопрос
function nextQuestion() {
    appState.currentQuestion++;
    
    if (appState.currentQuestion < testQuestions.length) {
        displayQuestion();
    } else {
        finishTest();
    }
}

// Завершение теста
function finishTest() {
    appState.endTime = new Date();
    calculateScore();
    
    const timeSpent = Math.round((appState.endTime - appState.startTime) / 1000);
    const percentage = Math.round((appState.score / testQuestions.length) * 100);
    
    // Сохраняем результат
    saveTestResult(appState.score, percentage, timeSpent);
    showResults(percentage, timeSpent);
}

// Расчет результатов
function calculateScore() {
    appState.score = 0;
    
    testQuestions.forEach((question, index) => {
        const userAnswer = appState.userAnswers[index];
        
        if (!userAnswer) return;
        
        if (question.type === 'single') {
            if (userAnswer[0] === question.correct) {
                appState.score++;
            }
        } else if (question.type === 'multiple') {
            const userSorted = [...userAnswer].sort().join('');
            const correctSorted = [...question.correct].sort().join('');
            
            if (userSorted === correctSorted) {
                appState.score++;
            }
        }
    });
}

// Показ результатов
function showResults(percentage, timeSpent) {
    const totalQuestions = testQuestions.length;
    const correctAnswers = appState.score;
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    
    document.getElementById('score-percent').textContent = percentage + '%';
    document.getElementById('correct-answers').textContent = correctAnswers;
    document.getElementById('total-questions').textContent = totalQuestions;
    document.getElementById('time-spent').textContent = `${minutes} мин ${seconds} сек`;
    
    const scoreCircle = document.getElementById('score-circle');
    scoreCircle.style.setProperty('--progress', percentage + '%');
    
    const resultText = document.getElementById('result-text');
    let message = '';
    
    if (percentage >= 90) {
        message = 'Отлично! Вы настоящий эксперт в арт-фехтовании! 🏆';
    } else if (percentage >= 70) {
        message = 'Хороший результат! Вы хорошо знаете правила. 👍';
    } else if (percentage >= 50) {
        message = 'Неплохо, но есть что повторить. 📚';
    } else {
        message = 'Вам стоит изучить правила внимательнее. 💪';
    }
    
    resultText.textContent = message;
    showScreen('result');
}

// Админ-панель
function showAdminPanel() {
    const password = prompt('Введите пароль администратора:');
    if (password === resultsStorage.adminKey) {
        showScreen('admin');
    } else {
        alert('Неверный пароль!');
    }
}

// Обновление статистики в админке
function updateAdminStats() {
    const results = resultsStorage.results;
    
    // Общая статистика
    document.getElementById('total-tests').textContent = results.length;
    document.getElementById('average-score').textContent = 
        results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length) + '%' : '0%';
    
    // Лучшие результаты
    const bestResults = [...results].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    const bestResultsContainer = document.getElementById('best-results');
    bestResultsContainer.innerHTML = '';
    
    bestResults.forEach((result, index) => {
        const resultElement = document.createElement('div');
        resultElement.className = 'admin-result-item';
        resultElement.innerHTML = `
            <div class="result-rank">${index + 1}</div>
            <div class="result-user">${result.userName}</div>
            <div class="result-score">${result.percentage}%</div>
            <div class="result-date">${new Date(result.date).toLocaleDateString()}</div>
        `;
        bestResultsContainer.appendChild(resultElement);
    });
    
    // Все результаты
    const allResultsContainer = document.getElementById('all-results');
    allResultsContainer.innerHTML = '';
    
    results.forEach((result, index) => {
        const resultElement = document.createElement('div');
        resultElement.className = 'admin-result-item';
        resultElement.innerHTML = `
            <div class="result-rank">${index + 1}</div>
            <div class="result-user">${result.userName}</div>
            <div class="result-score">${result.score}/${result.total} (${result.percentage}%)</div>
            <div class="result-date">${new Date(result.date).toLocaleString()}</div>
        `;
        allResultsContainer.appendChild(resultElement);
    });
}

// Экспорт результатов
function exportResults() {
    const data = JSON.stringify(resultsStorage.results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fencing_results_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Очистка результатов
function clearResults() {
    if (confirm('Вы уверены, что хотите удалить все результаты? Это действие нельзя отменить.')) {
        resultsStorage.results = [];
        saveResults();
        updateAdminStats();
        alert('Результаты очищены!');
    }
}

// Перезапуск теста
function restartTest() {
    showScreen('welcome');
}

// Поделиться результатом
function shareResult() {
    const percentage = Math.round((appState.score / testQuestions.length) * 100);
    
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShowWallPostBox', {
            message: `Я прошел тест по арт-фехтованию и набрал ${percentage}%! Проверь свои знания тоже!`
        }).catch(error => {
            alert(`Мой результат: ${percentage}% правильных ответов!`);
        });
    } else {
        alert(`Мой результат: ${percentage}% правильных ответов!`);
    }
}
