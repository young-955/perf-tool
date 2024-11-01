import os
import pandas as pd
import matplotlib.pyplot as plt

def analyze_results(csv_file):
    # 读取CSV文件
    df = pd.read_csv(csv_file)
    
    # 创建性能对比图表
    plt.figure(figsize=(12, 6))
    
    # QPS对比图
    plt.subplot(1, 2, 1)
    for service in df['服务名称'].unique():
        service_data = df[df['服务名称'] == service]
        plt.plot(service_data['并发用户数'], service_data['QPS'], marker='o', label=service)
    plt.title('QPS对比')
    plt.xlabel('并发用户数')
    plt.ylabel('QPS')
    plt.legend()
    
    # 响应时间对比图
    plt.subplot(1, 2, 2)
    for service in df['服务名称'].unique():
        service_data = df[df['服务名称'] == service]
        plt.plot(service_data['并发用户数'], service_data['平均响应时间(秒)'], marker='o', label=service)
    plt.title('平均响应时间对比')
    plt.xlabel('并发用户数')
    plt.ylabel('响应时间(秒)')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig(os.path.join('results', 'performance_comparison.png'))
    plt.close()