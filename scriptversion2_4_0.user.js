// ==UserScript==
// @name         Yang ID Replacer
// @namespace    http://tampermonkey.net/
// @version      2.4.0
// @description  Заменяет ID на логины, используя данные с файлового хранилища Вики, с хранением в LocalCache
// @author       Beluhinevgeny
// @match        https://yang.yandex-team.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      wiki.yandex-team.ru
// ==/UserScript==

(function() {
    'use strict';

    const BASE_URL = "https://wiki.yandex-team.ru/qualitymarking/rukovoditeljam/yangidreplacer/id-login-pairs/.files/data-";
    const CACHE_KEY = "idToLoginCache"; //Ключ для хранения пар "айди-логин"
    const VERSION_KEY = "dataVersion"; // Ключ для хранения версии файла
    const CACHE_EXPIRATION = 60 * 60 * 1000; // Срок годности кэша: 60 минут

    const pageConfig = [
        { urlPattern: /\/requester\/worker\//, selector: ".profile-header__user-name" },
        { urlPattern: /\/.*/, selector: "span" }
    ];

    const currentPage = pageConfig.find(config => config.urlPattern.test(window.location.pathname));
    if (!currentPage) return;

    // Функция проверки наличия более новой версии
    function checkForNewVersion(version, lastData, now) {
        const fileUrl = `${BASE_URL}${version}.json`;

        GM_xmlhttpRequest({
            method: "GET",
            url: fileUrl,
            onload: function(response) {
                try {
                    const newData = JSON.parse(response.responseText);
                    GM_setValue(CACHE_KEY, JSON.stringify({ data: newData, timestamp: now }));
                    GM_setValue(VERSION_KEY, version); // Обновляем версию

                    // Рекурсивно проверяем следующую версию
                    checkForNewVersion(version + 1, newData, now);
                } catch (error) {
                    console.error("Ошибка при обработке данных следующей версии", error);
                }
            },
            onerror: function() {
                console.log(`Версия ${version} не найдена. Остаёмся на версии ${version - 1}.`);
                GM_setValue(CACHE_KEY, JSON.stringify({ data: lastData, timestamp: now }));
            }
        });
    }

    // Функция загрузки данных
    function loadData(callback) {
        const now = Date.now();
        const cachedData = GM_getValue(CACHE_KEY, null);
        const currentVersion = GM_getValue(VERSION_KEY, 1); // Стартовая версия 1

        if (cachedData && now - JSON.parse(cachedData).timestamp < CACHE_EXPIRATION) {
            callback(JSON.parse(cachedData).data);
            return;
        }

        // Загружаем текущую версию
        const fileUrl = `${BASE_URL}${currentVersion}.json`;
        GM_xmlhttpRequest({
            method: "GET",
            url: fileUrl,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: now }));
                    GM_setValue(VERSION_KEY, currentVersion); // Устанавливаем текущую версию

                    // Проверяем наличие следующей версии
                    checkForNewVersion(currentVersion + 1, data, now);
                    callback(data);
                } catch (error) {
                    console.error("Ошибка при обработке данных с сервера", error);
                }
            },
            onerror: function() {
                console.error("Не удалось загрузить данные текущей версии");
            }
        });
    }

    // Замена ID на логины
    function replaceIdWithName(mapping) {
        const elements = document.querySelectorAll(currentPage.selector);
        elements.forEach(element => {
            const id = element.textContent.trim();
            if (mapping[id]) {
                element.textContent = mapping[id];
            }
        });
    }

    // Инициализация
    loadData(replaceIdWithName);

    // DOM наблюдатель
    const observer = new MutationObserver(() => {
        loadData(replaceIdWithName);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
