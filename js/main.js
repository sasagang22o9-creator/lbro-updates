var csInterface = new CSInterface();
        
function executeHost(functionName, arg) {
    var cmd = functionName + "()";
    if (arg !== undefined) {
        if (typeof arg === 'object') {
            var safeJson = JSON.stringify(arg)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '\\"');
            cmd = functionName + "('" + safeJson + "')";
        } else if (typeof arg === 'string') {
            cmd = functionName + "('" + arg.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')";
        } else {
            cmd = functionName + "(" + arg + ")";
        }
    }
    csInterface.evalScript(cmd, function(res) {
        if (res && res.indexOf("Error") === 0) {
            alert(res);
        }
    });
}

function get3D() {
    return document.getElementById('cbForce3D').checked;
}

function openURL(url) {
    if (window.cep && window.cep.util) {
        window.cep.util.openURLInDefaultBrowser(url);
    }
}

function applyShake() {
    var args = {
        int: document.getElementById('wigInt').value,
        fx: document.getElementById('wigFreqX').value,
        fy: document.getElementById('wigFreqY').value,
        mx: document.getElementById('wigMultX').value,
        my: document.getElementById('wigMultY').value,
        rand: document.getElementById('cbRandom').checked
    };
    executeHost('applyWiggle', args);
}

// ------------------------------------
// TABS LOGIC
// ------------------------------------
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-target')).classList.add('active');
    });
});

// ------------------------------------
// DYNAMIC PRESETS
// ------------------------------------
function loadPresets() {
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var cmd = "getPresets('" + extPath + "')";
    csInterface.evalScript(cmd, function(res) {
        if (!res || res === "NONE") {
            document.getElementById('presets-grid').innerHTML = "<p style='color:#aaa; font-size: 11px; text-align:center; grid-column: 1 / -1;'>Пресеты не найдены</p>";
            return;
        }
        var files = res.split(",");
        var validFiles = [];
        files.forEach(function(f) {
            if (f.trim() !== "") validFiles.push(f.trim());
        });

        // Получаем сохраненный порядок из памяти
        var savedOrder = [];
        try { 
            var stored = localStorage.getItem('LBRO_PresetsOrder');
            if (stored) savedOrder = JSON.parse(stored);
        } catch(e) {}

        // Сортируем
        validFiles.sort(function(a, b) {
            var idxA = savedOrder.indexOf(a);
            var idxB = savedOrder.indexOf(b);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1; // новые в конец
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

        var html = "";
        validFiles.forEach(function(f) {
            var btnName = f.toUpperCase().replace(/\.FFX$/i, '');
            var args = { path: extPath, fName: f };
            html += `<button class="btn preset-btn" data-file="${f}" draggable="true" onclick='if(!this.classList.contains("dragged")) executeHost("applyPresetObj", ${JSON.stringify(args)})' title="${btnName}">${btnName}</button>`;
        });
        
        var grid = document.getElementById('presets-grid');
        grid.innerHTML = html;

        // --- ЛОГИКА DRAG AND DROP ---
        var draggedItem = null;
        var buttons = grid.querySelectorAll('.preset-btn');
        
        buttons.forEach(function(btn) {
            btn.addEventListener('dragstart', function(e) {
                draggedItem = this;
                this.classList.add('dragged'); // Флаг, чтобы клик не срабатывал сразу после отпускания
                setTimeout(function() { btn.classList.add('dragging'); }, 0);
            });
            btn.addEventListener('dragend', function() {
                btn.classList.remove('dragging');
                draggedItem = null;
                setTimeout(function() { btn.classList.remove('dragged'); }, 50); // Убираем блокировку клика с задержкой

                // Сохраняем новый порядок
                var newOrder = [];
                var currentBtns = grid.querySelectorAll('.preset-btn');
                currentBtns.forEach(function(b) {
                    newOrder.push(b.getAttribute('data-file'));
                });
                localStorage.setItem('LBRO_PresetsOrder', JSON.stringify(newOrder));
            });
        });

        // Если обработчик на грид еще не вешали
        if (!grid.hasAttribute('data-dnd-init')) {
            grid.setAttribute('data-dnd-init', 'true');
            grid.addEventListener('dragover', function(e) {
                e.preventDefault();
                var target = e.target.closest('.preset-btn');
                if (target && draggedItem && target !== draggedItem) {
                    var rect = target.getBoundingClientRect();
                    var next = (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;
                    grid.insertBefore(draggedItem, next ? target.nextSibling : target);
                }
            });
        }
    });
}

// ------------------------------------
// THEME SYNC
// ------------------------------------
function updateThemeWithAppSkinInfo(appSkinInfo) {
    if (!appSkinInfo) return;
    var panelBgColor = appSkinInfo.panelBackgroundColor.color;
    var r = Math.round(panelBgColor.red);
    var g = Math.round(panelBgColor.green);
    var b = Math.round(panelBgColor.blue);
    var rgb = `rgb(${r}, ${g}, ${b})`;
    document.body.style.backgroundColor = rgb;
}

csInterface.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, function() {
    updateThemeWithAppSkinInfo(csInterface.getHostEnvironment().appSkinInfo);
});

// ------------------------------------
// SAVED EFFECTS LOGIC (5 SLOTS)
// ------------------------------------
var MAX_SLOTS = 5;
var slots = new Array(MAX_SLOTS).fill(null); 

function loadSavedEffects() {
    var stored = localStorage.getItem('LBRO_Slots');
    if (stored) {
        try { 
            var parsed = JSON.parse(stored); 
            for(var i=0; i<MAX_SLOTS; i++) {
                if(parsed[i]) slots[i] = parsed[i];
            }
        } catch(e){}
    }
    renderSlots();
}

function saveSlots() {
    localStorage.setItem('LBRO_Slots', JSON.stringify(slots));
}

function renderSlots() {
    var container = document.getElementById('slots-container');
    container.innerHTML = "";
    
    for (let i = 0; i < MAX_SLOTS; i++) {
        var effectDiv = document.createElement('div');
        effectDiv.style.display = 'flex';
        effectDiv.style.gap = '4px';

        if (slots[i]) {
            // --- Заполненный слот: кнопка применить + кнопка удалить ---
            var applyBtn = document.createElement('button');
            applyBtn.className = "btn btn-primary";
            applyBtn.title = "Применить эффект к выделенному слою";
            applyBtn.style.flex = "1";
            applyBtn.style.textAlign = "left";
            applyBtn.innerHTML = `▶ ${slots[i].name}`;
            applyBtn.onclick = function() { applySlotEffect(i); };

            var deleteBtn = document.createElement('button');
            deleteBtn.className = "btn btn-shake";
            deleteBtn.title = "Удалить слот";
            deleteBtn.style.width = "36px";
            deleteBtn.style.flexShrink = "0";
            deleteBtn.innerHTML = "✕";
            deleteBtn.onclick = function() {
                if (confirm("Очистить слот «" + slots[i].name + "»?")) {
                    slots[i] = null;
                    saveSlots();
                    renderSlots();
                }
            };

            effectDiv.appendChild(applyBtn);
            effectDiv.appendChild(deleteBtn);
        } else {
            // --- Пустой слот: кнопка сохранения ---
            var saveBtn = document.createElement('button');
            saveBtn.className = "btn";
            saveBtn.style.flex = "1";
            saveBtn.style.border = "1px dashed rgba(255,255,255,0.35)";
            saveBtn.style.color = "#888";
            saveBtn.style.fontSize = "11px";
            saveBtn.innerHTML = `💾 &nbsp;Слот ${i+1} — выделите эффекты и нажмите`;
            saveBtn.title = "Выделите эффекты на слое и нажмите для сохранения";

            saveBtn.onclick = (function(slotIndex, btn) {
                return function() {
                    btn.innerHTML = "⏳ Захват...";
                    btn.disabled = true;

                    csInterface.evalScript("captureSelectedEffects()", function(res) {
                        btn.disabled = false;

                        if (!res || res.indexOf("Error") === 0) {
                            btn.innerHTML = `💾 &nbsp;Слот ${slotIndex+1} — выделите эффекты и нажмите`;
                            alert(res || "Ошибка захвата эффектов");
                            return;
                        }

                        var effName = prompt(
                            "Эффекты захвачены!\nВведите название для Слота " + (slotIndex+1) + ":",
                            "Эффект " + (slotIndex+1)
                        );
                        if (!effName) {
                            btn.innerHTML = `💾 &nbsp;Слот ${slotIndex+1} — выделите эффекты и нажмите`;
                            return;
                        }

                        slots[slotIndex] = { name: effName, data: res };
                        saveSlots();
                        renderSlots();
                    });
                };
            })(i, saveBtn);

            effectDiv.appendChild(saveBtn);
        }

        container.appendChild(effectDiv);
    }
}

function applySlotEffect(index) {
    if (!slots[index]) return;
    var text = slots[index].data;

    var docs = csInterface.getSystemPath(SystemPath.MY_DOCUMENTS);
    var path = docs + "/lbro_effect_" + Date.now() + ".txt";

    var result = window.cep.fs.writeFile(path, text);
    if (result.err !== 0) {
        alert("Ошибка записи временного файла. Код: " + result.err);
        return;
    }

    // Применяем через AE Scripting API — без буфера обмена
    csInterface.evalScript(
        "applyEffectsFromJSONFile('" + path.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "')",
        function(res) {
            if (res && res.indexOf("Error") === 0) {
                alert(res);
            }
        }
    );
}


// Init
window.onload = function() {
    initializeTheme();
    loadPresets();
    loadSavedEffects();
    
    // Пытаемся тихо проверить обновления (если есть интернет и настроен гитхаб)
    if (typeof checkForUpdates === 'function') {
        setTimeout(checkForUpdates, 1500); // Даем панели 1.5 секунды прогрузиться, чтобы не тормозить запуск
    }
};

// ------------------------------------
// SETTINGS & THEMES LOGIC
// ------------------------------------
function toggleSettings() {
    var overlay = document.getElementById('settings-overlay');
    if (overlay.classList.contains('visible')) {
        overlay.classList.remove('visible');
    } else {
        overlay.classList.add('visible');
    }
}

function initializeTheme() {
    var savedTheme = localStorage.getItem('LBRO_Theme') || 'theme-standard';
    setTheme(savedTheme, false);
}

function setTheme(themeName, save) {
    if (save !== false) {
        localStorage.setItem('LBRO_Theme', themeName);
    }
    
    // Сброс всех тем и фонов
    document.body.className = '';
    document.body.style.background = '';
    document.body.style.backgroundColor = '';
    
    if (themeName === 'theme-standard') {
        // Тема по умолчанию: берет цвет фона из AE
        updateThemeWithAppSkinInfo(csInterface.getHostEnvironment().appSkinInfo);
    } else {
        // Для кастомных тем добавляем класс на body (цвета переопределятся в CSS)
        document.body.classList.add(themeName);
    }

    // Обновляем UI кнопок
    var btns = document.querySelectorAll('.theme-btn');
    btns.forEach(function(btn) {
        if (btn.getAttribute('data-theme') === themeName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Показ цитаты при выборе темы (только если это был клик пользователя, а не загрузка)
    if (save !== false) {
        if (themeName === 'theme-editor') {
            showQuote("«Пока могу держать меч — я ещё жив»", "— Берсерк");
        } else if (themeName === 'theme-liquid') {
            showQuote("«Единственный способ делать великую работу — любить то, что ты делаешь»", "— Стив Джобс");
        } else if (themeName === 'theme-knight') {
            showQuote("«Иногда единственная победа — не сдаться»", "— Балдуин IV");
        } else if (themeName === 'theme-dark') {
            showQuote("«Внутри меня горит великий огонь»", "— Винсент Ван Гог");
        } else if (themeName === 'theme-standard') {
            showQuote("«Твой стиль рождается в работе»", "— БОСС");
        }
    }
}

function showQuote(text, author) {
    var toast = document.getElementById('quote-toast');
    if (!toast) return;
    toast.querySelector('.quote-text').innerHTML = text;
    toast.querySelector('.quote-author').innerHTML = author;
    toast.classList.add('show');
}

function hideQuote() {
    var toast = document.getElementById('quote-toast');
    if (toast) toast.classList.remove('show');
}
