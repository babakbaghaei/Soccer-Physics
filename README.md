# فوتبال پیکسلی - Pixel Soccer Game

یک بازی فوتبال پیکسلی مدرن و ماژولار با فیزیک پیشرفته و هوش مصنوعی هوشمند.

## 🎮 ویژگی‌ها

### ✨ ویژگی‌های اصلی
- **فیزیک واقع‌گرایانه**: استفاده از Matter.js برای فیزیک دقیق
- **هوش مصنوعی پیشرفته**: AI هوشمند با رفتارهای مختلف (دفاع، حمله، تعقیب)
- **سیستم Power-up**: قدرت‌های مختلف (سرعت، قدرت، محافظت، آهنربا)
- **آب و هوای پویا**: باران، برف، طوفان با تأثیرات فیزیکی
- **انواع زمین**: زمین معمولی، یخ، شن، ماه با فیزیک متفاوت
- **سیستم گل‌زنی دقیق**: تشخیص خودکار گل با collision detection پیشرفته

### 🎯 مکانیک‌های بازی
- **حرکت روان**: کنترل دقیق بازیکن با WASD
- **پرش و هد**: مکانیک‌های پیشرفته برای تعامل با توپ
- **چیپ شات**: تکنیک خاص برای شوت از روی حریف
- **Screen Shake**: افکت‌های بصری برای تجربه بهتر
- **سیستم امتیازدهی**: آمار کامل بازی

### 🎨 طراحی و رابط کاربری
- **طراحی مدرن**: رابط کاربری زیبا و responsive
- **پیکسل آرت**: گرافیک پیکسلی با کیفیت بالا
- **انیمیشن‌های نرم**: انتقال‌های روان و افکت‌های بصری
- **پشتیبانی از موبایل**: طراحی responsive برای همه دستگاه‌ها

## 🚀 نصب و اجرا

### پیش‌نیازها
- Python 3.x (برای سرور محلی)
- مرورگر مدرن با پشتیبانی از ES6 modules

### نصب
```bash
# Clone repository
git clone https://github.com/yourusername/pixel-soccer-game.git
cd pixel-soccer-game

# Install dependencies (optional)
npm install

# Start development server
npm start
# یا
python3 -m http.server 8000
```

### اجرا
1. مرورگر را باز کنید
2. به آدرس `http://localhost:8000` بروید
3. بازی شروع می‌شود!

## 🎮 کنترل‌ها

### بازیکن انسانی (تیم ۱)
- **حرکت چپ**: `A` یا `←`
- **حرکت راست**: `D` یا `→`
- **پرش**: `W` یا `↑` یا `Space`
- **شوت**: `S`

### کنترل‌های بازی
- **توقف/ادامه**: دکمه "توقف" در رابط کاربری
- **شروع مجدد**: دکمه "شروع مجدد"
- **تغییر آب و هوا**: دکمه‌های آب و هوا
- **تغییر نوع زمین**: دکمه‌های نوع زمین

## �️ معماری پروژه

### ساختار فایل‌ها
```
src/
├── config/
│   └── constants.js          # ثابت‌های بازی
├── game/
│   ├── Game.js              # کلاس اصلی بازی
│   ├── GameState.js         # مدیریت وضعیت بازی
│   ├── Player.js            # کلاس بازیکن
│   ├── Ball.js              # کلاس توپ
│   ├── Field.js             # کلاس زمین
│   └── PowerUpManager.js    # مدیریت power-ups
├── ai/
│   └── AIPlayer.js          # هوش مصنوعی
├── rendering/
│   └── Renderer.js          # سیستم rendering
├── utils/
│   ├── AudioManager.js      # مدیریت صدا
│   └── ParticleSystem.js    # سیستم particle
└── main.js                  # نقطه شروع
```

### ماژول‌های اصلی

#### 🎮 Game.js
کلاس اصلی که همه ماژول‌ها را مدیریت می‌کند:
- مدیریت حلقه بازی
- collision detection
- input handling
- game state management

#### 🎯 Player.js
مدیریت بازیکنان:
- فیزیک حرکت
- power-up effects
- collision handling
- AI integration

#### ⚽ Ball.js
مدیریت توپ:
- فیزیک توپ
- collision detection
- special effects
- boundary handling

#### 🏟️ Field.js
مدیریت زمین:
- goal detection
- field rendering
- physics boundaries
- net drawing

#### 🤖 AIPlayer.js
هوش مصنوعی پیشرفته:
- decision making
- state machine
- tactical behavior
- adaptive strategies

## � تنظیمات و شخصی‌سازی

### تغییر ثابت‌ها
فایل `src/config/constants.js` را ویرایش کنید:
```javascript
// تغییر اندازه canvas
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// تغییر فیزیک بازی
export const JUMP_FORCE = 0.18;
export const MOVE_FORCE = 0.015;
```

### اضافه کردن Power-up جدید
```javascript
// در constants.js
export const POWER_UP_TYPES = [
    // ... existing power-ups
    { type: 'newPower', color: '#FF0000', duration: 5000, effect: 'قدرت جدید' }
];
```

## 🐛 عیب‌یابی

### مشکلات رایج

#### گل ثبت نمی‌شود
- مطمئن شوید که collision detection فعال است
- بررسی کنید که goal areas درست تنظیم شده‌اند

#### عملکرد کند
- مرورگر را به‌روزرسانی کنید
- تب‌های اضافی را ببندید
- تنظیمات PIXELATION_SCALE_FACTOR را کاهش دهید

#### صدا کار نمی‌کند
- مطمئن شوید که مرورگر اجازه پخش صدا دارد
- روی canvas کلیک کنید تا audio context فعال شود

### Debug Mode
برای فعال کردن debug mode:
```javascript
// در Game.js
console.log('Debug info:', {
    ballPosition: this.ball.getPosition(),
    playerPositions: this.players.map(p => p.getPosition()),
    gameState: this.gameState
});
```

## 🤝 مشارکت

### گزارش باگ
1. Issue جدید ایجاد کنید
2. مرورگر و سیستم عامل را مشخص کنید
3. مراحل تکرار باگ را بنویسید
4. Screenshot یا video اضافه کنید

### پیشنهاد ویژگی
1. Issue جدید با برچسب "enhancement" ایجاد کنید
2. توضیح کامل ویژگی پیشنهادی
3. مزایا و کاربردها را بنویسید

### Pull Request
1. Fork کنید
2. Branch جدید ایجاد کنید
3. تغییرات را commit کنید
4. Pull request ارسال کنید

## 📄 لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.

## 🙏 تشکر

- **Matter.js**: برای موتور فیزیک
- **Community**: برای ایده‌ها و بازخورد
- **Contributors**: برای مشارکت‌ها

## 📞 تماس

- **GitHub**: [@yourusername](https://github.com/yourusername)
- **Email**: your.email@example.com
- **Discord**: [Server Link]

---

**لذت ببرید از بازی! ⚽🎮**