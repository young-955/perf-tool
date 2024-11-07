import os

def ensure_directories():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    directories = ['results', 'uploads']
    
    for dir_name in directories:
        dir_path = os.path.join(base_dir, dir_name)
        os.makedirs(dir_path, exist_ok=True)