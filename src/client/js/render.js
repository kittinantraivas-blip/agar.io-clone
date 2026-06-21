const FULL_ANGLE = 2 * Math.PI;
const imageLoader = require('./imageLoader');

const DEFAULT_SKIN_URL = 'img/skins/composed/skin_1_1.png';
const DEFAULT_OVERLAY_COLOR = '#FF7A00';
const DEFAULT_TURRET_URL = 'img/turrets/direction1.png';
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const skinImageCache = new Map();

function getSessionSkinUrl() {
    try {
        const value = sessionStorage.getItem('player_skin_url');
        if (value && typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed && trimmed.startsWith('img/')) {
                return trimmed;
            }
        }
    } catch (e) {}
    return DEFAULT_SKIN_URL;
}

function getSessionOverlayColor() {
    try {
        const c = sessionStorage.getItem('player_overlay_color');
        if (c && HEX_COLOR_REGEX.test(c)) {
            return c;
        }
    } catch (e) {}
    return DEFAULT_OVERLAY_COLOR;
}

function getSessionTurretUrl() {
    try {
        const value = sessionStorage.getItem('player_turret_url');
        if (value && typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed && trimmed.startsWith('img/')) {
                return trimmed;
            }
        }
    } catch (e) {}
    return DEFAULT_TURRET_URL;
}

function getOrLoadSkin(url) {
    if (!url) return null;
    let cached = skinImageCache.get(url);
    if (!cached) {
        const img = new Image();
        img.src = url;
        skinImageCache.set(url, img);
        return img;
    }
    return cached;
}

function getOrLoadTurret(url) {
    if (!url) return null;
    return getOrLoadSkin(url);
}

function resolveSkinUrl(cell) {
    if (cell && typeof cell.skinUrl === 'string') {
        const trimmed = cell.skinUrl.trim();
        if (trimmed && trimmed.startsWith('img/')) {
            return trimmed;
        }
    }
    if (cell && cell.isLocal === true) {
        return getSessionSkinUrl();
    }
    return DEFAULT_SKIN_URL;
}

function resolveOverlayColor(cell) {
    if (cell && typeof cell.overlayColor === 'string' && HEX_COLOR_REGEX.test(cell.overlayColor)) {
        return cell.overlayColor;
    }
    if (cell && cell.isLocal === true) {
        return getSessionOverlayColor();
    }
    return null;
}

function resolveTurretUrl(cell) {
    if (cell && typeof cell.turretUrl === 'string') {
        const trimmed = cell.turretUrl.trim();
        if (trimmed && trimmed.startsWith('img/')) {
            return trimmed;
        }
    }
    if (cell && cell.isLocal === true) {
        return getSessionTurretUrl();
    }
    return DEFAULT_TURRET_URL;
}

function getEffectiveOverlayColor(cell) {
    const resolved = resolveOverlayColor(cell);
    if (resolved) return resolved;
    if (cell && typeof cell.color === 'string' && cell.color) {
        return cell.color;
    }
    if (cell && typeof cell.borderColor === 'string' && cell.borderColor) {
        return cell.borderColor;
    }
    return DEFAULT_OVERLAY_COLOR;
}

function isImageRenderable(img) {
    return !!(img && img.complete && img.naturalWidth > 0);
}

function isImageFailed(img) {
    return !!(img && img.complete && img.naturalWidth === 0);
}

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    // Choose sprite based on server-provided index (1-4)
    const idx = Number(food && food.spriteIndex) || 1;
    const clampedIdx = Math.min(Math.max(idx, 1), 4);
    const key = 'food' + clampedIdx;
    const foodImage = imageLoader.getImage(key) || imageLoader.getImage('food');
    
    if (foodImage && !imageLoader.failedToLoad) {
        // Draw food.png above the original circle
        const diameter = food.radius * 7;
        
        graph.save();
    
        // First: Draw semi-transparent colored circle at the bottom 
        graph.globalAlpha = 1; // 70% opacity for overlay
        graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
        graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
        graph.lineWidth = 0;
        graph.beginPath();
        graph.arc(position.x, position.y, food.radius, 0, FULL_ANGLE);
        graph.fill();

        // Second: Draw food.png image on the top layer
        graph.drawImage(foodImage, 
            position.x - food.radius * 3.5, position.y - food.radius * 3.25,
            diameter, diameter);

        
        // Reset globalAlpha
        graph.globalAlpha = 1.0;
        
        graph.restore();
    } else {
        // Fallback to original geometric shape
        graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
        graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
        graph.lineWidth = 0;
        drawRoundObject(position, food.radius, graph);
    }
};

const drawVirus = (position, virus, graph) => {
    const virusImage = imageLoader.getImage('virus');
    
    if (virusImage && !imageLoader.failedToLoad) {
        // Draw image-based virus
        const diameter = virus.radius * 3;
        
        graph.save();
        
        // Apply slight rotation for visual interest
        const rotation = Date.now() * 0.1; // Slow rotation
        graph.translate(position.x, position.y);
        graph.rotate(rotation);
        
        // Draw virus image
        graph.drawImage(virusImage,
            -virus.radius, -virus.radius,
            diameter, diameter);
            
        graph.restore();
        
        // Add colored overlay if virus has custom colors
        if (virus.fill !== '#33ff33') {
            graph.save();
            graph.globalCompositeOperation = 'multiply';
            graph.fillStyle = virus.fill;
            graph.beginPath();
            graph.arc(position.x, position.y, virus.radius, 0, FULL_ANGLE);
            graph.fill();
            graph.restore();
        }
    } else {
        // Fallback to original spiky shape
        graph.strokeStyle = virus.stroke;
        graph.fillStyle = virus.fill;
        graph.lineWidth = virus.strokeWidth;
        let sides = 20;

        graph.beginPath();
        for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
            let point = circlePoint(position, virus.radius, theta);
            graph.lineTo(point.x, point.y);
        }
        graph.closePath();
        graph.stroke();
        graph.fill();
    }
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    const massFoodImage = imageLoader.getImage('massFood');
    
    if (massFoodImage && !imageLoader.failedToLoad) {
        // Draw image-based ejected mass
        const diameter = (mass.radius - 1) * 2;
        
        graph.save();
        
        // Apply color tinting
        mass.hue = '#ffffff98';
        graph.globalCompositeOperation = 'source-over';
        graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
        graph.beginPath();
        graph.arc(position.x, position.y, mass.radius - 1, 0, FULL_ANGLE);
        graph.fill();
        
        // Draw the image with multiply blend for tinting
        graph.drawImage(massFoodImage,
            position.x - (mass.radius - 1), position.y - (mass.radius - 1),
            diameter, diameter);
        graph.globalCompositeOperation = 'multiply';
            
        // Add border
        graph.globalCompositeOperation = 'source-over';
        graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 35%)';
        graph.lineWidth = 0;
        graph.beginPath();
        graph.arc(position.x, position.y, mass.radius - 1, 0, FULL_ANGLE);
        graph.stroke();
        
        graph.restore();
    } else {
        // Fallback to original shape
        graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
        graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
        graph.lineWidth = 0;
        drawRoundObject(position, mass.radius - 1, graph);
    }
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

const drawCellWithLines = (cell, borders, graph) => {
    let pointCount = 30 + ~~(cell.mass / 5);
    let points = [];
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
        let point = circlePoint(cell, cell.radius, theta);
        points.push(regulatePoint(point, borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        graph.lineTo(points[i].x, points[i].y);
    }
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        const skinUrl = resolveSkinUrl(cell);
        let skinImage = null;
        let hasSkinImage = false;

        if (skinUrl) {
            const candidateImage = getOrLoadSkin(skinUrl);
            if (isImageRenderable(candidateImage)) {
                skinImage = candidateImage;
                hasSkinImage = true;
            } else if (isImageFailed(candidateImage) && skinUrl !== DEFAULT_SKIN_URL) {
                const fallbackImage = getOrLoadSkin(DEFAULT_SKIN_URL);
                if (isImageRenderable(fallbackImage)) {
                    skinImage = fallbackImage;
                    hasSkinImage = true;
                }
            }
        }

        const overlayColor = getEffectiveOverlayColor(cell);
        const strokeColor = overlayColor;
        const fallbackFillColor = overlayColor;

        if (hasSkinImage) {
            graph.save();
            graph.globalAlpha = 0.5;
            graph.fillStyle = overlayColor;
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
            graph.fill();
            graph.globalAlpha = 1.0;

            const scaledRadius = cell.radius * 2;
            const scaledDiameter = scaledRadius * 2;

            if (cellTouchingBorders(cell, borders)) {
                let pointCount = 30 + ~~(cell.mass / 5);
                let points = [];
                for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
                    let point = circlePoint(cell, cell.radius, theta);
                    points.push(regulatePoint(point, borders));
                }
                if (points.length > 0) {
                    graph.beginPath();
                    graph.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        graph.lineTo(points[i].x, points[i].y);
                    }
                    graph.closePath();
                    graph.clip();
                }
            }

            graph.strokeStyle = strokeColor;
            graph.lineWidth = 0;
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
            graph.stroke();

            graph.drawImage(
                skinImage,
                cell.x - scaledRadius,
                cell.y - scaledRadius,
                scaledDiameter,
                scaledDiameter
            );

            graph.restore();

        } else {
            graph.fillStyle = fallbackFillColor;
            graph.strokeStyle = strokeColor;
            graph.lineWidth = 0;
            if (cellTouchingBorders(cell, borders)) {
                drawCellWithLines(cell, borders, graph);
            } else {
                drawRoundObject(cell, cell.radius, graph);
            }
        }

        const turretUrl = resolveTurretUrl(cell);
        let turretImage = null;
        if (turretUrl) {
            const candidateTurret = getOrLoadTurret(turretUrl);
            if (isImageRenderable(candidateTurret)) {
                turretImage = candidateTurret;
            } else if (isImageFailed(candidateTurret) && turretUrl !== DEFAULT_TURRET_URL) {
                const fallbackTurret = getOrLoadTurret(DEFAULT_TURRET_URL);
                if (isImageRenderable(fallbackTurret)) {
                    turretImage = fallbackTurret;
                }
            }
        }

        if (turretImage && !imageLoader.failedToLoad) {
            const angle = (typeof cell.angle === 'number') ? cell.angle : 0;

            graph.save();
            graph.translate(cell.x, cell.y);
            graph.rotate(angle);

            // Size and offset of the turret relative to the cell radius
            const turretLength = cell.radius * 3.5;
            const turretWidth = cell.radius * 2;
            const offsetX = cell.radius * 1.5;

            graph.drawImage(
                turretImage,
                offsetX,
                -turretWidth / 2,
                turretLength,
                turretWidth
            );

            graph.restore();
        }

        // Draw the name of the player (always on top, fully opaque)
        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y - cell.radius);
        graph.fillText(cell.name, cell.x, cell.y - cell.radius);

        // Draw the mass (if enabled, fully opaque)
        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if (cell.name.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    // Background is now drawn in app.js as a solid fill.
    return;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#ffffffff'
    graph.beginPath()
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath()
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#ffffffff';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#ffffffff';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder,
    // Expose image loader for other modules
    imageLoader
};
