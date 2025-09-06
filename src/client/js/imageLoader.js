// Image loader module for caching and preloading game assets
// Provides fallback to geometric shapes if images fail to load

const ImageLoader = {
    // Image cache to store loaded images
    cache: {},
    
    // Loading states
    isLoading: false,
    allImagesLoaded: false,
    failedToLoad: false,
    
    // Image paths relative to img directory
    imagePaths: {
        player: 'img/player.png',
        food: 'img/food.png',
        massFood: 'img/massFood.png',
        virus: 'img/virus.png',
        map: 'img/map.png'
    },
    
    // Load all images and return a promise
    loadAllImages() {
        return new Promise((resolve, reject) => {
            if (this.allImagesLoaded) {
                resolve();
                return;
            }
            
            this.isLoading = true;
            const imageKeys = Object.keys(this.imagePaths);
            let loadedCount = 0;
            let hasError = false;
            
            // Function to check if all images are loaded
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === imageKeys.length) {
                    this.isLoading = false;
                    if (hasError) {
                        this.failedToLoad = true;
                        console.warn('Some images failed to load, using fallback rendering');
                        // Still resolve to allow game to continue with fallbacks
                        resolve();
                    } else {
                        this.allImagesLoaded = true;
                        console.log('All images loaded successfully');
                        resolve();
                    }
                }
            };
            
            // Load each image
            imageKeys.forEach(key => {
                const img = new Image();
                const path = this.imagePaths[key];
                
                img.onload = () => {
                    this.cache[key] = img;
                    console.log(`Loaded image: ${key}`);
                    checkComplete();
                };
                
                img.onerror = () => {
                    console.error(`Failed to load image: ${key} from path: ${path}`);
                    hasError = true;
                    // Store null to indicate failed load
                    this.cache[key] = null;
                    checkComplete();
                };
                
                // Set source last to trigger loading
                img.src = path;
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.isLoading) {
                    this.isLoading = false;
                    this.failedToLoad = true;
                    console.error('Image loading timed out');
                    reject(new Error('Image loading timeout'));
                }
            }, 10000);
        });
    },
    
    // Get an image from cache, returns null if not loaded or failed
    getImage(key) {
        return this.cache[key] || null;
    },
    
    // Check if an image is available
    isImageAvailable(key) {
        return this.cache[key] !== null && this.cache[key] !== undefined;
    },
    
    // Get loading progress (0-1)
    getLoadingProgress() {
        const totalImages = Object.keys(this.imagePaths).length;
        const loadedImages = Object.keys(this.cache).length;
        return loadedImages / totalImages;
    },
    
    // Reset loader state (useful for testing)
    reset() {
        this.cache = {};
        this.isLoading = false;
        this.allImagesLoaded = false;
        this.failedToLoad = false;
    }
};

module.exports = ImageLoader;