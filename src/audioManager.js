const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

async function loadSound(name, url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    sounds[name] = audioBuffer;
}

// Pre-load sounds (assuming assets will be in assets/ folder)
// Note: We need to find or create these sound files.
// For now, we'll stub the functions.
// loadSound('kick', 'assets/kick.wav');
// loadSound('goal', 'assets/goal.wav');
// loadSound('bounce', 'assets/bounce.wav');
// loadSound('jump', 'assets/jump.wav');

function playSound(name) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (sounds[name]) {
        const source = audioContext.createBufferSource();
        source.buffer = sounds[name];
        source.connect(audioContext.destination);
        source.start(0);
    } else {
        console.warn(`Sound not found: ${name}`);
    }
}

export default {
    initAudioContext: () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    },
    playSound
};
