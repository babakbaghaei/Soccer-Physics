# ⚽ Soccer Physics Game - MVP

A hilarious physics-based soccer game featuring ragdoll players, one-button controls, and chaotic gameplay!

## 🎮 Features

✅ **One-button controls** - Simple and accessible gameplay  
✅ **Ragdoll physics** - Hilarious player movements using Matter.js  
✅ **2v2 local multiplayer** - Four players on one keyboard  
✅ **Pixelated 3D field** - Retro aesthetic with modern physics  
✅ **Goal scoring system** - Complete with goal detection  
✅ **Score tracking** - Real-time scoreboard  
✅ **Comical animations** - Wobbly ragdoll players with funny eyes  
✅ **Ball and player collisions** - Realistic physics interactions  
✅ **Single round matches** - 60-second games with timer  

## 🚀 Quick Start

1. **Open `index.html`** in any modern web browser
2. **Click "START GAME"** to begin
3. **Use your assigned keys** to control your player
4. **Score goals** by getting the ball into the opponent's goal
5. **Win** by having the most goals when time runs out!

## 🎮 Controls

### Team 1 (Pink Team) - Left Side
- **Player 1**: Press `A` to jump/kick
- **Player 2**: Press `S` to jump/kick

### Team 2 (Sky Blue Team) - Right Side  
- **Player 1**: Press `K` to jump/kick
- **Player 2**: Press `L` to jump/kick

### Game Controls
- **START GAME**: Begin a new match
- **RESET**: Reset the current game
- **PLAY AGAIN**: Start over after game ends

## 🎯 How to Play

1. **Objective**: Score more goals than the opposing team within 60 seconds
2. **Movement**: Players are ragdolls! Press your button to jump and move toward the ball
3. **Kicking**: Get close to the ball and press your button to kick it
4. **Scoring**: Get the ball into the opponent's goal area
5. **Strategy**: Work with your teammate to control the ball and score!

## 🎨 Game Features

### Physics System
- **Realistic ragdoll physics** using Matter.js engine
- **Ball bouncing** with proper collision detection
- **Player-ball interactions** with momentum transfer
- **Gravity and friction** for authentic movement

### Visual Design
- **Pixelated 3D aesthetic** with pastel colors and depth effects
- **3D character models** with highlights and shadows
- **Animated grass patterns** for field texture  
- **Dynamic ball trails** when moving fast
- **Screen flash effects** when goals are scored
- **Bouncing title animation** and smooth UI
- **Pastel color palette** for a soft, modern look

### Game Mechanics
- **60-second matches** with countdown timer
- **Automatic goal detection** and scoring
- **Player positioning reset** after each goal
- **Kick cooldown** to prevent button spamming
- **Random movement elements** for comedic effect

## 🛠️ Technical Details

### Technologies Used
- **HTML5 Canvas** for rendering
- **Matter.js** for 2D physics simulation
- **CSS3** for styling and animations
- **JavaScript ES6+** for game logic
- **Google Fonts** for pixel-perfect typography

### Browser Compatibility
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Any modern browser with HTML5 Canvas support

## 🎪 Tips for Maximum Fun

1. **Embrace the chaos** - The ragdoll physics are intentionally silly!
2. **Time your jumps** - Wait for the right moment to kick the ball
3. **Work as a team** - Coordinate with your teammate
4. **Practice positioning** - Get close to the ball before pressing your button
5. **Have fun** - It's all about the laughs and good times!

## 🏆 Game Modes

**Current**: Single Match Mode
- 60-second rounds
- 2v2 local multiplayer
- Score tracking
- Winner determination

## 🔧 Customization

Want to modify the game? Here are some easy tweaks you can make in `game.js`:

```javascript
// Game duration (line ~15)
this.gameTime = 60; // Change to desired seconds

// Physics gravity (line ~18)  
this.engine.world.gravity.y = 0.8; // Higher = more gravity

// Player jump force (line ~285)
const force = 0.02; // Higher = stronger jumps

// Ball kick force (line ~305)
const kickForce = 0.03; // Higher = stronger kicks
```

## 🐛 Known Issues

- Players may occasionally get stuck in goal posts (part of the fun!)
- Ball may rarely clip through boundaries at high speeds
- Ragdoll physics can be unpredictable (this is intentional!)

## 🚀 Future Enhancements

Potential additions for future versions:
- [ ] Tournament mode with multiple rounds
- [ ] Power-ups and special abilities
- [ ] Different field environments
- [ ] AI opponents for single-player mode
- [ ] Online multiplayer support
- [ ] Replay system
- [ ] Customizable team colors

---

**Enjoy the chaotic fun of Soccer Physics!** ⚽🎮