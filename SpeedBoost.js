import PowerUp from './PowerUp.js';

/**
 * کلاس SpeedBoost که سرعت بازیکن را برای مدت معینی افزایش می دهد.
 * از کلاس PowerUp ارث بری می کند.
 */
export default class SpeedBoost extends PowerUp {
    /**
     * سازنده کلاس SpeedBoost.
     * @param {number} x - مختصات x پاورآپ.
     * @param {number} y - مختصات y پاورآپ.
     * @param {number} [duration=5000] - مدت زمان اثر پاورآپ به میلی ثانیه.
     * @param {number} [boostFactor=1.5] - ضریب افزایش سرعت (مثلاً 1.5 برای 50% افزایش).
     */
    constructor(x, y, duration = 5000, boostFactor = 1.5) {
        super(x, y, duration); // فراخوانی سازنده کلاس پدر (PowerUp)
        this.boostFactor = boostFactor;
        this.color = 'green'; // رنگ خاص برای SpeedBoost
    }

    /**
     * اثر افزایش سرعت را روی بازیکن اعمال می کند.
     * @param {object} player - آبجکت بازیکن. بازیکن باید ویژگی speed داشته باشد.
     */
    applyEffect(player) {
        if (typeof player.speed === 'undefined') {
            console.warn(`Player object for SpeedBoost does not have a 'speed' property.`);
            return;
        }

        // ذخیره سرعت اصلی بازیکن اگر قبلاً ذخیره نشده یا پاورآپ سرعت دیگری فعال نیست
        // این منطق می تواند پیچیده تر شود اگر چندین پاورآپ سرعت بتوانند همزمان اعمال شوند
        if (typeof player.originalSpeed === 'undefined' || player.originalSpeed === player.speed) {
            player.originalSpeed = player.speed;
        }

        player.speed *= this.boostFactor;
        console.log(`SpeedBoost applied to player ${player.name || 'Unknown'}. New speed: ${player.speed.toFixed(2)} (Original: ${player.originalSpeed.toFixed(2)})`);
    }

    /**
     * اثر افزایش سرعت را از بازیکن حذف می کند و سرعت را به حالت اولیه بازمی گرداند.
     * @param {object} player - آبجکت بازیکن.
     */
    removeEffect(player) {
        if (typeof player.speed === 'undefined' || typeof player.originalSpeed === 'undefined') {
            console.warn(`Cannot remove SpeedBoost effect: 'speed' or 'originalSpeed' missing on player.`);
            return;
        }

        // بازگرداندن سرعت به مقدار اصلی ذخیره شده
        player.speed = player.originalSpeed;
        // می توان originalSpeed را undefined کرد یا به مقدار قبلی speed برگرداند اگر پاورآپ های تو در تو مدیریت شوند
        // برای سادگی، فعلا فقط به originalSpeed برمی گردانیم.
        // اگر بخواهیم از تداخل چند پاورآپ سرعت جلوگیری کنیم، باید یک سیستم صف یا اولویت بندی برای پاورآپ ها داشته باشیم.
        console.log(`SpeedBoost removed from player ${player.name || 'Unknown'}. Speed restored to: ${player.speed.toFixed(2)}`);
    }

    /**
     * (اختیاری) بازنویسی متد draw برای نمایش متفاوت.
     * در اینجا از همان draw کلاس پدر استفاده می کنیم، فقط رنگ را در constructor تغییر دادیم.
     * اگر می خواهید شکل خاصی بکشید، این متد را بازنویسی کنید.
     * draw(ctx) {
     *     if (this.visible) {
     *         ctx.fillStyle = this.color;
     *         // کد رسم سفارشی برای SpeedBoost، مثلا یک فلش یا نماد سرعت
     *         ctx.fillRect(this.x, this.y, this.width, this.height); // مثال ساده
     *         ctx.fillStyle = 'white';
     *         ctx.fillText("S", this.x + this.width / 4, this.y + this.height * 0.75);
     *     }
     * }
     */
}

console.log("SpeedBoost.js loaded");
