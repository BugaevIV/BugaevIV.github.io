// app.js - Основная логика приложения

// Состояние приложения
let appState = {
    currentScreen: 'loading',
    currentQuestion: 0,
    userAnswers: [],
    score: 0,
    startTime: null,
    endTime: null,
    userId: null,
    userName: 'Гость',
    currentTest: null,
    availableTests: [],
    testCompleted: false,
    isAdmin: false
};

// Хранилище результатов
let resultsStorage = {
    users: [],
    results: [],
    adminKey: 'fencing2024'
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    // Показываем экран загрузки
    showScreen('loading');
    
    try {
        // Инициализация VK Bridge
        if (typeof vkBridge !== 'undefined') {
            await vkBridge.send('VKWebAppInit');
            getUserInfo();
        } else {
            generateGuestId();
        }
        
        // Инициализация загрузчика тестов
        await testLoader.init();
        
        // Загрузка доступных тестов (только НЕ обучающие)
        appState.availableTests = testLoader.getAvailableTests();
        
        // Загрузка сохраненных результатов
        loadResults();
        
        // Переходим к выбору теста
        showScreen('test-selection');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        document.getElementById('loading-error').style.display = 'block';
        document.getElementById('loading-spinner').style.display = 'none';
    }
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

// Выбор теста
async function selectTest(testId) {
    try {
        showScreen('loading');
        
        const test = await testLoader.loadTest(testId);
        if (test) {
            appState.currentTest = test;
            appState.testCompleted = false;
            
            // Заполняем информацию на экране приветствия
            document.getElementById('welcome-test-title').textContent = test.title;
            document.getElementById('welcome-test-description').textContent = test.description;
            document.getElementById('welcome-test-difficulty').textContent = test.difficulty || 'Стандартный';
            document.getElementById('welcome-test-duration').textContent = test.duration || 'Не указано';
            document.getElementById('welcome-test-questions').textContent = test.questions ? test.questions.length : 0;
            document.getElementById('welcome-test-author').textContent = test.author || 'Неизвестен';
            
            showScreen('welcome');
        } else {
            throw new Error('Тест не найден');
        }
    } catch (error) {
        console.error('Ошибка загрузки теста:', error);
        alert('Не удалось загрузить тест. Попробуйте позже.');
        showScreen('test-selection');
    }
}

// Обновление списка тестов
async function refreshTests() {
    try {
        showScreen('loading');
        
        // Очищаем кеш и перезагружаем
        await testLoader.refreshTests();
        
        appState.availableTests = testLoader.getAvailableTests();
        showScreen('test-selection');
        
    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('Не удалось обновить список тестов');
        showScreen('test-selection');
    }
}

// Заполнение списка тестов (только НЕ обучающие)
function fillTestSelection() {
    const container = document.getElementById('tests-container');
    container.innerHTML = '';
    
    // Двойная фильтрация для гарантии
    const filteredTests = appState.availableTests.filter(test => 
        test.mode !== 'tutorial' && 
        !test.title.includes('Обучающий') && 
        !test.description.includes('обучения')
    );
    
    if (filteredTests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Тесты не найдены</h3>
                <p>Нет доступных тестов для загрузки</p>
                <button class="vk-button" onclick="refreshTests()">Обновить</button>
            </div>
        `;
        return;
    }
    
    filteredTests.forEach(test => {
        const testElement = document.createElement('div');
        testElement.className = 'test-card';
        
        const isLocal = test.isLocal;
        const isCustom = test.isCustom;
        const isBuiltIn = test.isBuiltIn;
        
        testElement.innerHTML = `
            <div class="test-card-header">
                <h3>${test.title}</h3>
                <div class="test-badges">
                    ${isLocal ? '<span class="test-badge local">Локальный</span>' : ''}
                    ${isCustom ? '<span class="test-badge custom">Пользовательский</span>' : ''}
                    ${isBuiltIn ? '<span class="test-badge local">Встроенный</span>' : ''}
                    <span class="test-difficulty ${test.difficulty ? test.difficulty.toLowerCase() : 'default'}">
                        ${test.difficulty || 'Стандартный'}
                    </span>
                </div>
            </div>
            <p class="test-description">${test.description}</p>
            <div class="test-meta">
                ${test.duration ? `<span class="test-meta-item">⏱ ${test.duration}</span>` : ''}
                ${test.totalQuestions ? `<span class="test-meta-item">❓ ${test.totalQuestions} вопросов</span>` : ''}
                ${test.author ? `<span class="test-meta-item">👤 ${test.author}</span>` : ''}
            </div>
            <div class="test-actions">
                <button class="vk-button" onclick="selectTest('${test.id}')">Выбрать тест</button>
                ${isCustom && appState.isAdmin ? `<button class="vk-button secondary small" onclick="removeCustomTest('${test.id}')">Удалить</button>` : ''}
            </div>
        `;
        container.appendChild(testElement);
    });
}

// Удаление пользовательского теста (только для администратора)
function removeCustomTest(testId) {
    if (!appState.isAdmin) {
        alert('Только администратор может удалять тесты!');
        return;
    }
    
    if (confirm('Удалить этот тест из списка?')) {
        testLoader.removeCustomTest(testId);
        appState.availableTests = appState.availableTests.filter(t => t.id !== testId);
        fillTestSelection();
    }
}

// Начало теста
function startTest() {
    if (!appState.currentTest) return;
    
    appState.currentQuestion = 0;
    appState.userAnswers = [];
    appState.score = 0;
    appState.startTime = new Date();
    appState.testCompleted = false;
    
    showScreen('test');
    displayQuestion();
}

// Отображение вопроса
function displayQuestion() {
    if (!appState.currentTest) return;
    
    const question = appState.currentTest.questions[appState.currentQuestion];
    const progress = ((appState.currentQuestion) / appState.currentTest.questions.length) * 100;
    
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = 
        `${appState.currentQuestion + 1}/${appState.currentTest.questions.length}`;
    
    document.getElementById('question-text').textContent = question.question;
    
    // Скрываем объяснение
    document.getElementById('explanation-container').style.display = 'none';
    
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
    
    // Для обучающего режима показываем подсказку
    if (appState.currentTest.mode === 'tutorial') {
        document.getElementById('next-button').textContent = 'Выберите ответ для проверки';
    } else {
        document.getElementById('next-button').textContent = 'Далее';
    }
}

// Выбор ответа
function selectAnswer(answerIndex) {
    const question = appState.currentTest.questions[appState.currentQuestion];
    const answerOptions = document.querySelectorAll('.answer-option');
    
    // Если это обучающий режим и ответ уже проверялся, не делаем ничего
    if (appState.currentTest.mode === 'tutorial' && appState.userAnswers[appState.currentQuestion] !== undefined) {
        return;
    }
    
    answerOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    answerOptions[answerIndex].classList.add('selected');
    appState.userAnswers[appState.currentQuestion] = [answerIndex];
    
    // В обучающем режиме сразу проверяем ответ
    if (appState.currentTest.mode === 'tutorial') {
        checkAnswerInTutorialMode(answerIndex, question);
    } else {
        document.getElementById('next-button').disabled = false;
    }
}

// Проверка ответа в обучающем режиме - ИСПРАВЛЕНА
function checkAnswerInTutorialMode(userAnswer, question) {
    const answerOptions = document.querySelectorAll('.answer-option');
    const isCorrect = Array.isArray(question.correct) 
        ? question.correct.includes(userAnswer)
        : question.correct === userAnswer;
    
    // Подсвечиваем правильные и неправильные ответы
    answerOptions.forEach((option, index) => {
        const isUserAnswer = index === userAnswer;
        const isRightAnswer = Array.isArray(question.correct) 
            ? question.correct.includes(index)
            : question.correct === index;
        
        if (isRightAnswer) {
            option.classList.add('correct');
        } else if (isUserAnswer && !isRightAnswer) {
            option.classList.add('incorrect');
        }
        
        // Блокируем все варианты после выбора
        option.classList.add('disabled');
    });
    
    // Показываем объяснение
    if (question.explanation) {
        document.getElementById('explanation-text').textContent = question.explanation;
        document.getElementById('explanation-container').style.display = 'block';
    }
    
    // Обновляем счет
    if (isCorrect) {
        appState.score++;
    }
    
    // Активируем кнопку "Далее"
    document.getElementById('next-button').disabled = false;
    document.getElementById('next-button').textContent = 'Далее';
}

// Следующий вопрос
function nextQuestion() {
    appState.currentQuestion++;
    
    if (appState.currentQuestion < appState.currentTest.questions.length) {
        displayQuestion();
    } else {
        finishTest();
    }
}

// Досрочное завершение теста
function finishTestEarly() {
    if (confirm('Вы уверены, что хотите завершить тест досрочно? Все ответы до текущего вопроса будут сохранены.')) {
        finishTest();
    }
}

// Завершение теста
function finishTest() {
    appState.endTime = new Date();
    appState.testCompleted = true;
    
    // Для экзаменационного режима вычисляем результат
    if (appState.currentTest.mode === 'exam') {
        calculateScore();
    }
    
    const timeSpent = Math.round((appState.endTime - appState.startTime) / 1000);
    
    // Для обучающего режима процент = (правильные ответы / общее количество вопросов) * 100
    let percentage;
    if (appState.currentTest.mode === 'tutorial') {
        percentage = Math.round((appState.score / appState.currentTest.questions.length) * 100);
    } else {
        percentage = Math.round((appState.score / appState.currentTest.questions.length) * 100);
    }
    
    // Сохраняем результат (только для экзаменационного режима)
    if (appState.currentTest.mode === 'exam') {
        saveTestResult(appState.score, percentage, timeSpent);
    }
    
    showResults(percentage, timeSpent);
}

// Расчет результатов (только для экзаменационного режима)
function calculateScore() {
    if (appState.currentTest.mode !== 'exam') return;
    
    appState.score = 0;
    
    appState.currentTest.questions.forEach((question, index) => {
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

// Сохранение результата теста (только для экзаменационного режима)
function saveTestResult(score, percentage, timeSpent) {
    if (appState.currentTest.mode !== 'exam') return;
    
    const result = {
        id: Date.now(),
        userId: appState.userId,
        userName: appState.userName,
        testId: appState.currentTest.id,
        testTitle: appState.currentTest.title,
        score: score,
        total: appState.currentTest.questions.length,
        percentage: percentage,
        timeSpent: timeSpent,
        date: new Date().toISOString(),
        answers: [...appState.userAnswers]
    };
    
    resultsStorage.results.push(result);
    saveResults();
    return result;
}

// Показ результатов
function showResults(percentage, timeSpent) {
    const totalQuestions = appState.currentTest.questions.length;
    const correctAnswers = appState.score;
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    
    document.getElementById('score-percent').textContent = percentage + '%';
    document.getElementById('correct-answers').textContent = correctAnswers;
    document.getElementById('total-questions').textContent = totalQuestions;
    document.getElementById('time-spent').textContent = `${minutes} мин ${seconds} сек`;
    document.getElementById('test-title').textContent = appState.currentTest.title;
    
    const scoreCircle = document.getElementById('score-circle');
    scoreCircle.style.setProperty('--progress', percentage + '%');
    
    const resultText = document.getElementById('result-text');
    let message = '';
    
    // Разные сообщения для разных режимов
    if (appState.currentTest.mode === 'tutorial') {
        if (percentage >= 80) {
            message = 'Отлично! Вы отлично усвоили материал! 🎓';
        } else if (percentage >= 60) {
            message = 'Хорошо! Вы хорошо разобрались в теме! 👍';
        } else {
            message = 'Повторите материал и попробуйте снова! 📚';
        }
        message += ' Этот тест был в обучающем режиме.';
    } else {
        const scoring = appState.currentTest.scoring || { excellent: 80, good: 60, satisfactory: 40 };
        
        if (percentage >= scoring.excellent) {
            message = 'Отлично! Вы настоящий эксперт! 🏆';
        } else if (percentage >= scoring.good) {
            message = 'Хороший результат! Вы хорошо знаете материал. 👍';
        } else if (percentage >= scoring.satisfactory) {
            message = 'Неплохо, но есть что повторить. 📚';
        } else {
            message = 'Вам стоит изучить материал внимательнее. 💪';
        }
    }
    
    resultText.textContent = message;
    showScreen('result');
}

// Админ-панель
function showAdminPanel() {
    const password = prompt('Введите пароль администратора:');
    if (password === resultsStorage.adminKey) {
        appState.isAdmin = true;
        showScreen('admin');
        updateAdminStats();
    } else {
        alert('Неверный пароль!');
    }
}

// Обновление статистики в админке
function updateAdminStats() {
    const results = resultsStorage.results;
    
    // Общая статистика
    document.getElementById('total-tests').textContent = results.length;
    
    const averagePercentage = results.length > 0 ? 
        Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length) : 0;
    document.getElementById('average-score').textContent = averagePercentage + '%';
    
    // Статистика по тестам
    const testStats = {};
    const allTests = testLoader.getAllTestsForAdmin();
    allTests.forEach(test => {
        testStats[test.id] = {
            title: test.title,
            count: 0,
            totalPercentage: 0
        };
    });
    
    results.forEach(result => {
        if (testStats[result.testId]) {
            testStats[result.testId].count++;
            testStats[result.testId].totalPercentage += result.percentage;
        }
    });
    
    const testStatsContainer = document.getElementById('test-stats');
    testStatsContainer.innerHTML = '';
    
    Object.values(testStats).forEach(stat => {
        if (stat.count > 0) {
            const avg = Math.round(stat.totalPercentage / stat.count);
            const statElement = document.createElement('div');
            statElement.className = 'test-stat-item';
            statElement.innerHTML = `
                <div class="test-stat-title">${stat.title}</div>
                <div class="test-stat-numbers">
                    <span class="test-stat-count">${stat.count} тестов</span>
                    <span class="test-stat-avg">Средний: ${avg}%</span>
                </div>
            `;
            testStatsContainer.appendChild(statElement);
        }
    });
    
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
            <div class="result-test">${result.testTitle}</div>
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
            <div class="result-test">${result.testTitle}</div>
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
    showScreen('test-selection');
}

// Поделиться результатом
function shareResult() {
    const percentage = Math.round((appState.score / appState.currentTest.questions.length) * 100);
    
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShowWallPostBox', {
            message: `Я прошел тест "${appState.currentTest.title}" и набрал ${percentage}%! Проверь свои знания тоже!`
        }).catch(error => {
            alert(`Мой результат в тесте "${appState.currentTest.title}": ${percentage}% правильных ответов!`);
        });
    } else {
        alert(`Мой результат в тесте "${appState.currentTest.title}": ${percentage}% правильных ответов!`);
    }
}

// Показ экранов
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    document.getElementById(screenName + '-screen').classList.add('active');
    appState.currentScreen = screenName;
    
    // Обновляем информацию на экранах
    if (screenName === 'welcome' && appState.currentTest) {
        document.getElementById('welcome-test-title').textContent = appState.currentTest.title;
        document.getElementById('welcome-test-description').textContent = appState.currentTest.description;
        document.getElementById('welcome-test-difficulty').textContent = appState.currentTest.difficulty || 'Стандартный';
        document.getElementById('welcome-test-duration').textContent = appState.currentTest.duration || 'Не указано';
        document.getElementById('welcome-test-questions').textContent = appState.currentTest.questions ? appState.currentTest.questions.length : 0;
        document.getElementById('welcome-test-author').textContent = appState.currentTest.author || 'Неизвестен';
    }
    
    // Если показываем админку, обновляем статистику
    if (screenName === 'admin') {
        updateAdminStats();
    }
    
    // Если показываем выбор теста, заполняем список
    if (screenName === 'test-selection') {
        fillTestSelection();
    }
}

// Функции для управления тестами (только для администратора)

// Показать панель управления тестами
function showTestManagement() {
    if (!appState.isAdmin) {
        alert('Только администратор может управлять тестами!');
        return;
    }
    
    showScreen('test-management');
    updateTestManagement();
}

// Обновление панели управления тестами
function updateTestManagement() {
    const customTests = testLoader.getCustomTests();
    const container = document.getElementById('custom-tests-list');
    
    container.innerHTML = '';
    
    if (customTests.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет загруженных тестов</div>';
        return;
    }
    
    customTests.forEach(test => {
        const testElement = document.createElement('div');
        testElement.className = 'test-management-item';
        testElement.innerHTML = `
            <div class="test-management-info">
                <h4>${test.title}</h4>
                <p>${test.description || 'Без описания'}</p>
                <div class="test-management-meta">
                    <span>Вопросов: ${test.questions.length}</span>
                    <span>Режим: ${test.mode === 'tutorial' ? 'Обучающий' : 'Экзамен'}</span>
                    <span>Загружен: ${new Date(test.loadDate).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="test-management-actions">
                <button class="vk-button small" onclick="previewTest('${test.id}')">👁️ Просмотр</button>
                <button class="vk-button small secondary" onclick="editTest('${test.id}')">✏️ Редактировать</button>
                <button class="vk-button small danger" onclick="deleteTest('${test.id}')">🗑️ Удалить</button>
            </div>
        `;
        container.appendChild(testElement);
    });
}

// Загрузка теста из JSON
function uploadTest() {
    if (!appState.isAdmin) {
        alert('Только администратор может загружать тесты!');
        return;
    }
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const testData = JSON.parse(e.target.result);
                
                // Валидация базовой структуры
                if (!testData.title || !testData.questions || !Array.isArray(testData.questions)) {
                    throw new Error('Неверный формат теста');
                }
                
                // Добавляем тест
                const test = testLoader.addCustomTest(testData);
                alert(`Тест "${test.title}" успешно загружен!`);
                updateTestManagement();
                
            } catch (error) {
                alert('Ошибка загрузки теста: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    fileInput.click();
}

// Загрузка теста по URL
function uploadTestFromUrl() {
    if (!appState.isAdmin) {
        alert('Только администратор может загружать тесты!');
        return;
    }
    
    const url = prompt('Введите URL JSON файла с тестом:');
    if (!url) return;
    
    showScreen('loading');
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки: ' + response.status);
            return response.json();
        })
        .then(testData => {
            // Валидация базовой структуры
            if (!testData.title || !testData.questions || !Array.isArray(testData.questions)) {
                throw new Error('Неверный формат теста');
            }
            
            // Добавляем тест
            const test = testLoader.addCustomTest(testData);
            alert(`Тест "${test.title}" успешно загружен!`);
            showScreen('test-management');
            updateTestManagement();
        })
        .catch(error => {
            alert('Ошибка загрузки теста: ' + error.message);
            showScreen('test-management');
        });
}

// Создание нового теста
function createNewTest() {
    if (!appState.isAdmin) {
        alert('Только администратор может создавать тесты!');
        return;
    }
    
    const title = prompt('Введите название теста:');
    if (!title) return;
    
    const description = prompt('Введите описание теста:') || '';
    
    const mode = confirm('Сделать тест обучающим (с подсказками)?') ? 'tutorial' : 'exam';
    
    const newTest = {
        title: title,
        description: description,
        mode: mode,
        questions: [],
        scoring: {
            excellent: 80,
            good: 60,
            satisfactory: 40
        }
    };
    
    const test = testLoader.addCustomTest(newTest);
    editTest(test.id);
}

// Редактирование теста
function editTest(testId) {
    if (!appState.isAdmin) {
        alert('Только администратор может редактировать тесты!');
        return;
    }
    
    const test = testLoader.customTests.get(testId);
    if (!test) {
        alert('Тест не найден');
        return;
    }
    
    // В реальном приложении здесь будет полноценный редактор тестов
    const newTitle = prompt('Новое название теста:', test.title);
    if (newTitle) test.title = newTitle;
    
    const newDescription = prompt('Новое описание теста:', test.description || '');
    test.description = newDescription;
    
    const newMode = confirm('Сделать тест обучающим (с подсказками)?') ? 'tutorial' : 'exam';
    test.mode = newMode;
    
    testLoader.saveCustomTestsToStorage();
    updateTestManagement();
    alert('Тест обновлен!');
}

// Просмотр теста
function previewTest(testId) {
    const test = testLoader.customTests.get(testId);
    if (!test) {
        alert('Тест не найден');
        return;
    }
    
    let previewText = `Название: ${test.title}\n`;
    previewText += `Описание: ${test.description || 'нет'}\n`;
    previewText += `Режим: ${test.mode === 'tutorial' ? 'Обучающий' : 'Экзамен'}\n`;
    previewText += `Вопросов: ${test.questions.length}\n\n`;
    
    test.questions.forEach((question, index) => {
        previewText += `Вопрос ${index + 1}: ${question.question}\n`;
        question.answers.forEach((answer, ansIndex) => {
            previewText += `  ${ansIndex + 1}. ${answer}\n`;
        });
        previewText += `Правильный ответ: ${Array.isArray(question.correct) ? question.correct.join(', ') : question.correct}\n`;
        if (question.explanation) {
            previewText += `Объяснение: ${question.explanation}\n`;
        }
        previewText += '\n';
    });
    
    alert(previewText);
}

// Удаление теста (только для администратора)
function deleteTest(testId) {
    if (!appState.isAdmin) {
        alert('Только администратор может удалять тесты!');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этот тест?')) return;
    
    if (testLoader.removeCustomTest(testId)) {
        alert('Тест удален!');
        updateTestManagement();
    } else {
        alert('Ошибка удаления теста');
    }
}
