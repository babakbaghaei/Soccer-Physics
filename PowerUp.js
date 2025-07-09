/**
 * کلاس پایه برای همه پاورآپ ها در بازی.
 * طراحی شده برای استفاده با HTML Canvas و ماژول های ES6.
 */
export default class PowerUp {
    /**
     * سازنده کلاس PowerUp.
     * @param {number} x - مختصات x پاورآپ.
     * @param {number} y - مختصات y پاورآپ.
     * @param {number} [duration=5000] - مدت زمان اثر پاورآپ به میلی ثانیه.
     * @param {number} [width=20] - عرض پاورآپ برای برخورد و رسم.
     * @param {number} [height=20] - ارتفاع پاورآپ برای برخورد و رسم.
     */
    constructor(x, y, duration = 5000, width = 20, height = 20) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.duration = duration; // میلی ثانیه

        this.visible = true;    // آیا پاورآپ باید رسم شود؟
        this.isActive = false;  // آیا پاورآپ فعال شده است؟
        this.activationTime = 0;// زمانی که پاورآپ فعال شد (timestamp)
        this.affectedPlayer = null; // بازیکنی که پاورآپ را برداشته است

        this.color = 'gray'; // رنگ پیش فرض برای رسم (می تواند در کلاس فرزند تغییر کند)
    }

    /**
     * پاورآپ را برای بازیکن مشخص شده فعال می کند.
     * @param {object} player - آبجکت بازیکنی که پاورآپ را برداشته است.
     */
    activate(player) {
        if (!this.isActive) {
            this.isActive = true;
            this.activationTime = Date.now(); // زمان فعلی به عنوان زمان فعال سازی
            this.affectedPlayer = player;
            this.applyEffect(player);
            console.log(`${this.constructor.name} for player ${player.name || 'Unknown'} activated.`);
        }
    }

    /**
     * پاورآپ را غیرفعال می کند و اثر آن را از بازیکن حذف می کند.
     */
    deactivate() {
        if (this.isActive && this.affectedPlayer) {
            this.removeEffect(this.affectedPlayer);
            console.log(`${this.constructor.name} for player ${this.affectedPlayer.name || 'Unknown'} deactivated.`);
        }
        this.isActive = false;
        this.activationTime = 0;
        this.affectedPlayer = null;
        this.visible = false; // پس از استفاده یا اتمام زمان، دیگر قابل مشاهده و استفاده نیست
    }

    /**
     * اثر پاورآپ را روی بازیکن اعمال می کند.
     * این متد باید در کلاس های فرزند بازنویسی شود.
     * @param {object} player - بازیکنی که اثر روی آن اعمال می شود.
     */
    applyEffect(player) {
        console.warn(`applyEffect() not implemented for ${this.constructor.name}`);
    }

    /**
     * اثر پاورآپ را از بازیکن حذف می کند.
     * این متد باید در کلاس های فرزند بازنویسی شود.
     * @param {object} player - بازیکنی که اثر از روی آن حذف می شود.
     */
    removeEffect(player) {
        console.warn(`removeEffect() not implemented for ${this.constructor.name}`);
    }

    /**
     * وضعیت پاورآپ را به روز می کند.
     * اگر پاورآپ فعال باشد و زمان آن تمام شده باشد، آن را غیرفعال می کند.
     * @param {number} currentTime - زمان فعلی (timestamp از Date.now()).
     */
    update(currentTime) {
        if (this.isActive && (currentTime - this.activationTime > this.duration)) {
            this.deactivate();
        }
    }

    /**
     * پاورآپ را روی HTML Canvas رسم می کند.
     * @param {CanvasRenderingContext2D} ctx - کانتکست 2D مربوط به canvas.
     */
    draw(ctx) {
        if (this.visible) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    /**
     * برخورد پاورآپ با بازیکن را بررسی می کند.
     * از الگوریتم برخورد مستطیل با مستطیل (AABB) استفاده می کند.
     * @param {object} player - آبجکت بازیکن. بازیکن باید ویژگی های x, y, width, height داشته باشد.
     * @returns {boolean} - True اگر برخورد وجود داشته باشد، در غیر این صورت False.
     */
    checkCollision(player) {
        if (!player || typeof player.x === 'undefined' || typeof player.y === 'undefined' ||
            typeof player.width === 'undefined' || typeof player.height === 'undefined') {
            // console.warn('Player object for collision check is invalid or lacks dimensions.');
            return false;
        }

        // AABB collision detection
        return (
            this.x < player.x + player.width &&
            this.x + this.width > player.x &&
            this.y < player.y + player.height &&
            this.y + this.height > player.y
        );
    }
}

console.log("PowerUp.js loaded");
