// Состояние приложения
let appState = {
    currentScreen: 'welcome',
    currentQuestion: 0,
    userAnswers: [],
    score: 0,
    startTime: null,
    endTime: null
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация VK Bridge
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppInit');
    }
    
    showScreen('welcome');
});

// Показ экранов
function showScreen(screenName) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    document.getElementById(screenName + '-screen').classList.add('active');
    appState.currentScreen = screenName;
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
    
    // Обновляем прогресс
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = 
        `${appState.currentQuestion + 1}/${testQuestions.length}`;
    
    // Отображаем вопрос
    document.getElementById('question-text').textContent = question.question;
    
    // Создаем варианты ответов
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
    
    // Сбрасываем кнопку "Далее"
    document.getElementById('next-button').disabled = true;
}

// Выбор ответа
function selectAnswer(answerIndex) {
    const question = testQuestions[appState.currentQuestion];
    const answerOptions = document.querySelectorAll('.answer-option');
    
    // Сбрасываем предыдущие выборы
    answerOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // Отмечаем выбранный ответ
    answerOptions[answerIndex].classList.add('selected');
    
    // Сохраняем ответ пользователя
    appState.userAnswers[appState.currentQuestion] = [answerIndex];
    
    // Активируем кнопку "Далее"
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
    showResults();
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
            // Для множественного выбора - проверяем полное совпадение
            const userSorted = [...userAnswer].sort().join('');
            const correctSorted = [...question.correct].sort().join('');
            
            if (userSorted === correctSorted) {
                appState.score++;
            }
        }
    });
}

// Показ результатов
function showResults() {
    const totalQuestions = testQuestions.length;
    const correctAnswers = appState.score;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    const timeSpent = Math.round((appState.endTime - appState.startTime) / 1000 / 60);
    
    // Обновляем UI результатов
    document.getElementById('score-percent').textContent = percentage + '%';
    document.getElementById('correct-answers').textContent = correctAnswers;
    document.getElementById('total-questions').textContent = totalQuestions;
    
    // Устанавливаем прогресс круга
    const scoreCircle = document.getElementById('score-circle');
    scoreCircle.style.setProperty('--progress', percentage + '%');
    
    // Текстовый результат
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
    
    // Сохраняем результат через VK Bridge
    saveResult(percentage);
}

// Сохранение результата
function saveResult(percentage) {
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppStorageSet', {
            key: 'last_test_score',
            value: percentage.toString()
        }).catch(error => {
            console.log('Не удалось сохранить результат:', error);
        });
    }
}

// Поделиться результатом
function shareResult() {
    const percentage = Math.round((appState.score / testQuestions.length) * 100);
    
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppShowWallPostBox', {
            message: `Я прошел тест по арт-фехтованию и набрал ${percentage}%! Проверь свои знания тоже!`
        }).catch(error => {
            alert('Поделиться результатом: ' + percentage + '% правильных ответов!');
        });
    } else {
        alert(`Мой результат: ${percentage}% правильных ответов!`);
    }
}

// Перезапуск теста
function restartTest() {
    showScreen('welcome');
}