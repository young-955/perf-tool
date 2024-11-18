import os
import io
import cv2
from loguru import logger

class ImageCache:
    _instance = None
    _cache = {}
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def get_image_data(self, image_path):
        if image_path not in self._cache:
            try:
                rgb_img = cv2.imread(image_path)
                if rgb_img is None:
                    raise ValueError(f"无法读取图片: {image_path}")
                self._cache[image_path] = self._cv2bytes(rgb_img)
            except Exception as e:
                logger.error(f"加载图片失败: {str(e)}")
                raise
        return self._cache[image_path]
    
    def _cv2bytes(self, im):
        return io.BytesIO(cv2.imencode('.png', im)[1]).getvalue()

def ensure_directories():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    directories = ['results', 'uploads']
    
    for dir_name in directories:
        dir_path = os.path.join(base_dir, dir_name)
        os.makedirs(dir_path, exist_ok=True)