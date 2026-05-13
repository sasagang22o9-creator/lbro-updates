const fs = require('fs');
const https = require('https');
const path = require('path');

// Текущая версия плагина. Когда выпускаешь обнову, в GitHub ставишь версию выше (например 1.0.1)
const CURRENT_VERSION = "1.0.2";

// Этот URL мы заменим, когда ты создашь репозиторий на GitHub!
let UPDATE_JSON_URL = "https://raw.githubusercontent.com/sasagang22o9-creator/lbro-updates/main/update.json"; 

function manualUpdateCheck() {
    showStatusToast("Проверка обновлений...");
    setTimeout(function() {
        checkForUpdates(true);
    }, 500);
}

function showStatusToast(message, duration) {
    let oldToast = document.getElementById('status-toast');
    if (oldToast) oldToast.remove();

    let html = `<div id="status-toast" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 20px; border-radius:20px; font-size:12px; z-index:10000; backdrop-filter:blur(5px); border:1px solid var(--accent); transition: opacity 0.3s;">${message}</div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    if (duration) {
        setTimeout(() => {
            let toast = document.getElementById('status-toast');
            if (toast) {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
}

function checkForUpdates(isManual) {
    console.log("Checking for updates...");
    
    if (UPDATE_JSON_URL.includes("sasagang22o9-creator") === false) {
        if (isManual) showStatusToast("URL не настроен", 3000);
        return;
    }

    // Сначала пробуем стандартный метод Node.js
    const request = https.get(UPDATE_JSON_URL + "?t=" + Date.now(), (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                let updateInfo = JSON.parse(data);
                handleUpdateCheckResult(updateInfo, isManual);
            } catch (e) {
                // Если не распарсилось - возможно там страница-заглушка файрвола
                trySystemShellFallback(isManual);
            }
        });
    });

    request.on("error", (err) => {
        console.log("Node.js fetch blocked or offline. Trying system shell fallback...");
        trySystemShellFallback(isManual);
    });

    // Таймаут на запрос
    request.setTimeout(5000, () => {
        request.abort();
        trySystemShellFallback(isManual);
    });
}

function trySystemShellFallback(isManual) {
    console.log("Trying system shell fallback...");
    // Используем window.require для надежности в CEP
    const req = (typeof window !== 'undefined' && window.require) ? window.require : require;
    const { exec } = req('child_process');
    const isWin = navigator.platform.startsWith('Win');
    
    // Команда для получения текста из URL. -s для curl делает его "тихим" (только тело ответа)
    let cmd = isWin 
        ? `powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri '${UPDATE_JSON_URL}?t=${Date.now()}' | ConvertTo-Json"`
        : `curl -sL "${UPDATE_JSON_URL}?t=${Date.now()}"`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error("Shell fallback failed:", error);
            console.error("Stderr:", stderr);
            if (isManual) showManualUpdateUI(); 
            return;
        }
        
        try {
            // Очищаем stdout от возможных пробелов или переносов строк
            let cleanOutput = stdout.trim();
            if (!cleanOutput) throw new Error("Empty response");
            
            let updateInfo = JSON.parse(cleanOutput);
            handleUpdateCheckResult(updateInfo, isManual);
        } catch (e) {
            console.error("Failed to parse shell output:", e, "Output was:", stdout);
            if (isManual) showManualUpdateUI();
        }
    });
}

function showManualUpdateUI() {
    let oldToast = document.getElementById('status-toast');
    if (oldToast) oldToast.remove();

    let html = `
        <div id="update-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; text-align:center; padding: 20px; box-sizing: border-box;">
            <div style="font-size: 40px; margin-bottom: 10px;">🚧</div>
            <h2 style="margin-bottom: 10px; color: #ff3333; font-size: 18px;">Обновление заблокировано</h2>
            <p style="margin-bottom: 20px; font-size:12px; color:#aaa;">After Effects заблокирован файрволом и не может выйти в сеть. Используйте ручной режим:</p>
            
            <div style="display:flex; flex-direction:column; gap:10px; width: 100%; max-width: 220px;">
                <button onclick="openUpdateSite()" style="padding: 12px; background: #0A84FF; border:none; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold;">1. Скачать файлы</button>
                <button onclick="openPluginFolder()" style="padding: 12px; background: rgba(255,255,255,0.1); border:none; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold;">2. Открыть папку плагина</button>
                <button onclick="document.getElementById('update-overlay').remove()" style="padding: 8px; background: transparent; border:none; color:#777; cursor:pointer; font-size:11px; margin-top:10px;">Закрыть</button>
            </div>
            
            <p style="margin-top: 20px; font-size:10px; color:#666;">Просто скачайте новые файлы из GitHub и замените их в открывшейся папке.</p>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function openUpdateSite() {
    let repoUrl = "https://github.com/sasagang22o9-creator/lbro-updates";
    csInterface.openURLInDefaultBrowser(repoUrl);
}

function openPluginFolder() {
    let extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    let os = navigator.platform.startsWith('Win') ? 'win' : 'mac';
    const { exec } = require('child_process');
    
    let cmd = os === 'win' ? `explorer "${extensionPath}"` : `open "${extensionPath}"`;
    exec(cmd);
}

function handleUpdateCheckResult(updateInfo, isManual) {
    if (isNewerVersion(CURRENT_VERSION, updateInfo.version)) {
        let oldToast = document.getElementById('status-toast');
        if (oldToast) oldToast.remove();
        showUpdateUI(updateInfo);
    } else {
        if (isManual) showStatusToast("У вас последняя версия", 3000);
    }
}

function isNewerVersion(current, remote) {
    let cParts = current.split('.').map(Number);
    let rParts = remote.split('.').map(Number);
    for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
        let c = cParts[i] || 0;
        let r = rParts[i] || 0;
        if (r > c) return true;
        if (r < c) return false;
    }
    return false;
}

function showUpdateUI(updateInfo) {
    let html = `
        <div id="update-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(15px); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; text-align:center; padding: 20px; box-sizing: border-box;">
            <div style="font-size: 40px; margin-bottom: 10px;">🚀</div>
            <h2 style="margin-bottom: 10px; color: #0A84FF; font-size: 20px;">Доступно обновление!</h2>
            <p style="margin-bottom: 5px; font-size:14px;">Новая версия: <span style="font-weight:bold">${updateInfo.version}</span></p>
            <p style="margin-bottom: 25px; font-size:12px; color:#aaa; max-width: 80%;">${updateInfo.changelog}</p>
            <div style="display:flex; gap:10px;">
                <button id="btn-do-update" style="padding: 10px 20px; background: #0A84FF; border:none; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold; transition: background 0.2s;">Скачать и Обновить</button>
                <button id="btn-skip-update" style="padding: 10px 20px; background: rgba(255,255,255,0.1); border:none; border-radius:6px; color:#fff; cursor:pointer; transition: background 0.2s;">Позже</button>
            </div>
            <div id="update-loading-area" style="display:none; margin-top:20px;">
                <div class="update-spinner"></div>
                <div id="update-progress" style="font-size: 13px; color: #0A84FF;">Подготовка...</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('btn-skip-update').onclick = () => {
        document.getElementById('update-overlay').remove();
    };

    document.getElementById('btn-do-update').onclick = () => {
        document.getElementById('btn-do-update').style.display = 'none';
        document.getElementById('btn-skip-update').style.display = 'none';
        document.getElementById('update-loading-area').style.display = 'block';
        
        let progressEl = document.getElementById('update-progress');
        downloadUpdates(updateInfo.files, progressEl);
    };
}

async function downloadUpdates(files, progressEl) {
    let extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    
    try {
        for (let i = 0; i < files.length; i++) {
            let fileObj = files[i];
            progressEl.innerText = `Скачивание файла ${i + 1} из ${files.length}...`;
            
            let targetPath = path.join(extensionPath, fileObj.localPath);
            
            // Если нужно создать папку (например css/ или js/)
            let dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            await downloadFile(fileObj.downloadUrl, targetPath);
        }
        
        progressEl.innerText = "Обновление завершено! Перезапуск панели...";
        progressEl.style.color = "#4CAF50"; // Зеленый цвет успеха
        
        setTimeout(() => {
            window.location.reload(true); // Горячий рестарт
        }, 1500);

    } catch (e) {
        progressEl.innerText = "Ошибка обновления: " + e.message;
        progressEl.style.color = "#ff3333";
        setTimeout(() => { document.getElementById('update-overlay').remove(); }, 3000);
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        // Пробуем стандартный метод
        const file = fs.createWriteStream(dest);
        const request = https.get(url + "?t=" + Date.now(), (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => {});
                trySystemDownloadFallback(url, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(dest, () => {});
            console.log("Node.js download failed, trying shell fallback...");
            trySystemDownloadFallback(url, dest).then(resolve).catch(reject);
        });

        request.setTimeout(10000, () => {
            request.abort();
            file.close();
            fs.unlink(dest, () => {});
            trySystemDownloadFallback(url, dest).then(resolve).catch(reject);
        });
    });
}

function trySystemDownloadFallback(url, dest) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        const isWin = navigator.platform.startsWith('Win');
        
        // Экранируем пути для консоли
        let safeDest = dest.replace(/ /g, "\\ "); // для Mac
        if (isWin) safeDest = `"${dest}"`;

        let cmd = isWin 
            ? `powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${url}' -OutFile ${safeDest}"`
            : `curl -L "${url}" -o ${safeDest}`;

        exec(cmd, (error) => {
            if (error) {
                reject(new Error("Все методы загрузки заблокированы системой."));
            } else {
                resolve();
            }
        });
    });
}
