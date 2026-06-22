const util = require("./util");

function getPosition(isUniform, radius, uniformPositions) {
    return isUniform ? util.uniformPosition(uniformPositions, radius) : util.randomPosition(radius);
}

function isVisibleEntity(entity, player, addThreshold = true) {
    const entityHalfSize = entity.radius + (addThreshold ? entity.radius * 0.1 : 0);
    return util.testRectangleRectangle(
        entity.x, entity.y, entityHalfSize, entityHalfSize,
        player.x, player.y, player.screenWidth / 2, player.screenHeight / 2);
}

// Slim projection of a player containing only the fields the client needs to
// render. Avoids sending internal fields (lastHeartbeat, screen size, target,
// admin, ...) over the wire. Shared between per-player and spectator updates.
function extractPlayerData(player) {
    return {
        x: player.x,
        y: player.y,
        cells: player.cells,
        massTotal: Math.round(player.massTotal),
        hue: player.hue,
        id: player.id,
        name: player.name,
        skinUrl: player.skinUrl || null,
        overlayColor: player.overlayColor || null,
        turretUrl: player.turretUrl || null
    };
}

module.exports = {
    getPosition,
    isVisibleEntity,
    extractPlayerData
}
