import time

class PowerUp:
    def __init__(self, x, y, duration=5, visible=True):
        """
        کلاس پایه برای پاورآپ ها

        آرگومان ها:
            x (int): مختصات x پاورآپ در زمین
            y (int): مختصات y پاورآپ در زمین
            duration (int, optional): مدت زمان اثر پاورآپ به ثانیه. پیش فرض 5 است.
            visible (bool, optional): آیا پاورآپ قابل مشاهده است یا خیر. پیش فرض True است.
        """
        self.x = x
        self.y = y
        self.duration = duration
        self.visible = visible
        self.is_active = False
        self.activation_time = 0
        self.affected_player = None

    def activate(self, player):
        """
        پاورآپ را برای بازیکن مشخص شده فعال می کند.
        """
        if not self.is_active:
            self.is_active = True
            self.activation_time = time.time()
            self.affected_player = player
            self.apply_effect(player)
            print(f"{self.__class__.__name__} برای بازیکن {player} فعال شد.") # برای تست

    def deactivate(self):
        """
        پاورآپ را غیرفعال می کند و اثر آن را از بازیکن حذف می کند.
        """
        if self.is_active and self.affected_player:
            self.remove_effect(self.affected_player)
            print(f"{self.__class__.__name__} برای بازیکن {self.affected_player} غیرفعال شد.") # برای تست
        self.is_active = False
        self.activation_time = 0
        self.affected_player = None
        self.visible = False # پس از استفاده، پاورآپ دیگر قابل مشاهده و استفاده نیست

    def apply_effect(self, player):
        """
        اثر پاورآپ را روی بازیکن اعمال می کند.
        این متد باید در کلاس های فرزند بازنویسی شود.
        """
        raise NotImplementedError("این متد باید در کلاس فرزند پیاده سازی شود.")

    def remove_effect(self, player):
        """
        اثر پاورآپ را از بازیکن حذف می کند.
        این متد باید در کلاس های فرزند بازنویسی شود.
        """
        raise NotImplementedError("این متد باید در کلاس فرزند پیاده سازی شود.")

    def update(self):
        """
        وضعیت پاورآپ را به روز می کند.
        اگر پاورآپ فعال باشد و زمان آن تمام شده باشد، آن را غیرفعال می کند.
        """
        if self.is_active and (time.time() - self.activation_time > self.duration):
            self.deactivate()

    def draw(self, screen):
        """
        پاورآپ را روی صفحه نمایش می دهد.
        این متد باید با توجه به نحوه نمایش در بازی شما پیاده سازی شود
        (مثلاً با استفاده از Pygame یا کتابخانه گرافیکی دیگر).
        در اینجا یک نمایش ساده متنی ارائه می شود.
        """
        if self.visible:
            # این بخش باید با کد واقعی رسم جایگزین شود
            # برای مثال، اگر از Pygame استفاده می کنید:
            # import pygame
            # color = (255, 0, 0) # قرمز به عنوان مثال
            # pygame.draw.rect(screen, color, (self.x, self.y, 20, 20)) # یک مربع 20x20
            print(f"پاورآپ در ({self.x}, {self.y}) نمایش داده می شود.") # برای تست

    def check_collision(self, player_rect):
        """
        برخورد پاورآپ با بازیکن را بررسی می کند.
        فرض می کنیم بازیکن یک مستطیل (rect) است.
        این متد باید با توجه به نحوه تشخیص برخورد در بازی شما پیاده سازی شود.
        """
        # یک نمونه ساده برای تشخیص برخورد مستطیلی
        powerup_rect = (self.x, self.y, 20, 20) # فرض می کنیم پاورآپ یک مربع 20x20 است
        # player_rect باید چیزی شبیه (player.x, player.y, player.width, player.height) باشد

        # بررسی برخورد افقی
        x_collision = (powerup_rect[0] < player_rect[0] + player_rect[2] and
                       powerup_rect[0] + powerup_rect[2] > player_rect[0])
        # بررسی برخورد عمودی
        y_collision = (powerup_rect[1] < player_rect[1] + player_rect[3] and
                       powerup_rect[1] + powerup_rect[3] > player_rect[1])

        return x_collision and y_collision

# مثال نحوه استفاده (این بخش باید در کد اصلی بازی شما باشد):
# class Player:
#     def __init__(self, name="P1", x=0, y=0, width=30, height=30):
#         self.name = name
#         self.x = x
#         self.y = y
#         self.width = width
#         self.height = height
#         self.original_speed = 5
#         self.speed = self.original_speed
#
#     def get_rect(self):
#         return (self.x, self.y, self.width, self.height)
#
# # در حلقه اصلی بازی:
# # player1 = Player()
# # speed_boost_powerup = PowerUp(x=100, y=100, duration=7) # یک پاورآپ نمونه
#
# # # شبیه سازی به روز رسانی و رسم
# # if speed_boost_powerup.visible:
# #     speed_boost_powerup.draw(None) # None به جای screen برای تست
# #     speed_boost_powerup.update()
#
# # # شبیه سازی برخورد
# # if speed_boost_powerup.visible and speed_boost_powerup.check_collision(player1.get_rect()):
# #     # speed_boost_powerup.activate(player1) # این خط در کلاس فرزند تعریف می شود
# #     pass
#
# # # شبیه سازی برداشتن اثر بعد از مدتی
# # # این کار توسط متد update پاورآپ انجام می شود.
#
# # # برای تست غیرفعال سازی دستی
# # # time.sleep(8)
# # # speed_boost_powerup.update() # باید غیرفعال شود
#
# # # اگر بخواهیم یک پاورآپ خاص بسازیم، مثلا SpeedBoost
# class SpeedBoost(PowerUp):
#     def __init__(self, x, y, duration=5, boost_factor=2):
#         super().__init__(x, y, duration)
#         self.boost_factor = boost_factor
#
#     def apply_effect(self, player):
#         # فرض می کنیم بازیکن یک ویژگی speed دارد
#         player.original_speed = player.speed # ذخیره سرعت اصلی
#         player.speed *= self.boost_factor
#         print(f"سرعت بازیکن {player.name} به {player.speed} افزایش یافت.")
#
#     def remove_effect(self, player):
#         # بازگرداندن سرعت به حالت اولیه
#         player.speed = player.original_speed
#         print(f"سرعت بازیکن {player.name} به {player.speed} بازگشت.")
#
# # player1 = Player("بازیکن 1")
# # speed_powerup_instance = SpeedBoost(x=50, y=50, duration=3)
# #
# # # شبیه سازی برخورد و فعال سازی
# # if speed_powerup_instance.visible and speed_powerup_instance.check_collision(player1.get_rect()):
# #     speed_powerup_instance.activate(player1)
# #
# # # شبیه سازی حلقه بازی
# # start_time = time.time()
# # while speed_powerup_instance.is_active:
# #     time.sleep(0.1)
# #     speed_powerup_instance.update()
# #     # در اینجا بازیکن با سرعت بیشتر حرکت می کند
# #     print(f"زمان گذشته: {time.time() - start_time:.1f} ثانیه، سرعت بازیکن: {player1.speed}")
# #
# # print(f"پاورآپ دیگر فعال نیست. سرعت نهایی بازیکن: {player1.speed}")

print("کلاس پایه PowerUp و کلاس های نمونه ایجاد شدند.")


# ----------------------------------------------------
# کلاس های پاورآپ نمونه
# ----------------------------------------------------

class SpeedBoost(PowerUp):
    def __init__(self, x, y, duration=5, boost_factor=2):
        super().__init__(x, y, duration)
        self.boost_factor = boost_factor
        # ممکن است بخواهید یک رنگ یا اسپرایت خاص برای این پاورآپ تعریف کنید
        # self.color = (0, 255, 0) # سبز

    def apply_effect(self, player):
        """
        سرعت بازیکن را افزایش می دهد.
        فرض می کنیم بازیکن دارای ویژگی 'speed' و 'original_speed' است.
        """
        if not hasattr(player, 'original_speed'):
            player.original_speed = player.speed # ذخیره سرعت اولیه اگر قبلا ذخیره نشده

        player.speed *= self.boost_factor
        print(f"SpeedBoost: سرعت بازیکن {player.name} به {player.speed} افزایش یافت.")

    def remove_effect(self, player):
        """
        سرعت بازیکن را به حالت اولیه بازمی گرداند.
        """
        player.speed = player.original_speed
        # del player.original_speed # یا می توان آن را نگه داشت برای پاورآپ های دیگر
        print(f"SpeedBoost: سرعت بازیکن {player.name} به {player.speed} بازگشت.")

    def draw(self, screen):
        if self.visible:
            # مثال: رسم یک مستطیل سبز برای SpeedBoost
            # import pygame
            # color = (0, 255, 0)
            # pygame.draw.rect(screen, color, (self.x, self.y, 20, 20))
            print(f"SpeedBoost در ({self.x}, {self.y}) نمایش داده می شود.") # برای تست


class SuperShot(PowerUp):
    def __init__(self, x, y, duration=10): # مدت زمان برای باقی ماندن روی زمین
        super().__init__(x, y, duration)
        # self.color = (255, 255, 0) # زرد

    def activate(self, player):
        """
        پاورآپ را برای بازیکن مشخص شده فعال می کند.
        برای SuperShot، پس از فعال سازی، اثر آن دائمی است تا زمانی که شوت زده شود.
        مدت زمان در اینجا بیشتر برای کنترل حذف از زمین است.
        """
        if not self.is_active:
            self.is_active = True
            # زمان فعال سازی را برای کنترل حذف از زمین تنظیم می کنیم
            self.activation_time = time.time()
            self.affected_player = player
            self.apply_effect(player)
            print(f"{self.__class__.__name__} برای بازیکن {player.name} فعال شد.")
            # این پاورآپ پس از اعمال اثر بلافاصله از زمین حذف نمی شود،
            # بلکه تا زمانی که بازیکن شوت بزند یا زمانش تمام شود باقی می ماند.
            # یا می توانیم تصمیم بگیریم که پس از فعال سازی و اعمال اثر، بلافاصله ناپدید شود.
            # self.visible = False # اگر بخواهیم بلافاصله پس از برخورد ناپدید شود

    def apply_effect(self, player):
        """
        به بازیکن قابلیت شوت گل شونده می دهد.
        فرض می کنیم بازیکن دارای ویژگی 'has_super_shot' است.
        """
        player.has_super_shot = True
        print(f"SuperShot: بازیکن {player.name} اکنون شوت گل شونده دارد.")

    def remove_effect(self, player):
        """
        قابلیت شوت گل شونده را از بازیکن حذف می کند.
        این متد معمولاً زمانی فراخوانی می شود که بازیکن از شوت استفاده کرده باشد،
        یا زمان پاورآپ به پایان رسیده باشد (اگرچه در این پیاده سازی، اثر تا استفاده باقی می ماند).
        """
        if hasattr(player, 'has_super_shot'):
            player.has_super_shot = False
        print(f"SuperShot: قابلیت شوت گل شونده از بازیکن {player.name} حذف شد.")

    def update(self):
        """
        وضعیت پاورآپ را به روز می کند.
        اگر زمان پاورآپ تمام شده باشد، آن را غیرفعال کرده و از بازیکن حذف می کند.
        """
        if self.is_active and (time.time() - self.activation_time > self.duration):
            # اگر زمان پاورآپ تمام شد و بازیکن هنوز از آن استفاده نکرده، اثرش را بردار
            if self.affected_player and hasattr(self.affected_player, 'has_super_shot') and self.affected_player.has_super_shot:
                self.remove_effect(self.affected_player)
            self.deactivate() # این متد visible را false می کند و is_active را هم

    def draw(self, screen):
        if self.visible:
            # مثال: رسم یک مستطیل زرد برای SuperShot
            # import pygame
            # color = (255, 255, 0)
            # pygame.draw.rect(screen, color, (self.x, self.y, 20, 20))
            print(f"SuperShot در ({self.x}, {self.y}) نمایش داده می شود.") # برای تست


class LowGravity(PowerUp):
    def __init__(self, x, y, duration=7, gravity_multiplier=0.5):
        super().__init__(x, y, duration)
        self.gravity_multiplier = gravity_multiplier
        # self.color = (100, 100, 255) # آبی روشن

    def apply_effect(self, player):
        """
        جاذبه را برای بازیکن کاهش می دهد.
        فرض می کنیم بازیکن دارای ویژگی 'gravity_modifier' و 'original_gravity_modifier' است.
        """
        if not hasattr(player, 'original_gravity_modifier'):
            # اگر بازیکن از قبل این ویژگی را نداشت، مقدار پیش فرض 1.0 را برایش در نظر می گیریم
            player.original_gravity_modifier = getattr(player, 'gravity_modifier', 1.0)

        player.gravity_modifier = player.original_gravity_modifier * self.gravity_multiplier
        print(f"LowGravity: جاذبه بازیکن {player.name} به {player.gravity_modifier} تغییر کرد.")

    def remove_effect(self, player):
        """
        جاذبه بازیکن را به حالت اولیه بازمی گرداند.
        """
        player.gravity_modifier = player.original_gravity_modifier
        # del player.original_gravity_modifier
        print(f"LowGravity: جاذبه بازیکن {player.name} به {player.gravity_modifier} بازگشت.")

    def draw(self, screen):
        if self.visible:
            # مثال: رسم یک مستطیل آبی روشن برای LowGravity
            # import pygame
            # color = (100, 100, 255)
            # pygame.draw.rect(screen, color, (self.x, self.y, 20, 20))
            print(f"LowGravity در ({self.x}, {self.y}) نمایش داده می شود.") # برای تست


# --- مثال نحوه استفاده از این کلاس ها (باید در کد اصلی بازی شما باشد) ---
# class Player:
#     def __init__(self, name="P1", x=0, y=0, width=30, height=30):
#         self.name = name
#         self.x = x
#         self.y = y
#         self.width = width
#         self.height = height
#
#         # ویژگی های مربوط به پاورآپ ها
#         self.speed = 5
#         # original_speed توسط SpeedBoost تنظیم می شود
#
#         self.has_super_shot = False
#
#         self.gravity_modifier = 1.0
#         # original_gravity_modifier توسط LowGravity تنظیم می شود
#
#     def get_rect(self):
#         return (self.x, self.y, self.width, self.height)
#
#     def shoot(self):
#         if self.has_super_shot:
#             print(f"بازیکن {self.name} یک شوت گل شونده زد!")
#             self.has_super_shot = False # پاورآپ مصرف شد
#             # اگر پاورآپ SuperShot هنوز در لیست پاورآپ های فعال بازیکن است، باید غیرفعال شود
#             # این منطق باید در سیستم مدیریت پاورآپ ها پیاده سازی شود.
#         else:
#             print(f"بازیکن {self.name} یک شوت معمولی زد.")
#
#     def jump(self):
#         jump_height = 10 * (1/self.gravity_modifier) # جاذبه کمتر، پرش بلندتر
#         print(f"بازیکن {self.name} با ارتفاع {jump_height} پرید (جاذبه: {self.gravity_modifier}).")
#
#
# if __name__ == '__main__':
#     player1 = Player("Hero")
#
#     # تست SpeedBoost
#     print("\n--- تست SpeedBoost ---")
#     speed_powerup = SpeedBoost(x=50, y=50, duration=3)
#     if speed_powerup.visible and speed_powerup.check_collision(player1.get_rect()):
#         speed_powerup.activate(player1)
#
#     print(f"سرعت اولیه بازیکن: {player1.speed}")
#     current_time = time.time()
#     while speed_powerup.is_active:
#         time.sleep(0.1)
#         speed_powerup.update()
#         # print(f"زمان گذشته: {time.time() - current_time:.1f} ثانیه، سرعت بازیکن: {player1.speed}")
#     print(f"سرعت نهایی بازیکن پس از اتمام SpeedBoost: {player1.speed}")
#
#     # تست SuperShot
#     print("\n--- تست SuperShot ---")
#     super_shot_powerup = SuperShot(x=100, y=100, duration=5) # 5 ثانیه روی زمین می ماند
#     if super_shot_powerup.visible and super_shot_powerup.check_collision(player1.get_rect()):
#         super_shot_powerup.activate(player1)
#
#     player1.shoot() # بازیکن از شوت استفاده می کند
#     # اگر بازیکن قبل از اتمام زمان پاورآپ از آن استفاده کند،
#     # باید سیستمی باشد که پاورآپ را از لیست پاورآپ های فعال بازیکن حذف کند.
#     # در اینجا، فقط وضعیت has_super_shot تغییر می کند.
#     # خود پاورآپ پس از duration از زمین حذف می شود (توسط update خودش)
#
#     current_time = time.time()
#     # حلقه برای مشاهده حذف شدن پاورآپ از زمین
#     while super_shot_powerup.visible : # یا is_active اگر پس از فعال سازی ناپدید نشود
#         time.sleep(0.1)
#         super_shot_powerup.update()
#         if not super_shot_powerup.is_active and super_shot_powerup.visible:
#             # این حالت نباید رخ دهد اگر deactivate به درستی visible را false کند
#             pass
#         if time.time() - current_time > super_shot_powerup.duration + 1:
#             print("زمان تست SuperShot تمام شد.")
#             break
#     print(f"وضعیت SuperShot پس از تست: فعال؟ {super_shot_powerup.is_active}, قابل مشاهده؟ {super_shot_powerup.visible}")
#     player1.shoot() # شوت معمولی
#
#     # تست LowGravity
#     print("\n--- تست LowGravity ---")
#     low_gravity_powerup = LowGravity(x=150, y=150, duration=4)
#     print(f"جاذبه اولیه بازیکن: {player1.gravity_modifier}")
#     player1.jump()
#
#     if low_gravity_powerup.visible and low_gravity_powerup.check_collision(player1.get_rect()):
#         low_gravity_powerup.activate(player1)
#
#     player1.jump() # پرش با جاذبه کمتر
#
#     current_time = time.time()
#     while low_gravity_powerup.is_active:
#         time.sleep(0.1)
#         low_gravity_powerup.update()
#         # print(f"زمان گذشته: {time.time() - current_time:.1f} ثانیه، جاذبه بازیکن: {player1.gravity_modifier}")
#
#     print(f"جاذبه نهایی بازیکن پس از اتمام LowGravity: {player1.gravity_modifier}")
#     player1.jump()
#
#     print("\n--- تست همزمانی و ویژگی های بازیکن ---")
#     # اطمینان از اینکه ویژگی های اصلی بازیکن به درستی مدیریت می شوند
#     # مثلا اگر original_speed از قبل وجود داشته باشد
#     player2 = Player("Sidekick")
#     player2.speed = 10
#     player2.original_speed = 10 # فرض کنید قبلا یک پاورآپ سرعت گرفته و تمام شده
#
#     speed_powerup_2 = SpeedBoost(x=1,y=1, duration=1)
#     speed_powerup_2.activate(player2)
#     print(f"سرعت بازیکن 2 پس از پاورآپ: {player2.speed}, سرعت اصلی ذخیره شده: {player2.original_speed}")
#     speed_powerup_2.deactivate()
#     print(f"سرعت بازیکن 2 پس از اتمام پاورآپ: {player2.speed}")
#
#     # تست اینکه آیا original_gravity_modifier به درستی مقدار اولیه را می گیرد
#     player2.gravity_modifier = 0.8 # مقدار غیر پیش فرض
#     low_gravity_powerup_2 = LowGravity(x=1,y=1,duration=1)
#     low_gravity_powerup_2.activate(player2)
#     print(f"جاذبه بازیکن 2 پس از پاورآپ: {player2.gravity_modifier}, جاذبه اصلی ذخیره شده: {player2.original_gravity_modifier}")
#     low_gravity_powerup_2.deactivate()
#     print(f"جاذبه بازیکن 2 پس از اتمام پاورآپ: {player2.gravity_modifier}")
#
#     print("\nکلاس های نمونه پاورآپ ایجاد و تست شدند (به صورت محدود).")
