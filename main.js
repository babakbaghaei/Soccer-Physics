import Player from './Player.js';
import PowerUpManager from './PowerUpManager.js';
// SpeedBoost به طور خودکار توسط PowerUpManager وارد و استفاده می شود، اما اگر بخواهیم مستقیما نمونه بسازیم، import می کنیم.
// import SpeedBoost from './SpeedBoost.js';

console.log("main.js starting...");

// تنظیمات اولیه Canvas
const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    throw new Error('Canvas element not found!');
}
const ctx = canvas.getContext('2d');

// ابعاد زمین بازی (می تواند از ابعاد canvas گرفته شود)
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// ایجاد بازیکن
const player1 = new Player("P1", 50, GAME_HEIGHT / 2 - 15, 2, 30, 30, 'dodgerblue');
// برای تست برخورد، می توانیم به بازیکن اجازه حرکت دهیم
// player1.setMovementDirection(1, 0); // حرکت به راست

// ایجاد مدیر پاورآپ
const gameArea = { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT };
const powerUpManager = new PowerUpManager(gameArea, 3, 5000); // هر 5 ثانیه یک پاورآپ جدید (حداکثر 3 تا)

// لیست بازیکنان (در بازی واقعی این لیست پویا خواهد بود)
const players = [player1];

let lastTime = 0;

/**
 * حلقه اصلی بازی برای به روز رسانی و رسم.
 * @param {number} timestamp - زمان فعلی که توسط requestAnimationFrame پاس داده می شود.
 */
function gameLoop(timestamp) {
    if (!ctx) return; // اگر context وجود نداشته باشد، ادامه نده

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // 1. پاک کردن Canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. به روز رسانی وضعیت ها
    // player1.updatePosition(); // اگر بازیکن حرکت می کند

    // بررسی مرزهای زمین برای بازیکن (مثال ساده)
    // if (player1.x + player1.width > GAME_WIDTH) player1.x = GAME_WIDTH - player1.width;
    // if (player1.x < 0) player1.x = 0;

    powerUpManager.update(Date.now(), players); // Date.now() برای زمان فعلی

    // 3. رسم همه چیز
    player1.draw(ctx);
    powerUpManager.draw(ctx);

    // درخواست فریم بعدی
    requestAnimationFrame(gameLoop);
}

// شروع حلقه بازی
console.log("Starting game loop...");
requestAnimationFrame(gameLoop);

// --- کنترل های ساده برای تست حرکت بازیکن (اختیاری) ---
// این بخش برای تست ساده برخورد است. در بازی واقعی سیستم کنترل پیچیده تری خواهید داشت.
document.addEventListener('keydown', (event) => {
    // به جای استفاده از یک مقدار ثابت، از سرعت خود بازیکن استفاده می کنیم
    // تا اثر SpeedBoost در کنترل های کیبورد نیز مشهود باشد.
    // مقدار جابجایی می تواند مضربی از سرعت بازیکن باشد.
    const moveAmount = player1.speed * 2; // مثال: دو برابر سرعت پایه بازیکن

    switch (event.key) {
        case 'ArrowLeft':
            player1.x -= moveAmount;
            if(player1.x < 0) player1.x = 0;
            break;
        case 'ArrowRight':
            player1.x += moveAmount;
            if(player1.x + player1.width > GAME_WIDTH) player1.x = GAME_WIDTH - player1.width;
            break;
        case 'ArrowUp':
            player1.y -= moveAmount;
            if(player1.y < 0) player1.y = 0;
            break;
        case 'ArrowDown':
            player1.y += moveAmount;
            if(player1.y + player1.height > GAME_HEIGHT) player1.y = GAME_HEIGHT - player1.height;
            break;
    }
});

console.log("Player controls (Arrow Keys) are active for P1.");
console.log("To test, open index.html in a browser that supports ES6 Modules (e.g., Chrome, Firefox, Edge).");
console.log("You might need to serve the files via a local web server (e.g., using 'Live Server' extension in VS Code, or 'python -m http.server').");
