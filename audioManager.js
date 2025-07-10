// ===================================================================================
// Audio Manager
// ===================================================================================

// Audio context and sounds
let audioContext;
let sounds = {};

// ===================================================================================
// Audio Initialization
// ===================================================================================
function initializeAudio() {
    console.log("Initializing audio...");
    
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create simple sound effects
        createJumpSound();
        createKickSound();
        createGoalSound();
        
        console.log("Audio initialized successfully");
    } catch (error) {
        console.warn("Audio initialization failed:", error);
    }
}

// ===================================================================================
// Sound Creation Functions
// ===================================================================================
function createJumpSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.warn("Jump sound creation failed:", error);
    }
}

function createKickSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.05);
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
    } catch (error) {
        console.warn("Kick sound creation failed:", error);
    }
}

function createGoalSound() {
    try {
        // Create a sequence of tones for goal celebration
        const frequencies = [523, 659, 784, 1047]; // C, E, G, C (octave)
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime + index * 0.1);
            oscillator.stop(audioContext.currentTime + index * 0.1 + 0.2);
        });
    } catch (error) {
        console.warn("Goal sound creation failed:", error);
    }
}

// ===================================================================================
// Public Audio Functions
// ===================================================================================
function playJumpSound() {
    if (audioContext && audioContext.state === 'running') {
        createJumpSound();
    }
}

function playKickSound() {
    if (audioContext && audioContext.state === 'running') {
        createKickSound();
    }
}

function playGoalSound() {
    if (audioContext && audioContext.state === 'running') {
        createGoalSound();
    }
}

// ===================================================================================
// Export Functions
// ===================================================================================
window.initializeAudio = initializeAudio;
window.playJumpSound = playJumpSound;
window.playKickSound = playKickSound;
window.playGoalSound = playGoalSound;

// Initialize audio when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Initialize audio after a user interaction
    document.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
});
