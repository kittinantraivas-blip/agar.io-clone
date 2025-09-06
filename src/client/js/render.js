const FULL_ANGLE = 2 * Math.PI;
const imageLoader = require('./imageLoader');

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    const foodImage = imageLoader.getImage('food');
    
    if (foodImage && !imageLoader.failedToLoad) {
        // Draw food.png UNDERNEATH the original circle
        const diameter = food.radius * 6;
        
        graph.save();
        
        // First: Draw food.png image at the bottom layer
        graph.drawImage(foodImage, 
            position.x - food.radius * 3, position.y - food.radius * 3.5,
            diameter, diameter);
        
        // Second: Draw semi-transparent colored circle on top
        graph.globalAlpha = 0.5; // 70% opacity for overlay
        graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
        graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
        graph.lineWidth = 0;
        graph.beginPath();
        graph.arc(position.x, position.y, food.radius, 0, FULL_ANGLE);
        graph.fill();
        
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
        graph.globalCompositeOperation = 'source-over';
        graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
        graph.beginPath();
        graph.arc(position.x, position.y, mass.radius - 1, 0, FULL_ANGLE);
        graph.fill();
        
        // Draw the image with multiply blend for tinting
        graph.globalCompositeOperation = 'multiply';
        graph.drawImage(massFoodImage,
            position.x - (mass.radius - 1), position.y - (mass.radius - 1),
            diameter, diameter);
            
        // Add border
        graph.globalCompositeOperation = 'source-over';
        graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 35%)';
        graph.lineWidth = 2;
        graph.beginPath();
        graph.arc(position.x, position.y, mass.radius - 1, 0, FULL_ANGLE);
        graph.stroke();
        
        graph.restore();
    } else {
        // Fallback to original shape
        graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
        graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
        graph.lineWidth = playerConfig.border + 2;
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
    const playerImage = imageLoader.getImage('player');
    
    for (let cell of cells) {
        if (playerImage && !imageLoader.failedToLoad) {
            // Draw player.png LARGER than the cell (1.3x scaling factor)
            const scaledRadius = cell.radius * 2; // Scale up by 1.3x
            const scaledDiameter = scaledRadius * 2;
            
            graph.save();
            
            // First: Draw player.png image at the bottom layer (larger)
            graph.drawImage(playerImage,
                cell.x - scaledRadius, cell.y - scaledRadius,
                scaledDiameter, scaledDiameter);
            
            // Handle border clipping for the overlay circle
            if (cellTouchingBorders(cell, borders)) {
                // Create clipping path for border-touching cells
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
                graph.clip();
            }
            
            // Second: Draw semi-transparent colored circle on top (original size)
            graph.globalAlpha = 0.5; // 70% opacity for overlay
            graph.fillStyle = cell.color;
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
            graph.fill();
            
            // Reset globalAlpha
            graph.globalAlpha = 1.0;
            
            graph.restore();
            
            // Draw border (always fully opaque)
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 6;
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
            graph.stroke();
        } else {
            // Fallback to original geometric shape
            graph.fillStyle = cell.color;
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 6;
            if (cellTouchingBorders(cell, borders)) {
                drawCellWithLines(cell, borders, graph);
            } else {
                drawRoundObject(cell, cell.radius, graph);
            }
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
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);

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
    // Draw background image if available
    const mapImage = imageLoader.getImage('map');
    
    if (mapImage && !imageLoader.failedToLoad) {
        // Draw tiled background with proper parallax scrolling
        graph.save();
        
        const tileSize = 200; // Size of each background tile
        
        // Calculate offset for parallax effect (opposite movement)
        const offsetX = (-player.x) % tileSize;
        const offsetY = (-player.y) % tileSize;
        
        graph.globalAlpha = 1; // Make background subtle
        
        // Draw tiles to cover entire screen plus buffer
        for (let x = offsetX - tileSize; x < screen.width + tileSize; x += tileSize) {
            for (let y = offsetY - tileSize; y < screen.height + tileSize; y += tileSize) {
                graph.drawImage(mapImage, x, y, tileSize, tileSize);
            }
        }
        
        graph.restore();
    }
    
    // Draw grid lines over the background
    graph.lineWidth = 0.1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
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