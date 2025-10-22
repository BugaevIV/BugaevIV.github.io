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

// Функции для администратора (добавляем в app.js)

// Показать панель управления тестами
function showTestManagement() {
    const password = prompt('Введите пароль администратора:');
    if (password !== resultsStorage.adminKey) {
        alert('Неверный пароль!');
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
    const title = prompt('Введите название теста:');
    if (!title) return;
    
    const description = prompt('Введите описание теста:') || '';
    
    const newTest = {
        title: title,
        description: description,
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
    previewText += `Вопросов: ${test.questions.length}\n\n`;
    
    test.questions.forEach((question, index) => {
        previewText += `Вопрос ${index + 1}: ${question.question}\n`;
        question.answers.forEach((answer, ansIndex) => {
            previewText += `  ${ansIndex + 1}. ${answer}\n`;
        });
        previewText += `Правильный ответ: ${Array.isArray(question.correct) ? question.correct.join(', ') : question.correct}\n\n`;
    });
    
    alert(previewText);
}

// Удаление теста
function deleteTest(testId) {
    if (!confirm('Вы уверены, что хотите удалить этот тест?')) return;
    
    if (testLoader.removeCustomTest(testId)) {
        alert('Тест удален!');
        updateTestManagement();
    } else {
        alert('Ошибка удаления теста');
    }
}

// Экспорт теста
function exportTest(testId) {
    const test = testLoader.customTests.get(testId);
    if (!test) {
        alert('Тест не найден');
        return;
    }
    
    const data = JSON.stringify(test, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_${test.title}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
}

