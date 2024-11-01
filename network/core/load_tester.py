import os
import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor
import json
import argparse
import uuid
import random
import string
from loguru import logger
import csv
from datetime import datetime
from core.analyse_plt import analyze_results
import io
import cv2
import numpy as np

class LoadTester:
    def __init__(self, name, url, request_type, request_body=None, image_path=None, headers=None, num_threads=10, num_requests=100):
        self.name = name
        self.url = url
        self.request_type = request_type
        self.base_request_body = request_body
        self.image_path = image_path
        self.headers = headers if headers else {'Content-Type': 'application/json'}
        self.num_threads = num_threads
        self.num_requests = num_requests
        self.success_count = 0
        self.failure_count = 0
        self.response_times = []
        self.lock = threading.Lock()
        
        # 如果是图片请求，预先加载图片
        if self.request_type == 'image' and self.image_path:
            self.image_data = self.prepare_image_data(self.image_path)

    def prepare_image_data(self, image_path):
        """预处理图片数据"""
        rgb_img = cv2.imread(image_path)
        if rgb_img is None:
            raise ValueError(f"无法读取图片: {image_path}")
        return self.cv2bytes(rgb_img)

    def cv2bytes(self, im):
        """cv2转二进制图片"""
        return io.BytesIO(cv2.imencode('.png', im)[1]).getvalue()


    def generate_bizno(self):
        """生成随机的业务编号"""
        # 方法1：使用UUID
        # return str(uuid.uuid4())
        
        # 方法2：时间戳+随机数
        timestamp = time.strftime('%Y%m%d%H%M%S')
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"BIZ{timestamp}{random_str}"

    def make_request(self):
        try:
            if self.request_type == 'json':
                # JSON请求
                request_body = self.base_request_body.copy()
                request_body['bizno'] = self.generate_bizno()
                
                start_time = time.time()
                response = requests.post(self.url, json=request_body, headers=self.headers)
                end_time = time.time()
                
                logger.info(f"bizno: {request_body['bizno']}, status: {response.status_code}")
            
            else:  # image request
                # 图片请求
                start_time = time.time()
                response = requests.post(self.url, headers=self.headers, data=self.image_data)
                end_time = time.time()
                
                logger.info(f"Image request completed, status: {response.status_code}")
            
            with self.lock:
                if response.status_code == 200:
                    self.success_count += 1
                else:
                    self.failure_count += 1
                self.response_times.append(end_time - start_time)
            
            return response.status_code
        except Exception as e:
            with self.lock:
                self.failure_count += 1
            logger.error(f"请求失败: {str(e)}")
            return None
        
    def run_load_test(self):
        logger.info(f"开始压力测试...")
        logger.info(f"目标 URL: {self.url}")
        logger.info(f"并发线程数: {self.num_threads}")
        logger.info(f"总请求数: {self.num_requests}")
        logger.info(f"基础请求体: {json.dumps(self.base_request_body, ensure_ascii=False)}")
        logger.info(f"bizno: 将为每个请求动态生成")
        logger.info("-" * 50)

        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
            futures = [executor.submit(self.make_request) for _ in range(self.num_requests)]
            
        end_time = time.time()
        
        # 计算统计数据
        total_time = end_time - start_time
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        max_response_time = max(self.response_times) if self.response_times else 0
        min_response_time = min(self.response_times) if self.response_times else 0
        qps = self.num_requests / total_time if total_time > 0 else 0
        
        # 准备测试结果数据
        test_results = {
            "总耗时(秒)": f"{total_time:.2f}",
            "成功请求数": self.success_count,
            "失败请求数": self.failure_count,
            "平均响应时间(秒)": f"{avg_response_time:.3f}",
            "最大响应时间(秒)": f"{max_response_time:.3f}",
            "最小响应时间(秒)": f"{min_response_time:.3f}",
            "QPS": f"{qps:.2f}"
        }
        
        # 输出测试结果到日志
        logger.info("\n测试结果:")
        for key, value in test_results.items():
            logger.info(f"{key}: {value}")
            
        return test_results
    
def save_results_to_csv(all_results):
    # 生成文件名，包含时间戳
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"test_results_{timestamp}.csv"
    
    # 获取所有指标名称
    metrics = list(all_results[0].keys())
    
    # 写入CSV文件
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # 写入表头
        writer.writerow(['指标'] + [f'任务{i+1}' for i in range(len(all_results))])
        # 写入数据
        for metric in metrics:
            writer.writerow([metric] + [result[metric] for result in all_results])
    
    logger.info(f"测试结果已保存到文件: {filename}")

def load_config(config_file):
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_comparison_results_to_csv(all_results):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = os.path.join('results', f"performance_comparison_{timestamp}.csv")
    
    # 准备CSV数据
    headers = ['服务名称', '并发用户数', '总请求数', '总耗时(秒)', '成功请求数', '失败请求数', 
              '平均响应时间(秒)', '最大响应时间(秒)', '最小响应时间(秒)', 'QPS']
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for result in all_results:
            writer.writerow([
                result['服务名称'],
                result['并发用户数'],
                result['总请求数'],
                result['总耗时(秒)'],
                result['成功请求数'],
                result['失败请求数'],
                result['平均响应时间(秒)'],
                result['最大响应时间(秒)'],
                result['最小响应时间(秒)'],
                result['QPS']
            ])
    
    logger.info(f"对比测试结果已保存到文件: {filename}")
    return filename

def main():
    parser = argparse.ArgumentParser(description='HTTP接口压力测试工具')
    parser.add_argument('--config', type=str, help='配置文件路径', default='config.json')
    args = parser.parse_args()

    # 加载配置文件
    config = load_config(args.config)
    
    # 存储所有测试结果
    all_results = []
    
    # 对每个服务进行不同并发度的测试
    for service in config['services']:
        logger.info(f"\n开始测试服务: {service['name']}")
        
        for concurrent_users in config['concurrent_users']:
            logger.info(f"\n并发用户数: {concurrent_users}")
            
            tester = LoadTester(
                name=service['name'],
                url=service['url'],
                request_type=service.get('request_type', 'json'),
                request_body=service.get('request_body'),
                image_path=service.get('image_path'),
                headers=service.get('headers'),
                num_threads=concurrent_users,
                num_requests=concurrent_users * config['requests_per_user']
            )
            
            results = tester.run_load_test()
            results['服务名称'] = service['name']
            results['并发用户数'] = concurrent_users
            results['总请求数'] = concurrent_users * config['requests_per_user']
            results['请求类型'] = service.get('request_type', 'json')
            
            all_results.append(results)
            
            # 每个测试之间暂停一段时间，避免服务器过载
            time.sleep(2)
    
    logger.info(f"所有测试结果: {all_results}")

    # 保存对比结果
    filename = save_comparison_results_to_csv(all_results)
    analyze_results(filename)

if __name__ == "__main__":
    main()