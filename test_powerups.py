import unittest
import time
from powerup import SpeedBoost # فرض بر این است که powerup.py در همان مسیر یا در PYTHONPATH است

# یک کلاس Player ساده برای استفاده در تست ها
class MockPlayer:
    def __init__(self, name="TestPlayer", initial_speed=5):
        self.name = name
        self.speed = initial_speed
        self.original_speed = initial_speed # برای سازگاری با نحوه ذخیره سرعت اولیه توسط SpeedBoost
        # ویژگی های دیگری که ممکن است پاورآپ های دیگر به آنها نیاز داشته باشند
        self.has_super_shot = False
        self.gravity_modifier = 1.0
        self.original_gravity_modifier = 1.0
        # مختصات و ابعاد فرضی برای get_rect
        self.x = 0
        self.y = 0
        self.width = 20
        self.height = 20

    def get_rect(self):
        """یک متد get_rect ساده برای سازگاری."""
        return (self.x, self.y, self.width, self.height)

class TestSpeedBoostPowerUp(unittest.TestCase):

    def setUp(self):
        """این متد قبل از هر تست فراخوانی می شود."""
        self.player = MockPlayer(name="TestRunner", initial_speed=10)
        self.speed_boost_powerup = SpeedBoost(x=50, y=50, duration=0.1, boost_factor=2)
        # duration کوتاه برای تست سریع deactivate

    def test_initialization(self):
        """تست مقداردهی اولیه SpeedBoost."""
        self.assertEqual(self.speed_boost_powerup.x, 50)
        self.assertEqual(self.speed_boost_powerup.y, 50)
        self.assertEqual(self.speed_boost_powerup.duration, 0.1)
        self.assertEqual(self.speed_boost_powerup.boost_factor, 2)
        self.assertFalse(self.speed_boost_powerup.is_active)
        self.assertTrue(self.speed_boost_powerup.visible)

    def test_apply_effect(self):
        """تست اعمال اثر SpeedBoost روی بازیکن."""
        initial_speed = self.player.speed
        boost_factor = self.speed_boost_powerup.boost_factor

        self.speed_boost_powerup.apply_effect(self.player)

        self.assertEqual(self.player.speed, initial_speed * boost_factor)
        self.assertTrue(hasattr(self.player, 'original_speed'))
        self.assertEqual(self.player.original_speed, initial_speed) # باید سرعت اولیه را ذخیره کرده باشد

    def test_remove_effect(self):
        """تست حذف اثر SpeedBoost از بازیکن."""
        # ابتدا اثر را اعمال می کنیم
        self.speed_boost_powerup.apply_effect(self.player)
        speed_after_boost = self.player.speed

        # سپس اثر را حذف می کنیم
        self.speed_boost_powerup.remove_effect(self.player)

        self.assertEqual(self.player.speed, self.player.original_speed)
        self.assertNotEqual(self.player.speed, speed_after_boost) # سرعت باید به حالت اول برگشته باشد

    def test_activation_and_deactivation_flow(self):
        """تست کامل جریان فعال سازی و غیرفعال سازی خودکار."""
        initial_player_speed = self.player.speed

        # فعال سازی
        self.speed_boost_powerup.activate(self.player)
        self.assertTrue(self.speed_boost_powerup.is_active)
        self.assertEqual(self.player.speed, initial_player_speed * self.speed_boost_powerup.boost_factor)
        self.assertIsNotNone(self.speed_boost_powerup.affected_player)

        # منتظر ماندن برای اتمام duration
        time.sleep(self.speed_boost_powerup.duration + 0.05) # کمی بیشتر از duration

        self.speed_boost_powerup.update() # فراخوانی آپدیت برای بررسی اتمام زمان

        self.assertFalse(self.speed_boost_powerup.is_active)
        self.assertEqual(self.player.speed, initial_player_speed) # سرعت باید به حالت اولیه برگشته باشد
        self.assertFalse(self.speed_boost_powerup.visible) # باید نامرئی شده باشد
        self.assertIsNone(self.speed_boost_powerup.affected_player) # بازیکن تحت تاثیر باید پاک شده باشد

    def test_deactivate_manual(self):
        """تست غیرفعال سازی دستی."""
        initial_player_speed = self.player.speed
        self.speed_boost_powerup.activate(self.player)
        self.assertTrue(self.speed_boost_powerup.is_active)

        self.speed_boost_powerup.deactivate() # غیرفعال سازی دستی قبل از اتمام زمان

        self.assertFalse(self.speed_boost_powerup.is_active)
        self.assertEqual(self.player.speed, initial_player_speed)
        self.assertFalse(self.speed_boost_powerup.visible)

    def test_check_collision(self):
        """تست ساده برای بررسی برخورد."""
        # این تست بیشتر برای پوشش کد است، چون منطق اصلی برخورد در بازی شما خواهد بود
        # پاورآپ در (50,50) با اندازه پیش فرض 20x20 در کلاس پایه PowerUp
        # پس محدوده آن x: [50, 70), y: [50, 70) خواهد بود

        # بازیکن دقیقا روی پاورآپ
        player_on_powerup_rect = (55, 55, 10, 10)
        self.assertTrue(self.speed_boost_powerup.check_collision(player_on_powerup_rect))

        # بازیکن دور از پاورآپ
        player_far_from_powerup_rect = (100, 100, 10, 10)
        self.assertFalse(self.speed_boost_powerup.check_collision(player_far_from_powerup_rect))

        # بازیکن در کنار پاورآپ (بدون برخورد)
        player_beside_powerup_rect = (70, 50, 10, 10) # x پاورآپ تا 69.99 است
        self.assertFalse(self.speed_boost_powerup.check_collision(player_beside_powerup_rect))

if __name__ == '__main__':
    unittest.main()

print("فایل test_powerups.py با تست های واحد برای SpeedBoost ایجاد شد.")
