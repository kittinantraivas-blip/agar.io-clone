module.exports = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    borderDraw: false,
    mobile: false,
    // Canvas
    screen: {
        width: window.innerWidth,
        height: window.innerHeight
    },
    game: {
        width: 0,
        height: 0
    },
    gameStart: false,
    disconnected: false,
    kicked: false,
    continuity: false,
    startPingTime: 0,
    toggleMassState: 0,
    backgroundColor: '#000000ff',
    lineColor: '#ffffffff',
    
    // Image loading and rendering configuration
    images: {
        // Loading states
        allLoaded: false,
        failedToLoad: false,
        isLoading: false,
        
        // Performance settings
        useImageCache: true,
        enableImageTinting: true,
        backgroundTileSize: 200,
        
        // Fallback mode toggle
        forceFallback: false, // Set to true to always use geometric shapes
        
        // Image quality settings for performance
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high' // 'low', 'medium', 'high'
    },
    
    // Performance monitoring
    performance: {
        targetFPS: 60,
        lastFrameTime: 0,
        frameCount: 0,
        averageFPS: 0
    }
};
