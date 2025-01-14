// ==UserScript==
// @name         Yang ID Replacer v2.0
// @namespace    http://tampermonkey.net/
// @version      2024-12-29
// @description  Заменяет ID на логины, используя данные с фалового хранилища Вики, с хранением в LocalCache
// @author       You
// @match        https://yang.yandex-team.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      wiki.yandex-team.ru
// ==/UserScript==

(function() {
    'use strict';

    const DATA_URL = "https://wiki.yandex-team.ru/qualitymarking/rukovoditeljam/yangidreplacer/id-login-pairs/.files/data.json"; // URL к JSON-файлу
    const CACHE_KEY = "idToLoginCache"; // Ключ для хранения данных в кэше
    const CACHE_EXPIRATION = 60 * 60 * 1000; // Срок годности кэша: 60 минут

    // Где применять
    const pageConfig = [
        { urlPattern: /\/requester\/worker\//, selector: ".profile-header__user-name" },
        { urlPattern: /\/.*/, selector: "span" }
    ];

    const currentPage = pageConfig.find(config => config.urlPattern.test(window.location.pathname));
    if (!currentPage) return;

    // Функция для загрузки данных из локал кэша или с вики
    function loadData(callback) {
        const now = Date.now();
        const cachedData = GM_getValue(CACHE_KEY, null);

        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            if (now - timestamp < CACHE_EXPIRATION) {
                callback(data);
                return;
            }
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: DATA_URL,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    GM_setValue(CACHE_KEY, JSON.stringify({ data, timestamp: now }));
                    callback(data);
                } catch (error) {
                    console.error("Ошибка при обработке данных с сервера", error);
                }
            },
            onerror: function() {
                console.error("Не удалось загрузить данные с сервера");
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

    //DOM
    const observer = new MutationObserver(() => {
        loadData(replaceIdWithName);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
