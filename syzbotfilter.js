// ==UserScript==
// @name         Syzkaller Upstream Blacklist Filter (Optimized + Enter Key)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Filter Syzkaller upstream bug list by blacklist keywords, hide rows in batches, with Enter key support
// @match        https://syzkaller.appspot.com/upstream*
// @exclude      https://syzkaller.appspot.com/upstream/fixed/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // -------------------------------
    // 1. LocalStorage Key & Initial
    // -------------------------------
    const STORAGE_KEY = 'syzkaller_blacklist_keywords';
    let blacklist = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    // -------------------------------
    // 2. Debounce 工具函数
    // -------------------------------
    function debounce(func, delay) {
        let timer = null;
        return function(...args) {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // -------------------------------
    // 3. Loading 提示
    // -------------------------------
    const loadingIndicator = document.createElement('div');
    loadingIndicator.innerText = 'Filtering bugs...';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '10px';
    loadingIndicator.style.right = '10px';
    loadingIndicator.style.backgroundColor = '#000';
    loadingIndicator.style.color = '#fff';
    loadingIndicator.style.padding = '6px 10px';
    loadingIndicator.style.borderRadius = '4px';
    loadingIndicator.style.zIndex = '9999';
    loadingIndicator.style.display = 'none';
    document.body.appendChild(loadingIndicator);

    function showLoading() {
        loadingIndicator.style.display = 'block';
    }
    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }

    // -------------------------------
    // 4. 分批过滤函数
    // -------------------------------
    function filterBugs(blacklistArr) {
        // 显示loading
        showLoading();

        // 收集所有 <tbody> 里面的 <tr>
        const tableBodies = document.getElementsByTagName('tbody');
        if (!tableBodies || tableBodies.length === 0) {
            hideLoading();
            return;
        }
        let trList = [];
        for (let i = 0; i < tableBodies.length; i++) {
            const rows = tableBodies[i].getElementsByTagName('tr');
            if (rows) {
                trList.push(...Array.from(rows));
            }
        }

        // 分批大小
        const batchSize = 100;
        let index = 0;

        function processBatch() {
            const end = Math.min(index + batchSize, trList.length);
            for (let i = index; i < end; i++) {
                const tr = trList[i];
                const titleCell = tr.querySelector('td.title');
                if (!titleCell) continue;

                const titleLink = titleCell.querySelector('a');
                if (!titleLink) continue;

                const bugTitle = titleLink.innerText.toLowerCase();

                // 判断是否匹配黑名单
                const matched = blacklistArr.some(keyword =>
                    bugTitle.includes(keyword.toLowerCase())
                );

                // 如果匹配则隐藏，否则显示
                tr.style.display = matched ? 'none' : '';
            }
            index = end;

            // 如果还没处理完，继续处理下一批
            if (index < trList.length) {
                setTimeout(processBatch, 0);
            } else {
                // 全部处理结束
                hideLoading();
            }
        }

        // 启动分批处理
        processBatch();
    }

    // 用防抖包装一下过滤函数，避免频繁操作导致卡顿
    const debouncedFilterBugs = debounce(() => filterBugs(blacklist), 200);

    // -------------------------------
    // 5. 创建管理界面（UI）
    // -------------------------------
    // 容器面板
    const panel = document.createElement('div');
    panel.style.backgroundColor = '#f8f8f8';
    panel.style.padding = '10px';
    panel.style.margin = '10px';
    panel.style.border = '1px solid #ccc';
    panel.style.borderRadius = '5px';
    panel.style.fontFamily = 'sans-serif';

    // 标题
    const title = document.createElement('h3');
    title.innerText = 'Blacklist Manager (Dynamic Filter)';
    title.style.marginTop = '0';
    title.style.marginBottom = '10px';
    panel.appendChild(title);

    // 关键词列表容器
    const listContainer = document.createElement('div');
    listContainer.style.display = 'flex';
    listContainer.style.flexWrap = 'wrap';
    listContainer.style.gap = '8px';
    panel.appendChild(listContainer);

    // 渲染黑名单显示
    function renderBlacklistItems() {
        listContainer.innerHTML = ''; // 清空容器

        blacklist.forEach((keyword, index) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.backgroundColor = '#eee';
            item.style.padding = '4px 8px';
            item.style.borderRadius = '4px';

            const label = document.createElement('span');
            label.innerText = keyword;
            label.style.marginRight = '6px';
            item.appendChild(label);

            const removeBtn = document.createElement('button');
            removeBtn.innerText = 'x';
            removeBtn.style.backgroundColor = '#e74c3c';
            removeBtn.style.color = '#fff';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '20px';
            removeBtn.style.height = '20px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.lineHeight = '1';
            removeBtn.style.padding = '0';
            removeBtn.title = 'Remove keyword';

            removeBtn.addEventListener('click', () => {
                // 从黑名单中删除
                blacklist.splice(index, 1);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(blacklist));
                // 重新渲染 & 过滤
                renderBlacklistItems();
                debouncedFilterBugs();
            });

            item.appendChild(removeBtn);
            listContainer.appendChild(item);
        });
    }

    // 初始化渲染
    renderBlacklistItems();

    // 新增关键词的UI
    const inputWrapper = document.createElement('div');
    inputWrapper.style.display = 'flex';
    inputWrapper.style.marginTop = '10px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add new keyword...';
    input.style.flex = '1';
    input.style.padding = '6px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';

    // 监听输入框Enter键
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addBtn.click();
        }
    });

    inputWrapper.appendChild(input);

    const addBtn = document.createElement('button');
    addBtn.innerText = 'Add';
    addBtn.style.marginLeft = '10px';
    addBtn.style.padding = '6px 12px';
    addBtn.style.border = 'none';
    addBtn.style.backgroundColor = '#4CAF50';
    addBtn.style.color = '#fff';
    addBtn.style.cursor = 'pointer';
    addBtn.style.borderRadius = '4px';

    // 点击添加
    addBtn.addEventListener('click', () => {
        const newKeyword = input.value.trim();
        if (newKeyword) {
            // 如果需要去重，可在这里判断
            // if (!blacklist.includes(newKeyword)) { ... }

            blacklist.push(newKeyword);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(blacklist));
            // 重新渲染 & 过滤
            renderBlacklistItems();
            debouncedFilterBugs();
            input.value = '';
        }
    });

    inputWrapper.appendChild(addBtn);
    panel.appendChild(inputWrapper);

    // 将面板插入到body最前面
    document.body.insertBefore(panel, document.body.firstChild);

    // -------------------------------
    // 6. 页面加载完成后，初次过滤
    // -------------------------------
    filterBugs(blacklist);
})();
