// Performance testing utilities for image rendering
// This file helps test and validate the 60 FPS performance requirement

const PerformanceTest = {
    // Test configuration
    testDuration: 10000, // 10 seconds
    targetFPS: 60,
    isRunning: false,
    
    // Metrics
    frameCount: 0,
    startTime: 0,
    frameTimestamps: [],
    maxFrameTimes: [],
    minFPS: Infinity,
    maxFPS: 0,
    avgFPS: 0,
    
    // Start performance monitoring
    startTest() {
        if (this.isRunning) return;
        
        console.log('Starting performance test...');
        this.isRunning = true;
        this.startTime = performance.now();
        this.frameCount = 0;
        this.frameTimestamps = [];
        this.maxFrameTimes = [];
        
        // Hook into the game loop to measure performance
        const originalRequestAnimFrame = window.requestAnimFrame;
        let lastFrameTime = performance.now();
        
        window.requestAnimFrame = function(callback) {
            return originalRequestAnimFrame(function() {
                const currentTime = performance.now();
                const frameDelta = currentTime - lastFrameTime;
                const currentFPS = 1000 / frameDelta;
                
                PerformanceTest.frameCount++;
                PerformanceTest.frameTimestamps.push(currentTime);
                
                // Track FPS statistics
                if (currentFPS < PerformanceTest.minFPS) PerformanceTest.minFPS = currentFPS;
                if (currentFPS > PerformanceTest.maxFPS) PerformanceTest.maxFPS = currentFPS;
                
                // Track frame times for percentile analysis
                PerformanceTest.maxFrameTimes.push(frameDelta);
                if (PerformanceTest.maxFrameTimes.length > 300) { // Keep last 5 seconds worth
                    PerformanceTest.maxFrameTimes.shift();
                }
                
                lastFrameTime = currentTime;
                
                // Check if test duration reached
                if (currentTime - PerformanceTest.startTime >= PerformanceTest.testDuration) {
                    PerformanceTest.endTest();
                }
                
                callback();
            });
        };
    },
    
    // End the performance test
    endTest() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        const endTime = performance.now();
        const totalDuration = endTime - this.startTime;
        this.avgFPS = (this.frameCount / totalDuration) * 1000;
        
        console.log('Performance test completed!');
        this.generateReport();
    },
    
    // Generate detailed performance report
    generateReport() {
        console.group('Performance Test Results');
        console.log('Test Duration: ' + (this.testDuration / 1000).toFixed(1) + 's');
        console.log('Total Frames: ' + this.frameCount);
        console.log('Average FPS: ' + this.avgFPS.toFixed(2));
        console.log('Min FPS: ' + this.minFPS.toFixed(2));
        console.log('Max FPS: ' + this.maxFPS.toFixed(2));
        
        // Calculate percentiles of frame times
        const sortedFrameTimes = this.maxFrameTimes.slice().sort(function(a, b) { return a - b; });
        const p95 = sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)] || 0;
        const p99 = sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.99)] || 0;
        
        console.log('95th Percentile Frame Time: ' + p95.toFixed(2) + 'ms (' + (1000/p95).toFixed(2) + ' FPS)');
        console.log('99th Percentile Frame Time: ' + p99.toFixed(2) + 'ms (' + (1000/p99).toFixed(2) + ' FPS)');
        
        // Performance assessment
        const targetFrameTime = 1000 / this.targetFPS;
        const performanceRating = this.assessPerformance(targetFrameTime, p95, p99);
        
        console.log('Performance Rating: ' + performanceRating);
        console.groupEnd();
        
        return {
            avgFPS: this.avgFPS,
            minFPS: this.minFPS,
            maxFPS: this.maxFPS,
            p95FrameTime: p95,
            p99FrameTime: p99,
            rating: performanceRating,
            passedTest: this.avgFPS >= this.targetFPS * 0.9
        };
    },
    
    // Assess performance based on frame time percentiles
    assessPerformance(targetFrameTime, p95, p99) {
        if (p95 <= targetFrameTime && p99 <= targetFrameTime * 1.2) {
            return 'Excellent - Consistent 60 FPS';
        } else if (p95 <= targetFrameTime * 1.2 && p99 <= targetFrameTime * 1.5) {
            return 'Good - Occasional frame drops';
        } else if (p95 <= targetFrameTime * 1.5) {
            return 'Fair - Regular frame drops';
        } else {
            return 'Poor - Frequent frame drops, optimization needed';
        }
    },
    
    // Quick test function for development
    quickTest(duration) {
        duration = duration || 5000;
        const originalDuration = this.testDuration;
        this.testDuration = duration;
        this.startTest();
        
        // Restore original duration after test
        var self = this;
        setTimeout(function() {
            self.testDuration = originalDuration;
        }, duration + 100);
    }
};

// Auto-run performance test in development mode
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    // Add to global scope for console access
    window.PerformanceTest = PerformanceTest;
    
    // Add console commands
    console.log('Performance testing available:');
    console.log('- PerformanceTest.quickTest() - Run 5 second test');
    console.log('- PerformanceTest.startTest() - Run full 10 second test');
}

module.exports = PerformanceTest;