import random
import time
from powerup import PowerUp, SpeedBoost, SuperShot, LowGravity # فرض بر اینکه این فایل ها در دسترس هستند

# ممکن است نیاز به تعریف کلاس Player یا وارد کردن آن از ماژول دیگر باشد
# class Player:
#     def __init__(self, name, team_id): # team_id برای اطمینان از اعمال روی بازیکن درست
#         self.name = name
#         self.team_id = team_id
#         self.rect = (0,0,20,20) # یک نمونه rect برای بازیکن
#         # سایر ویژگی های بازیکن مانند speed, has_super_shot, gravity_modifier
#         self.speed = 5
#         self.has_super_shot = False
#         self.gravity_modifier = 1.0

#     def get_rect(self):
#         # این متد باید مستطیل موقعیت فعلی بازیکن را برگرداند
#         # مثال: return pygame.Rect(self.x, self.y, self.width, self.height)
#         return self.rect # برای سادگی در اینجا

class PowerUpManager:
    def __init__(self, game_area_rect, max_powerups_on_field=3, spawn_interval=10):
        """
        مدیریت پاورآپ ها در زمین بازی.

        آرگومان ها:
            game_area_rect (tuple): یک تاپل (x, y, width, height) که محدوده زمین بازی را مشخص می کند.
            max_powerups_on_field (int): حداکثر تعداد پاورآپ هایی که همزمان می توانند در زمین باشند.
            spawn_interval (int): فاصله زمانی (به ثانیه) بین ایجاد پاورآپ های جدید.
        """
        self.powerups_on_field = []
        self.game_area_rect = game_area_rect
        self.max_powerups_on_field = max_powerups_on_field
        self.spawn_interval = spawn_interval
        self.last_spawn_time = time.time()

        # لیست انواع پاورآپ هایی که می توانند ایجاد شوند
        self.available_powerup_types = [SpeedBoost, SuperShot, LowGravity]

    def spawn_powerup(self):
        """
        یک پاورآپ جدید را به صورت تصادفی در یک مکان مجاز از زمین ایجاد می کند.
        """
        if len(self.powerups_on_field) < self.max_powerups_on_field:
            # انتخاب یک نوع پاورآپ به صورت تصادفی
            PowerUpType = random.choice(self.available_powerup_types)

            # تعیین مکان تصادفی برای پاورآپ در محدوده زمین
            # فرض می کنیم پاورآپ ها یک اندازه ثابت دارند (مثلا 20x20)
            powerup_width = 20
            powerup_height = 20

            min_x, min_y, area_width, area_height = self.game_area_rect

            # اطمینان از اینکه پاورآپ کاملا داخل زمین قرار می گیرد
            # این بخش ممکن است نیاز به تنظیم دقیق تری داشته باشد
            # مثلا با توجه به اندازه واقعی پاورآپ ها و نقاط ممنوعه
            try:
                # ممکن است area_width یا area_height کوچکتر از powerup_width/height باشند
                rand_x = random.randint(min_x, min_x + area_width - powerup_width)
                rand_y = random.randint(min_y, min_y + area_height - powerup_height)
            except ValueError:
                print(f"خطا: محدوده زمین ({self.game_area_rect}) برای ایجاد پاورآپ ({powerup_width}x{powerup_height}) خیلی کوچک است.")
                return

            new_powerup = PowerUpType(x=rand_x, y=rand_y)
            self.powerups_on_field.append(new_powerup)
            print(f"پاورآپ {new_powerup.__class__.__name__} در ({rand_x}, {rand_y}) ایجاد شد.")

    def update_powerups(self, players_list):
        """
        وضعیت همه پاورآپ ها را به روز می کند، برخورد با بازیکنان را بررسی می کند
        و پاورآپ های منقضی شده را حذف می کند.

        آرگومان ها:
            players_list (list): لیستی از آبجکت های بازیکنان حاضر در بازی.
        """
        # تلاش برای ایجاد پاورآپ جدید در فواصل زمانی معین
        current_time = time.time()
        if current_time - self.last_spawn_time > self.spawn_interval:
            self.spawn_powerup()
            self.last_spawn_time = current_time

        # به روز رسانی و بررسی برخورد برای هر پاورآپ
        # برای جلوگیری از تغییر لیست در حین پیمایش، از یک کپی استفاده می کنیم یا با ایندکس معکوس پیمایش می کنیم
        for i in range(len(self.powerups_on_field) - 1, -1, -1):
            powerup = self.powerups_on_field[i]
            powerup.update()

            if not powerup.is_active and not powerup.visible: # پاورآپ استفاده شده یا زمانش تمام شده
                self.powerups_on_field.pop(i)
                print(f"پاورآپ {powerup.__class__.__name__} از زمین حذف شد.")
                continue

            if powerup.visible and not powerup.is_active: # پاورآپ قابل مشاهده و هنوز فعال نشده
                for player in players_list:
                    # فرض می کنیم بازیکن یک متد get_rect() و یک ویژگی team_id دارد
                    # و پاورآپ ها فقط روی بازیکنی که به آن برخورد کرده اعمال می شوند.
                    # در اینجا team_id برای جلوگیری از اعمال روی تیم دیگر مستقیما استفاده نمی شود
                    # بلکه خود برخورد با بازیکن خاص، آن را مشخص می کند.
                    player_rect = player.get_rect()
                    if powerup.check_collision(player_rect):
                        powerup.activate(player) # اثر روی همان بازیکن اعمال می شود
                        # پس از فعال سازی، پاورآپ ممکن است بلافاصله ناپدید شود یا برای مدتی بماند
                        # منطق visible بودن پس از فعال سازی در خود کلاس پاورآپ مدیریت می شود.
                        # (مثلا SuperShot ممکن است پس از فعال سازی ناپدید شود)
                        # یا می توانیم اینجا تصمیم بگیریم:
                        # powerup.visible = False # اگر بخواهیم بلافاصله پس از برخورد حذف شود
                        break # یک پاورآپ فقط توسط یک بازیکن در یک فریم می تواند فعال شود

        # حذف پاورآپ هایی که ممکن است در حلقه بالا is_active = False و visible = False شده باشند
        # این کار در ابتدای حلقه با شرط if not powerup.is_active and not powerup.visible انجام شد.

    def draw_powerups(self, screen):
        """
        همه پاورآپ های قابل مشاهده را روی صفحه نمایش می دهد.
        """
        for powerup in self.powerups_on_field:
            if powerup.visible:
                powerup.draw(screen) # متد draw خود پاورآپ فراخوانی می شود

    def reset(self):
        """
        همه پاورآپ ها را از زمین پاک می کند و زمان سنج ایجاد را ریست می کند.
        """
        for powerup in self.powerups_on_field:
            if powerup.is_active and powerup.affected_player:
                powerup.deactivate() # اثرات را از بازیکنان حذف می کند
        self.powerups_on_field = []
        self.last_spawn_time = time.time()
        print("PowerUpManager ریست شد.")

# --- مثال نحوه استفاده (این بخش باید در حلقه اصلی بازی شما باشد) ---
# if __name__ == '__main__':
#     # تعریف یک کلاس بازیکن ساده برای تست
#     class Player:
#         def __init__(self, name, x, y, width=20, height=20):
#             self.name = name
#             self.x = x
#             self.y = y
#             self.width = width
#             self.height = height
#             self.speed = 5
#             self.original_speed = 5
#             self.has_super_shot = False
#             self.gravity_modifier = 1.0
#             self.original_gravity_modifier = 1.0
#
#         def get_rect(self):
#             return (self.x, self.y, self.width, self.height)
#
#         def move(self, dx, dy): # برای شبیه سازی حرکت و برخورد
#             self.x += dx
#             self.y += dy
#
#     # محدوده زمین بازی
#     game_area = (0, 0, 800, 600) # x, y, width, height
#
#     # ایجاد بازیکنان
#     player1 = Player("Player1", 50, 50)
#     player2 = Player("Player2", 700, 500)
#     all_players = [player1, player2]
#
#     # ایجاد مدیر پاورآپ
#     powerup_manager = PowerUpManager(game_area_rect=game_area, spawn_interval=5, max_powerups_on_field=2)
#
#     print("شروع شبیه سازی حلقه بازی...")
#     start_sim_time = time.time()
#     game_duration = 20 # ثانیه
#
#     # حلقه شبیه سازی بازی
#     while time.time() - start_sim_time < game_duration:
#         current_loop_time = time.time()
#
#         # شبیه سازی حرکت بازیکن (برای تست برخورد)
#         # player1.move(1,0) # حرکت آرام بازیکن 1 به سمت راست
#
#         # به روز رسانی پاورآپ ها
#         powerup_manager.update_powerups(all_players)
#
#         # رسم پاورآپ ها (در اینجا فقط چاپ می شود)
#         # powerup_manager.draw_powerups(None) # None به جای screen برای تست
#
#         # بررسی وضعیت بازیکنان (برای مشاهده اثر پاورآپ ها)
#         # print(f"زمان: {int(current_loop_time - start_sim_time)}s, P1 Speed: {player1.speed}, P1 SuperShot: {player1.has_super_shot}")
#
#         time.sleep(1) # هر ثانیه یک تیک بازی
#
#     print("\nشبیه سازی تمام شد.")
#     powerup_manager.reset() # پاک کردن پاورآپ ها در انتهای بازی
#
#     # بررسی وضعیت بازیکنان پس از ریست
#     print(f"وضعیت نهایی P1: Speed: {player1.speed}, SuperShot: {player1.has_super_shot}, Gravity: {player1.gravity_modifier}")
#     # توجه: SuperShot ممکن است هنوز True باشد اگر بازیکن از آن استفاده نکرده باشد و زمانش تمام نشده باشد
#     # و reset فقط پاورآپ های روی زمین را پاک می کند، نه اثرات فعال روی بازیکنان که زمانشان تمام نشده.
#     # این رفتار در متد reset اصلاح شد تا deactivate را صدا بزند.
#
#     print("فایل powerup_manager.py ایجاد شد.")

print("فایل powerup_manager.py ایجاد شد.")
