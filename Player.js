/**
 * کلاس ساده بازیکن برای استفاده در تست سیستم پاورآپ.
 */
export default class Player {
    /**
     * سازنده کلاس Player.
     * @param {string} name - نام بازیکن.
     * @param {number} x - مختصات x اولیه بازیکن.
     * @param {number} y - مختصات y اولیه بازیکن.
     * @param {number} [speed=2] - سرعت اولیه بازیکن (پیکسل در هر فریم یا آپدیت).
     * @param {number} [width=30] - عرض بازیکن.
     * @param {number} [height=30] - ارتفاع بازیکن.
     * @param {string} [color='blue'] - رنگ بازیکن برای رسم.
     */
    constructor(name, x, y, speed = 2, width = 30, height = 30, color = 'blue') {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.speed = speed;
        this.originalSpeed = speed; // برای ذخیره سرعت اولیه قبل از پاورآپ ها

        this.color = color;

        // ویژگی های دیگری که ممکن است توسط پاورآپ های دیگر استفاده شوند
        this.hasSuperShot = false;
        this.gravityModifier = 1.0;
        // this.originalGravityModifier = 1.0; // اگر پاورآپ جاذبه اضافه شود

        // برای شبیه سازی حرکت در تست (اختیاری)
        this.dx = 0; // تغییرات x در هر فریم
        this.dy = 0; // تغییرات y در هر فریم
    }

    /**
     * بازیکن را روی HTML Canvas رسم می کند.
     * @param {CanvasRenderingContext2D} ctx - کانتکست 2D مربوط به canvas.
     */
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // نمایش نام بازیکن (اختیاری)
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(this.name, this.x, this.y - 5);
    }

    /**
     * موقعیت بازیکن را بر اساس سرعت و جهت حرکت (dx, dy) به روز می کند.
     * این یک متد ساده برای شبیه سازی حرکت در تست است.
     * در بازی واقعی، این منطق پیچیده تر خواهد بود.
     */
    updatePosition() {
        // حرکت بر اساس dx, dy و speed
        // این یک مثال بسیار ساده است، در بازی واقعی ممکن است ورودی کاربر و فیزیک پیچیده تری داشته باشید
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;
    }

    /**
     * جهت حرکت بازیکن را تنظیم می کند (برای تست).
     * @param {number} dx - جهت حرکت در محور x (-1, 0, or 1).
     * @param {number} dy - جهت حرکت در محور y (-1, 0, or 1).
     */
    setMovementDirection(dx, dy) {
        this.dx = dx;
        this.dy = dy;
    }

    // متدهای دیگری که ممکن است برای پاورآپ های دیگر لازم باشند:
    // shoot() {
    //     if (this.hasSuperShot) {
    //         console.log(`${this.name} used SuperShot!`);
    //         this.hasSuperShot = false;
    //         // منطق مربوط به غیرفعال کردن پاورآپ SuperShot از لیست پاورآپ های فعال بازیکن
    //     } else {
    //         console.log(`${this.name} shot normally.`);
    //     }
    // }

    // jump() {
    //     const jumpHeight = 10 * (1 / this.gravityModifier);
    //     console.log(`${this.name} jumped with height ${jumpHeight} (gravity: ${this.gravityModifier})`);
    // }
}

console.log("Player.js loaded");
