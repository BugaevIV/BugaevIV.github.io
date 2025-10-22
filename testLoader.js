// testLoader.js - Система загрузки тестов с GitHub
class TestLoader {
    constructor() {
        this.baseUrl = 'https://raw.githubusercontent.com/BugaevIV/FencingTest/main/';
        this.availableTests = [];
        this.loadedTests = new Map();
        this.customTests = new Map();
    }

    // Инициализация загрузчика
    async init() {
        // Загружаем кастомные тесты из localStorage
        this.loadCustomTestsFromStorage();
        
        // Сканируем доступные тесты на GitHub
        await this.scanAvailableTests();
        
        // Если нет тестов на GitHub, используем встроенные
        if (this.availableTests.length === 0) {
            await this.loadBuiltInTests();
        }
    }

    // Загрузка кастомных тестов из localStorage
    loadCustomTestsFromStorage() {
        try {
            const saved = localStorage.getItem('fencingCustomTests');
            if (saved) {
                const customTests = JSON.parse(saved);
                customTests.forEach(test => {
                    this.customTests.set(test.id, test);
                    this.availableTests.push({
                        id: test.id,
                        filename: `custom_${test.id}.json`,
                        title: test.title,
                        description: test.description,
                        isCustom: true,
                        loadedFrom: 'localStorage'
                    });
                });
            }
        } catch (error) {
            console.error('Ошибка загрузки кастомных тестов:', error);
        }
    }

    // Сохранение кастомных тестов в localStorage
    saveCustomTestsToStorage() {
        try {
            const customTestsArray = Array.from(this.customTests.values());
            localStorage.setItem('fencingCustomTests', JSON.stringify(customTestsArray));
        } catch (error) {
            console.error('Ошибка сохранения кастомных тестов:', error);
        }
    }

    // Сканирование доступных тестов
    async scanAvailableTests() {
        try {
            // Пробуем загрузить индекс тестов
            const response = await fetch(`${this.baseUrl}tests_index.json`);
            if (response.ok) {
                const index = await response.json();
                index.tests.forEach(test => {
                    // Добавляем только если тест еще не добавлен
                    if (!this.availableTests.find(t => t.id === test.id)) {
                        this.availableTests.push({
                            ...test,
                            isRemote: true
                        });
                    }
                });
            }
        } catch (error) {
            console.log('Индекс тестов не найден, пробуем ручное сканирование');
            await this.scanManualTests();
        }
    }

    // Ручное сканирование тестов
    async scanManualTests() {
        const testFiles = ['test1.json', 'test2.json', 'test3.json', 'questions.json', 'test_main.json', 'test_beginner.json', 'test_safety.json'];
        
        for (const file of testFiles) {
            try {
                const response = await fetch(`${this.baseUrl}${file}`);
                if (response.ok) {
                    const testId = file.replace('.json', '');
                    // Добавляем только если тест еще не добавлен
                    if (!this.availableTests.find(t => t.id === testId)) {
                        this.availableTests.push({
                            id: testId,
                            filename: file,
                            title: `Тест ${file}`,
                            description: `Автоматически загруженный тест из ${file}`,
                            isRemote: true
                        });
                    }
                }
            } catch (error) {
                console.log(`Файл ${file} не найден`);
            }
        }
    }

    // Загрузка встроенных тестов (резервные)
    async loadBuiltInTests() {
        const builtInTests = [
            {
                id: 'basic_safety',
                filename: 'builtin_basic_safety.json',
                title: 'Базовый тест по технике безопасности',
                description: 'Основные правила безопасности в арт-фехтовании',
                difficulty: 'Обязательный',
                duration: '5-7 минут',
                totalQuestions: 8,
                isBuiltIn: true,
                questions: [
                    {
                        id: 1,
                        question: "На каком минимальном расстоянии от тела партнера должно быть остановлено оружие при атаке?",
                        type: "single",
                        answers: [
                            "1-5 см.",
                            "15-20 см.",
                            "30-40 см.",
                            "50 см."
                        ],
                        correct: 1,
                        explanation: "Правила безопасности требуют останавливать оружие на расстоянии 15-20 см от тела партнера."
                    },
                    {
                        id: 2,
                        question: "Куда запрещено проводить обезоруживание оружия?",
                        type: "single",
                        answers: [
                            "В сторону кулис.",
                            "В сторону зрительного зала.",
                            "Оба варианта верны.",
                            "Обезоруживание разрешено в любую сторону."
                        ],
                        correct: 2,
                        explanation: "Обезоруживание в сторону зрительного зала и кулис запрещено для обеспечения безопасности."
                    }
                ],
                scoring: {
                    excellent: 7,
                    good: 5,
                    satisfactory: 4
                }
            }
        ];

        builtInTests.forEach(test => {
            this.availableTests.push({
                id: test.id,
                filename: test.filename,
                title: test.title,
                description: test.description,
                difficulty: test.difficulty,
                duration: test.duration,
                totalQuestions: test.totalQuestions,
                isBuiltIn: true
            });
            this.loadedTests.set(test.id, test);
        });
    }

    // Загрузка теста по ID
    async loadTest(testId) {
        // Если тест уже загружен, возвращаем его
        if (this.loadedTests.has(testId)) {
            return this.loadedTests.get(testId);
        }

        // Если это кастомный тест
        if (this.customTests.has(testId)) {
            const test = this.customTests.get(testId);
            this.loadedTests.set(testId, test);
            return test;
        }

        try {
            // Ищем информацию о тесте
            const testInfo = this.availableTests.find(t => t.id === testId);
            if (!testInfo) {
                throw new Error(`Тест ${testId} не найден`);
            }

            // Загружаем тест
            const response = await fetch(`${this.baseUrl}${testInfo.filename}`);
            if (!response.ok) {
                throw new Error(`Ошибка загрузки теста: ${response.status}`);
            }

            const testData = await response.json();
            
            // Добавляем мета-информацию
            testData.id = testId;
            testData.filename = testInfo.filename;
            testData.loadedFrom = this.baseUrl;
            testData.loadDate = new Date().toISOString();
            testData.isRemote = true;

            // Сохраняем в кеш
            this.loadedTests.set(testId, testData);
            
            return testData;
        } catch (error) {
            console.error('Ошибка загрузки теста:', error);
            
            // Если тест встроенный, возвращаем его
            if (testInfo && testInfo.isBuiltIn) {
                return this.loadedTests.get(testId);
            }
            
            throw error;
        }
    }

    // Добавление кастомного теста (только для администратора)
    addCustomTest(testData, testId = null) {
        const id = testId || `custom_${Date.now()}`;
        
        // Валидация теста
        if (!this.validateTest(testData)) {
            throw new Error('Неверный формат теста');
        }

        // Добавляем мета-информацию
        testData.id = id;
        testData.loadDate = new Date().toISOString();
        testData.isCustom = true;

        // Сохраняем в кастомные тесты
        this.customTests.set(id, testData);
        
        // Добавляем в список доступных
        if (!this.availableTests.find(t => t.id === id)) {
            this.availableTests.push({
                id: id,
                filename: `custom_${id}.json`,
                title: testData.title || 'Пользовательский тест',
                description: testData.description || 'Загруженный тест',
                isCustom: true
            });
        }

        // Сохраняем в localStorage
        this.saveCustomTestsToStorage();

        return testData;
    }

    // Валидация теста
    validateTest(testData) {
        return testData && 
               testData.title && 
               testData.questions && 
               Array.isArray(testData.questions) && 
               testData.questions.length > 0;
    }

    // Удаление кастомного теста (только для администратора)
    removeCustomTest(testId) {
        if (this.customTests.has(testId)) {
            this.customTests.delete(testId);
            this.availableTests = this.availableTests.filter(t => t.id !== testId);
            this.loadedTests.delete(testId);
            this.saveCustomTestsToStorage();
            return true;
        }
        return false;
    }

    // Получение списка доступных тестов
    getAvailableTests() {
        return this.availableTests;
    }

    // Получение кастомных тестов
    getCustomTests() {
        return Array.from(this.customTests.values());
    }

    // Очистка кеша
    clearCache() {
        this.loadedTests.clear();
    }

    // Обновление списка тестов с GitHub
    async refreshTests() {
        this.clearCache();
        const remoteTests = this.availableTests.filter(t => t.isRemote || t.isBuiltIn);
        this.availableTests = [...remoteTests, ...this.getCustomTests().map(test => ({
            id: test.id,
            filename: `custom_${test.id}.json`,
            title: test.title,
            description: test.description,
            isCustom: true
        }))];
        
        await this.scanAvailableTests();
    }
}

// Создаем глобальный экземпляр загрузчика
window.testLoader = new TestLoader();
