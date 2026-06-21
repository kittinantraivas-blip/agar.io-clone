var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');
var imageLoader = require('./imageLoader');

const ENABLE_DIR_JOYSTICK = false;

var playerNameInput = document.getElementById('playerNameInput');
var socket;
const DEFAULT_PLAYER_SKIN = 'img/skins/composed/skin_1_1.png';
const DEFAULT_OVERLAY_COLOR = '#FF7A00';
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_TURRET_URL = 'img/turrets/direction1.png';

// Throttle configs
const JOY_FPS = 30;
const JOY_INTERVAL_MS = 1000 / JOY_FPS;
const SCORE_INTERVAL_MS = 120;

let _lastJoyUpdate = 0;
let _lastScoreUpdate = 0;
let _lastScoreValue = null;

let _lastJoyNX = 0;
let _lastJoyNY = 0;

function updateMobileScore(massValue) {
    var scoreEl = document.getElementById('mobileScore');
    if (!scoreEl) return;
    if (!document.documentElement.classList.contains('is-mobile')) return;

    var value = typeof massValue === 'number' ? Math.round(massValue) : massValue;
    if (_lastScoreValue === value) return;
    _lastScoreValue = value;
    scoreEl.textContent = 'SCORE : ' + value;
}

function getSessionSkinUrl() {
    try {
        const stored = sessionStorage.getItem('player_skin_url');
        if (stored && typeof stored === 'string') {
            const trimmed = stored.trim();
            if (trimmed && trimmed.startsWith('img/')) {
                return trimmed;
            }
        }
    } catch (e) {}
    return DEFAULT_PLAYER_SKIN;
}

function getSessionOverlayColor() {
    try {
        const stored = sessionStorage.getItem('player_overlay_color');
        if (stored && typeof stored === 'string' && HEX_COLOR_REGEX.test(stored)) {
            return stored;
        }
    } catch (e) {}
    return DEFAULT_OVERLAY_COLOR;
}

function getSessionTurretUrl() {
    try {
        const stored = sessionStorage.getItem('player_turret_url');
        if (stored && typeof stored === 'string') {
            const trimmed = stored.trim();
            if (trimmed && trimmed.startsWith('img/')) {
                return trimmed;
            }
        }
    } catch (e) {}
    return DEFAULT_TURRET_URL;
}

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

document.addEventListener('touchmove', function (e) {
    if (!e || !e.target) return;
    var isCanvas = e.target.id === 'cvs';
    var isOverlay = typeof e.target.closest === 'function' ? !!e.target.closest('#overlayMobile') : false;
    if (isCanvas || isOverlay) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('gesturestart', function (e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('dblclick', function (e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
}, { passive: false });

function startGame(type) {
    document.documentElement.classList.toggle('spectate-mode', type === 'spectator');
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;
    player.skinUrl = getSessionSkinUrl();
    player.overlayColor = getSessionOverlayColor();
    player.turretUrl = getSessionTurretUrl();

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    // Show loading screen while images load
    showLoadingScreen();
    
    // Load images before starting the game
    imageLoader.loadAllImages().then(() => {
        // Hide loading screen and show game
        hideLoadingScreen();
        
        document.getElementById('startMenuWrapper').style.maxHeight = '0px';
        document.getElementById('gameAreaWrapper').style.opacity = 1;
        if (!socket) {
            socket = io({ query: "type=" + type });
            setupSocket(socket);
        }
        if (!global.animLoopHandle)
            animloop();
        socket.emit('respawn');
        window.chat.socket = socket;
        window.chat.registerFunctions();
        window.canvas.socket = socket;
        global.socket = socket;
    }).catch((error) => {
        console.error('Failed to load images:', error);
        // Continue with fallback rendering
        hideLoadingScreen();
        
        document.getElementById('startMenuWrapper').style.maxHeight = '0px';
        document.getElementById('gameAreaWrapper').style.opacity = 1;
        if (!socket) {
            socket = io({ query: "type=" + type });
            setupSocket(socket);
        }
        if (!global.animLoopHandle)
            animloop();
        socket.emit('respawn');
        window.chat.socket = socket;
        window.chat.registerFunctions();
        window.canvas.socket = socket;
        global.socket = socket;
    });
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

// Loading screen functions
function showLoadingScreen() {
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: sans-serif;
            color: white;
        `;
        loadingOverlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 20px;">Loading Game Assets...</div>
            <div id="loadingProgress" style="width: 300px; height: 20px; background: #333; border-radius: 10px; overflow: hidden;">
                <div id="loadingBar" style="height: 100%; background: #4CAF50; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="loadingText" style="margin-top: 10px; font-size: 14px; opacity: 0.8;">Preparing images...</div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
    
    // Update progress periodically
    const progressInterval = setInterval(() => {
        const progress = imageLoader.getLoadingProgress();
        const progressBar = document.getElementById('loadingBar');
        const progressText = document.getElementById('loadingText');
        
        if (progressBar) {
            progressBar.style.width = (progress * 100) + '%';
        }
        
        if (progressText) {
            if (imageLoader.allImagesLoaded) {
                progressText.textContent = 'Ready to play!';
                clearInterval(progressInterval);
            } else if (imageLoader.failedToLoad) {
                progressText.textContent = 'Some images failed to load, using fallbacks';
                clearInterval(progressInterval);
            } else {
                progressText.textContent = `Loading images... ${Math.round(progress * 100)}%`;
            }
        }
        
        if (imageLoader.allImagesLoaded || imageLoader.failedToLoad) {
            clearInterval(progressInterval);
        }
    }, 100);
}

function hideLoadingScreen() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectator');
    };

    // Auto-start spectate mode when accessed via /spectate URL or ?spectate=1
    var isSpectateUrl = window.location.pathname === '/spectate' ||
        new URLSearchParams(window.location.search).get('spectate') === '1';
    if (isSpectateUrl) {
        startGame('spectator');
        return;
    }

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 },
    skinUrl: getSessionSkinUrl(),
    overlayColor: getSessionOverlayColor(),
    turretUrl: getSessionTurretUrl()
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var dirJoy = null;

function isMobileUI() {
    return document.documentElement.classList.contains('is-mobile');
}

if (ENABLE_DIR_JOYSTICK) {
    var DirectionJoystick = require('./directionJoystick');
    var dirJoyCanvas = document.getElementById('dirJoy');

    // overlay-mobile.png ถูกออกแบบ 1080x1920 และรู 300px ตรงกลาง
    function computeJoySizePx() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.max(vw / 1080, vh / 1920); // cover scaling
        return 300 * scale; // เส้นผ่านศูนย์กลางรู
    }

    function resizeDirJoy() {
        if (!dirJoy || !dirJoyCanvas) return;
        const size = computeJoySizePx();
        // ตั้ง CSS var ให้สอดคล้องด้วย
        dirJoyCanvas.style.setProperty('--joySize', Math.round(size) + 'px');
        dirJoy.resizeCssPx(size);
    }

    if (dirJoyCanvas) {
        dirJoy = new DirectionJoystick(dirJoyCanvas, { deadzone: 0.10 });
        resizeDirJoy();
        window.addEventListener('resize', resizeDirJoy);
        window.addEventListener('orientationchange', resizeDirJoy);
    }
}

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

// Add image rendering toggle for performance testing
if (typeof settings.toggleImageRendering === 'function') {
    var imageRenderingSetting = document.getElementById('imageRendering');
    if (imageRenderingSetting) {
        imageRenderingSetting.onchange = settings.toggleImageRendering;
    }
}

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function bindMobileAction($el, command) {
    function fire(e) {
        e.preventDefault();
        e.stopPropagation();
        socket.emit(command);
        window.canvas.reenviar = false;
    }
    $el.on('click', fire);
    $el.on('touchstart', fire);
}

bindMobileAction($("#feed"),  '1');
bindMobileAction($("#split"), '2');

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { // We have a more specific error message 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        player.skinUrl = getSessionSkinUrl();
        player.overlayColor = getSessionOverlayColor();
        player.turretUrl = getSessionTurretUrl();
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        socket.emit('playerSkinUpdate', {
            skinUrl: player.skinUrl,
            overlayColor: player.overlayColor,
            turretUrl: player.turretUrl
        });
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            if (playerData.skinUrl && typeof playerData.skinUrl === 'string') {
                player.skinUrl = playerData.skinUrl;
            } else if (!player.skinUrl) {
                player.skinUrl = getSessionSkinUrl();
            }
            if (playerData.overlayColor && typeof playerData.overlayColor === 'string') {
                player.overlayColor = playerData.overlayColor;
            } else if (!player.overlayColor || !HEX_COLOR_REGEX.test(player.overlayColor)) {
                player.overlayColor = getSessionOverlayColor();
            }
            if (playerData.turretUrl && typeof playerData.turretUrl === 'string') {
                const trimmedTurret = playerData.turretUrl.trim();
                if (trimmedTurret && trimmedTurret.startsWith('img/')) {
                    player.turretUrl = trimmedTurret;
                }
            } else if (!player.turretUrl) {
                player.turretUrl = getSessionTurretUrl();
            }
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
        
        // Make viruses available to canvas for slow down effect
        window.viruses = virusList;
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    // Performance monitoring
    const p = global.performance || (global.performance = {});
    const now = performance.now();
    if (p.lastFrameTime) {
        const frameDelta = now - p.lastFrameTime;
        p.lastFrameDelta = frameDelta;
        p.instantFPS = frameDelta > 0 ? (1000 / frameDelta) : 0;

        const w = p.rollingWindow || 60;
        if (!Array.isArray(p.deltas)) {
            p.deltas = [];
            p.deltasSum = 0;
        }

        p.deltas.push(frameDelta);
        p.deltasSum += frameDelta;

        if (p.deltas.length > w) {
            p.deltasSum -= p.deltas.shift();
        }

        const denom = p.deltas.length || 1;
        p.avgFrameDelta = p.deltasSum / denom;
        p.rollingFPS = p.avgFrameDelta > 0 ? (1000 / p.avgFrameDelta) : 0;
        p.averageFPS = p.rollingFPS;

        p.frameCount++;
    }
    p.lastFrameTime = now;
    
    if (global.gameStart) {
        // Set image smoothing settings for performance
        if (global.images.imageSmoothingEnabled !== undefined) {
            graph.imageSmoothingEnabled = global.images.imageSmoothingEnabled;
            if (graph.imageSmoothingQuality !== undefined) {
                graph.imageSmoothingQuality = global.images.imageSmoothingQuality;
            }
        }

        if (global.playerType === 'spectator') {
            const screenW = global.screen.width;
            const screenH = global.screen.height;
            const gameW = global.game.width;
            const gameH = global.game.height;

            const scale = Math.min(screenW / gameW, screenH / gameH);
            const viewWorldW = screenW / scale;
            const viewWorldH = screenH / scale;
            const camX = gameW / 2;
            const camY = gameH / 2;

            let topLeftX = camX - viewWorldW / 2;
            let topLeftY = camY - viewWorldH / 2;

            if (viewWorldW < gameW) {
                topLeftX = Math.max(0, Math.min(gameW - viewWorldW, topLeftX));
            } else {
                topLeftX = (gameW - viewWorldW) / 2;
            }

            if (viewWorldH < gameH) {
                topLeftY = Math.max(0, Math.min(gameH - viewWorldH, topLeftY));
            } else {
                topLeftY = (gameH - viewWorldH) / 2;
            }

            const offsetX = -topLeftX * scale;
            const offsetY = -topLeftY * scale;

            graph.setTransform(1, 0, 0, 1, 0, 0);
            graph.clearRect(0, 0, screenW, screenH);
            graph.fillStyle = global.backgroundColor;
            graph.fillRect(0, 0, screenW, screenH);

            // Fit entire map in view; letterbox via world->screen transform.
            graph.setTransform(scale, 0, 0, scale, offsetX, offsetY);

            const visibleBounds = {
                left: topLeftX - 100,
                right: topLeftX + viewWorldW + 100,
                top: topLeftY - 100,
                bottom: topLeftY + viewWorldH + 100
            };

            foods.forEach(food => {
                if (food.x >= visibleBounds.left && food.x <= visibleBounds.right &&
                    food.y >= visibleBounds.top && food.y <= visibleBounds.bottom) {
                    render.drawFood({ x: food.x, y: food.y }, food, graph);
                }
            });

            fireFood.forEach(mass => {
                if (mass.x >= visibleBounds.left && mass.x <= visibleBounds.right &&
                    mass.y >= visibleBounds.top && mass.y <= visibleBounds.bottom) {
                    render.drawFireFood({ x: mass.x, y: mass.y }, mass, playerConfig, graph);
                }
            });

            viruses.forEach(virus => {
                if (virus.x >= visibleBounds.left && virus.x <= visibleBounds.right &&
                    virus.y >= visibleBounds.top && virus.y <= visibleBounds.bottom) {
                    render.drawVirus({ x: virus.x, y: virus.y }, virus, graph);
                }
            });

            const borders = {
                left: 0,
                right: gameW,
                top: 0,
                bottom: gameH
            };
            if (global.borderDraw) {
                render.drawBorder(borders, graph);
            }

            var cellsToDraw = [];
            for (var i = 0; i < users.length; i++) {
                const netPlayer = users[i];
                let color = 'hsl(' + netPlayer.hue + ', 100%, 0%)';
                let borderColor = 'hsl(' + netPlayer.hue + ', 100%, 0%)';
                const hasId = netPlayer.id !== undefined && netPlayer.id !== null;
                const isMine = hasId ? (netPlayer.id === player.id) : (netPlayer.name === player.name);
                const playerSkinUrl = (netPlayer.skinUrl && typeof netPlayer.skinUrl === 'string' && netPlayer.skinUrl.trim()) ? netPlayer.skinUrl.trim() : null;
                const playerOverlayColor = (netPlayer.overlayColor && typeof netPlayer.overlayColor === 'string' && HEX_COLOR_REGEX.test(netPlayer.overlayColor)) ? netPlayer.overlayColor : null;
                const rawTurret = (netPlayer.turretUrl && typeof netPlayer.turretUrl === 'string') ? netPlayer.turretUrl.trim() : '';
                const playerTurretUrl = (rawTurret && rawTurret.startsWith('img/')) ? rawTurret : null;
                for (var j = 0; j < netPlayer.cells.length; j++) {
                    const cell = netPlayer.cells[j];
                    if (cell.x >= visibleBounds.left && cell.x <= visibleBounds.right &&
                        cell.y >= visibleBounds.top && cell.y <= visibleBounds.bottom) {
                        cellsToDraw.push({
                            color: color,
                            borderColor: borderColor,
                            mass: cell.mass,
                            name: netPlayer.name,
                            radius: cell.radius,
                            x: cell.x,
                            y: cell.y,
                            angle: (typeof cell.angle === 'number') ? cell.angle : 0,
                            isLocal: isMine,
                            skinUrl: playerSkinUrl,
                            overlayColor: playerOverlayColor,
                            turretUrl: playerTurretUrl
                        });
                    }
                }
            }
            cellsToDraw.sort(function (obj1, obj2) {
                return obj1.mass - obj2.mass;
            });
            render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

            graph.setTransform(1, 0, 0, 1, 0, 0);
            return;
        }
        
        // Solid background fill (map/grid removed)
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);
        
        // Performance optimization: only render visible entities
        const visibleBounds = {
            left: player.x - global.screen.width / 2 - 100,
            right: player.x + global.screen.width / 2 + 100,
            top: player.y - global.screen.height / 2 - 100,
            bottom: player.y + global.screen.height / 2 + 100
        };
        
        // Draw foods (with culling for performance)
        foods.forEach(food => {
            if (food.x >= visibleBounds.left && food.x <= visibleBounds.right &&
                food.y >= visibleBounds.top && food.y <= visibleBounds.bottom) {
                let position = getPosition(food, player, global.screen);
                render.drawFood(position, food, graph);
            }
        });
        
        // Draw ejected mass (with culling for performance)
        fireFood.forEach(fireFood => {
            if (fireFood.x >= visibleBounds.left && fireFood.x <= visibleBounds.right &&
                fireFood.y >= visibleBounds.top && fireFood.y <= visibleBounds.bottom) {
                let position = getPosition(fireFood, player, global.screen);
                render.drawFireFood(position, fireFood, playerConfig, graph);
            }
        });
        
        // Draw viruses (with culling for performance)
        viruses.forEach(virus => {
            if (virus.x >= visibleBounds.left && virus.x <= visibleBounds.right &&
                virus.y >= visibleBounds.top && virus.y <= visibleBounds.bottom) {
                let position = getPosition(virus, player, global.screen);
                render.drawVirus(position, virus, graph);
            }
        });

        let borders = { // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            const netPlayer = users[i];
            let color = 'hsl(' + netPlayer.hue + ', 100%, 0%)';
            let borderColor = 'hsl(' + netPlayer.hue + ', 100%, 0%)';
            const hasId = netPlayer.id !== undefined && netPlayer.id !== null;
            const isMine = hasId ? (netPlayer.id === player.id) : (netPlayer.name === player.name);
            const playerSkinUrl = (netPlayer.skinUrl && typeof netPlayer.skinUrl === 'string' && netPlayer.skinUrl.trim()) ? netPlayer.skinUrl.trim() : null;
            const playerOverlayColor = (netPlayer.overlayColor && typeof netPlayer.overlayColor === 'string' && HEX_COLOR_REGEX.test(netPlayer.overlayColor)) ? netPlayer.overlayColor : null;
            const rawTurret = (netPlayer.turretUrl && typeof netPlayer.turretUrl === 'string') ? netPlayer.turretUrl.trim() : '';
            const playerTurretUrl = (rawTurret && rawTurret.startsWith('img/')) ? rawTurret : null;
            for (var j = 0; j < netPlayer.cells.length; j++) {
                const cell = netPlayer.cells[j];
                // Only add visible cells for performance
                if (cell.x >= visibleBounds.left && cell.x <= visibleBounds.right &&
                    cell.y >= visibleBounds.top && cell.y <= visibleBounds.bottom) {
                    cellsToDraw.push({
                        color: color,
                        borderColor: borderColor,
                        mass: cell.mass,
                        name: netPlayer.name,
                        radius: cell.radius,
                        x: cell.x - player.x + global.screen.width / 2,
                        y: cell.y - player.y + global.screen.height / 2,
                        angle: (typeof cell.angle === 'number') ? cell.angle : 0,
                        isLocal: isMine,
                        skinUrl: playerSkinUrl,
                        overlayColor: playerOverlayColor,
                        turretUrl: playerTurretUrl
                    });
                }
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        var totalMass = 0;
        if (typeof player.massTotal === 'number') {
            totalMass = player.massTotal;
        } else if (player && player.cells && player.cells.length) {
            for (var idx = 0; idx < player.cells.length; idx++) {
                totalMass += player.cells[idx].mass || 0;
            }
        }
        if (isMobileUI()) {
            if (now - _lastScoreUpdate >= SCORE_INTERVAL_MS) {
                updateMobileScore(totalMass);
                _lastScoreUpdate = now;
            }
        }

        if (ENABLE_DIR_JOYSTICK && dirJoy && document.documentElement.classList.contains('is-mobile')) {
            if (now - _lastJoyUpdate >= JOY_INTERVAL_MS) {
                const t = window.canvas && window.canvas.target ? window.canvas.target : null;
                if (t) {
                    const nx = Math.max(-1, Math.min(1, t.x / (global.screen.width * 0.5)));
                    const ny = Math.max(-1, Math.min(1, t.y / (global.screen.height * 0.5)));
                    const eps = 0.01;
                    const changed = (Math.abs(nx - _lastJoyNX) > eps) || (Math.abs(ny - _lastJoyNY) > eps);
                    if (changed) {
                        _lastJoyNX = nx;
                        _lastJoyNY = ny;
                        dirJoy.setFromTarget(t, global.screen.width, global.screen.height);
                    }
                }
                _lastJoyUpdate = now;
            }
        }

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
        
        const perfOn = (p.hud && p.hud.enabled !== false) && (
            (new URLSearchParams(location.search).get('perf') === '1') ||
            (p.hud && p.hud.showAlways) ||
            (p.averageFPS && p.targetFPS && p.averageFPS < p.targetFPS * 0.8 && p.frameCount > 120)
        );

        if (perfOn) {
            graph.save();
            graph.fillStyle = 'rgba(255, 255, 0, 0.85)';
            graph.font = '12px monospace';
            graph.fillText(`Δ ${p.lastFrameDelta.toFixed(1)}ms (avg ${p.avgFrameDelta.toFixed(1)}ms)`, 10, 20);
            graph.fillText(`FPS inst ${Math.round(p.instantFPS)} | FPS avg ${Math.round(p.rollingFPS)}`, 10, 36);
            graph.restore();
        }
    }
    else {
        if (isMobileUI()) {
            if (now - _lastScoreUpdate >= SCORE_INTERVAL_MS) {
                updateMobileScore(0);
                _lastScoreUpdate = now;
            }
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = window.innerWidth;
    player.screenHeight = c.height = global.screen.height = window.innerHeight;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
