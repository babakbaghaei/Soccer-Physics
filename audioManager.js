// ===================================================================================
// Audio Manager for Soccer Game
// ===================================================================================

// Audio context and sounds
let audioContext;
let sounds = {};

// Sound file URLs (you can replace these with actual sound files)
const SOUND_URLS = {
    kick: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
    goal: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
    jump: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
    whistle: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
};

// ===================================================================================
// Audio Initialization
// ===================================================================================
function initializeAudio() {
    try {
        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load all sounds
        loadSounds();
        
        console.log("Audio system initialized successfully");
    } catch (error) {
        console.warn("Audio initialization failed:", error);
    }
}

// ===================================================================================
// Sound Loading
// ===================================================================================
async function loadSounds() {
    for (const [soundName, url] of Object.entries(SOUND_URLS)) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            sounds[soundName] = audioBuffer;
        } catch (error) {
            console.warn(`Failed to load sound: ${soundName}`, error);
        }
    }
}

// ===================================================================================
// Sound Playback
// ===================================================================================
function playSound(soundName, volume = 0.5) {
    if (!audioContext || !sounds[soundName]) {
        console.warn(`Sound not available: ${soundName}`);
        return;
    }
    
    try {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = sounds[soundName];
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
    } catch (error) {
        console.warn(`Failed to play sound: ${soundName}`, error);
    }
}

// ===================================================================================
// Sound Effects
// ===================================================================================
function playKickSound() {
    playSound('kick', 0.6);
}

function playGoalSound() {
    playSound('goal', 0.8);
}

function playJumpSound() {
    playSound('jump', 0.4);
}

function playWhistleSound() {
    playSound('whistle', 0.7);
}

// ===================================================================================
// Export Functions
// ===================================================================================
window.initializeAudio = initializeAudio;
window.playKickSound = playKickSound;
window.playGoalSound = playGoalSound;
window.playJumpSound = playJumpSound;
window.playWhistleSound = playWhistleSound;
