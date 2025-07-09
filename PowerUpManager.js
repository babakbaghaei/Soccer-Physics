import PowerUp from './PowerUp.js'; // برای استفاده احتمالی از نوع پایه یا چک کردن نوع
import SpeedBoost from './SpeedBoost.js';
// import SuperShot from './SuperShot.js'; // اگر پیاده سازی شوند، import می شوند
// import LowGravity from './LowGravity.js';

/**
 * کلاس PowerUpManager برای مدیریت ایجاد، به روز رسانی، و حذف پاورآپ ها در زمین بازی.
 */
export default class PowerUpManager {
    /**
     * سازنده کلاس PowerUpManager.
     * @param {object} gameArea - آبجکتی با x, y, width, height که محدوده زمین بازی را مشخص می کند.
     * @param {number} [maxPowerupsOnField=3] - حداکثر تعداد پاورآپ هایی که همزمان می توانند در زمین باشند.
     * @param {number} [spawnInterval=10000] - فاصله زمانی (به میلی ثانیه) بین تلاش برای ایجاد پاورآپ های جدید.
     */
    constructor(gameArea, maxPowerupsOnField = 3, spawnInterval = 10000) {
        this.gameArea = gameArea; // e.g., { x: 0, y: 0, width: 800, height: 600 }
        this.maxPowerupsOnField = maxPowerupsOnField;
        this.spawnInterval = spawnInterval;

        this.powerupsOnField = []; // آرایه ای برای نگهداری پاورآپ های فعال در زمین
        this.lastSpawnTime = 0;    // زمان آخرین ایجاد پاورآپ

        // لیست انواع پاورآپ هایی که می توانند ایجاد شوند
        // در آینده می توان این لیست را پویا تر کرد یا با احتمال های مختلف
        this.availablePowerupTypes = [
            SpeedBoost,
            // SuperShot,
            // LowGravity
        ];
        if (this.availablePowerupTypes.length === 0) {
            console.warn("PowerUpManager: No available power-up types defined!");
        }
    }

    /**
     * یک پاورآپ جدید را به صورت تصادفی در یک مکان مجاز از زمین ایجاد می کند.
     */
    spawnPowerup() {
        if (this.availablePowerupTypes.length === 0) {
            // console.warn("Cannot spawn power-up: No types available.");
            return;
        }
        if (this.powerupsOnField.length >= this.maxPowerupsOnField) {
            // console.log("Max power-ups reached, not spawning new one.");
            return;
        }

        // انتخاب یک نوع پاورآپ به صورت تصادفی
        const PowerUpType = this.availablePowerupTypes[Math.floor(Math.random() * this.availablePowerupTypes.length)];

        // تعیین مکان تصادفی برای پاورآپ در محدوده زمین
        // فرض می کنیم پاورآپ ها یک اندازه پیش فرض دارند (مثلا 20x20 از کلاس پایه)
        // این می تواند در خود کلاس پاورآپ تعریف شود و از آن خوانده شود
        const powerupWidth = new PowerUpType(0,0).width; // گرفتن عرض از یک نمونه موقت
        const powerupHeight = new PowerUpType(0,0).height;

        let randX, randY;
        try {
            // اطمینان از اینکه پاورآپ کاملا داخل زمین قرار می گیرد
            randX = this.gameArea.x + Math.random() * (this.gameArea.width - powerupWidth);
            randY = this.gameArea.y + Math.random() * (this.gameArea.height - powerupHeight);
        } catch (e) {
            console.error("Error calculating spawn position. Is gameArea defined correctly?", e);
            return;
        }

        const newPowerup = new PowerUpType(randX, randY); // ایجاد نمونه از نوع انتخاب شده
        this.powerupsOnField.push(newPowerup);
        console.log(`PowerUpManager: Spawned ${newPowerup.constructor.name} at (${randX.toFixed(0)}, ${randY.toFixed(0)})`);
    }

    /**
     * وضعیت همه پاورآپ ها را به روز می کند، برخورد با بازیکنان را بررسی می کند
     * و پاورآپ های منقضی شده یا نامرئی را حذف می کند.
     * @param {number} currentTime - زمان فعلی (timestamp از Date.now()).
     * @param {Array<object>} players - آرایه ای از آبجکت های بازیکنان حاضر در بازی.
     */
    update(currentTime, players) {
        // تلاش برای ایجاد پاورآپ جدید در فواصل زمانی معین
        if (this.lastSpawnTime === 0) this.lastSpawnTime = currentTime; // برای اولین اجرا
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            this.spawnPowerup();
            this.lastSpawnTime = currentTime;
        }

        // به روز رسانی و بررسی برخورد برای هر پاورآپ
        // پیمایش معکوس برای حذف ایمن از آرایه در حین پیمایش
        for (let i = this.powerupsOnField.length - 1; i >= 0; i--) {
            const powerup = this.powerupsOnField[i];
            powerup.update(currentTime);

            if (!powerup.visible) { // پاورآپ استفاده شده یا زمانش تمام شده و نامرئی گشته
                this.powerupsOnField.splice(i, 1); // حذف از آرایه
                console.log(`PowerUpManager: Removed ${powerup.constructor.name} from field.`);
                continue;
            }

            // اگر پاورآپ قابل مشاهده و هنوز فعال نشده، برخورد را بررسی کن
            if (powerup.visible && !powerup.isActive) {
                for (const player of players) {
                    if (powerup.checkCollision(player)) {
                        powerup.activate(player);
                        // در اینجا تصمیم می گیریم که آیا پاورآپ پس از فعال سازی بلافاصله از لیست حذف شود یا خیر.
                        // منطق فعلی PowerUp.js این است که پس از deactivate شدن visible = false می شود
                        // و سپس در پیمایش بعدی در اینجا حذف می گردد. این خوب است.
                        break; // یک پاورآپ فقط توسط یک بازیکن در یک تیک می تواند فعال شود
                    }
                }
            }
        }
    }

    /**
     * همه پاورآپ های قابل مشاهده را روی صفحه نمایش می دهد.
     * @param {CanvasRenderingContext2D} ctx - کانتکست 2D مربوط به canvas.
     */
    draw(ctx) {
        for (const powerup of this.powerupsOnField) {
            if (powerup.visible) {
                powerup.draw(ctx);
            }
        }
    }

    /**
     * همه پاورآپ ها را از زمین پاک می کند و زمان سنج ایجاد را ریست می کند.
     * (مفید برای شروع مجدد بازی یا مرحله)
     */
    reset() {
        for (const powerup of this.powerupsOnField) {
            if (powerup.isActive && powerup.affectedPlayer) {
                // اطمینان از اینکه اثرات از بازیکنان حذف می شوند
                // متد deactivate خود پاورآپ این کار را انجام می دهد.
                powerup.deactivate();
            }
        }
        this.powerupsOnField = [];
        this.lastSpawnTime = 0; // یا Date.now() اگر می خواهید بلافاصله پس از ریست شروع به شمارش کند
        console.log("PowerUpManager: Reset complete. All power-ups removed.");
    }
}

console.log("PowerUpManager.js loaded");
