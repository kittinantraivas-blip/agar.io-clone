var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');
var imageLoader = require('./imageLoader');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

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
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
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
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
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
    const now = performance.now();
    if (global.performance.lastFrameTime) {
        const frameDelta = now - global.performance.lastFrameTime;
        global.performance.frameCount++;
        
        // Calculate rolling average FPS
        if (global.performance.frameCount % 60 === 0) {
            global.performance.averageFPS = 1000 / frameDelta;
        }
    }
    global.performance.lastFrameTime = now;
    
    if (global.gameStart) {
        // Set image smoothing settings for performance
        if (global.images.imageSmoothingEnabled !== undefined) {
            graph.imageSmoothingEnabled = global.images.imageSmoothingEnabled;
            if (graph.imageSmoothingQuality !== undefined) {
                graph.imageSmoothingQuality = global.images.imageSmoothingQuality;
            }
        }
        
        // Clear canvas with background color or transparent for background image
        const mapImage = imageLoader.getImage('map');
        if (mapImage && !imageLoader.failedToLoad && !global.images.forceFallback) {
            // Use transparent background when we have a background image
            graph.clearRect(0, 0, global.screen.width, global.screen.height);
        } else {
            // Use solid background color as fallback
            graph.fillStyle = global.backgroundColor;
            graph.fillRect(0, 0, global.screen.width, global.screen.height);
        }

        render.drawGrid(global, player, global.screen, graph);
        
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
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            for (var j = 0; j < users[i].cells.length; j++) {
                const cell = users[i].cells[j];
                // Only add visible cells for performance
                if (cell.x >= visibleBounds.left && cell.x <= visibleBounds.right &&
                    cell.y >= visibleBounds.top && cell.y <= visibleBounds.bottom) {
                    cellsToDraw.push({
                        color: color,
                        borderColor: borderColor,
                        mass: cell.mass,
                        name: users[i].name,
                        radius: cell.radius,
                        x: cell.x - player.x + global.screen.width / 2,
                        y: cell.y - player.y + global.screen.height / 2
                    });
                }
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
        
        // Display FPS counter if performance is below target (for debugging)
        if (global.performance.averageFPS < global.performance.targetFPS * 0.8 && global.performance.frameCount > 120) {
            graph.fillStyle = 'rgba(255, 255, 0, 0.8)';
            graph.font = '12px monospace';
            graph.fillText(`FPS: ${Math.round(global.performance.averageFPS)}`, 10, 20);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
