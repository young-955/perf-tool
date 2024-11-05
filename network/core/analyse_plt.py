import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # 设置后端为 Agg，避免 GUI 相关问题
import matplotlib.pyplot as plt
from loguru import logger

# 修改字体设置
try:
    # 尝试使用系统默认中文字体
    matplotlib.rcParams['font.sans-serif'] = [
        'WenQuanYi Micro Hei',  # 文泉驿微米黑
        'WenQuanYi Zen Hei',    # 文泉驿正黑
        'Noto Sans CJK SC',     # Google Noto 字体
        'Droid Sans Fallback',  # Android 默认字体
        'Microsoft YaHei',      # Windows 微软雅黑
        'SimHei',              # Windows 中文黑体
        'Arial Unicode MS'      # 通用 Unicode 字体
    ]
except:
    # 如果没有合适的中文字体，使用默认字体
    logger.warning("未找到合适的中文字体，将使用系统默认字体")
# 正确显示负号
matplotlib.rcParams['axes.unicode_minus'] = False

def analyze_results(csv_file):
    try:
        # 清除所有现有图表
        plt.close('all')
        
        # 读取CSV文件
        df = pd.read_csv(csv_file)
        
        # 创建两个独立的图表
        # QPS对比图
        fig1 = plt.figure(figsize=(6, 4))
        for service in df['服务名称'].unique():
            service_data = df[df['服务名称'] == service]
            plt.plot(service_data['并发用户数'], service_data['QPS'], marker='o', label=service)
        plt.title('QPS')
        plt.xlabel('并发用户数')
        plt.ylabel('QPS')
        plt.legend()
        plt.tight_layout()
        
        # 确保结果目录存在并使用正确的路径
        results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')
        os.makedirs(results_dir, exist_ok=True)
        
        # 保存QPS图表
        qps_path = os.path.join(results_dir, 'qps_comparison.png')
        fig1.savefig(qps_path)
        plt.close(fig1)
        
        # 响应时间对比图
        fig2 = plt.figure(figsize=(6, 4))
        for service in df['服务名称'].unique():
            service_data = df[df['服务名称'] == service]
            plt.plot(service_data['并发用户数'], service_data['平均响应时间(秒)'], marker='o', label=service)
        plt.title('平均响应时间')
        plt.xlabel('并发用户数')
        plt.ylabel('响应时间(秒)')
        plt.legend()
        plt.tight_layout()
        
        # 保存响应时间图表
        response_path = os.path.join(results_dir, 'response_time_comparison.png')
        fig2.savefig(response_path)
        plt.close(fig2)
        
        return 'qps_comparison.png', 'response_time_comparison.png'  # 只返回文件名        
    except Exception as e:
        logger.error(f"生成图表失败: {str(e)}")
        plt.close('all')  # 确保清理所有图表
        raise