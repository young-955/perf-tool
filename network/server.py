from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
import os
from werkzeug.utils import secure_filename
from core.load_tester import LoadTester, save_comparison_results_to_csv, analyze_results
import json
import threading
from loguru import logger
import traceback
import time

# 设置正确的模板和静态文件路径
app = Flask(__name__,
    template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'static')
)

# 设置上传文件夹路径
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/results/<path:filename>')
def serve_results(filename):
    results_dir = os.path.join(os.path.dirname(__file__), 'results')  # 修改为正确的结果目录路径
    logger.info(f"Serving results file: {filename} from {results_dir}")
    try:
        return send_from_directory(results_dir, filename)
    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/test', methods=['POST'])
def run_test():
    try:
        config = request.json
        
        # 基本验证
        if not config.get('services'):
            return jsonify({'error': '没有配置服务'}), 400
            
        # 处理上传的图片
        for service in config['services']:
            if service.get('request_type') == 'image' and service.get('image_path'):
                # 获取图片文件名而不是整个字典
                image_path = service['image_path']
                if isinstance(image_path, str):  # 确保是字符串
                    file = request.files.get(image_path)
                    if file:
                        filename = secure_filename(file.filename)
                        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                        file.save(filepath)
                        service['image_path'] = filepath

        # 运行测试
        results = run_load_tests(config)
        return jsonify(results)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"测试执行失败: {str(e)}")
        return jsonify({'error': str(e)}), 500   
@app.route('/api/download-results')
def download_results():
    try:
        # 返回最新的测试结果文件
        latest_file = get_latest_result_file()
        if latest_file:
            return send_file(latest_file, as_attachment=True)
        else:
            return jsonify({'error': '没有可用的测试结果文件'}), 404
    except Exception as e:
        logger.error(f"下载结果文件失败: {str(e)}")
        return jsonify({'error': '下载结果文件失败'}), 500

def run_load_tests(config):
    all_results = []
    service_results_list = []
    
    # 对每个服务进行测试
    for service in config['services']:
        logger.info(f"\n开始测试服务: {service['name']}")
        
        service_results = []  # 存储当前服务的所有测试结果
        
        # 对每个并发用户数进行测试
        for concurrent_users in config['concurrent_users']:
            logger.info(f"\n并发用户数: {concurrent_users}")
            
            # 使用 LoadTester 类进行测试
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
            
            # 运行测试并获取结果
            results = tester.run_load_test()
            
            # 添加额外信息到结果中
            results['服务名称'] = service['name']
            results['并发用户数'] = concurrent_users
            results['总请求数'] = concurrent_users * config['requests_per_user']
            
            service_results.append(results)
            all_results.append(results)
            
            # 每个测试之间暂停一段时间
            time.sleep(2)
        
        # 将当前服务的结果添加到列表中
        service_results_list.append({
            'name': service['name'],
            'results': service_results
        })
    
    # 保存结果并生成图表
    filename = save_comparison_results_to_csv(all_results)
    qps_path, response_path = analyze_results(filename)
    
    # 使用完整的服务结果列表
    formatted_results = format_results(service_results_list, config['concurrent_users'])
    formatted_results['qps_plot_url'] = '/results/qps_comparison.png'
    formatted_results['response_plot_url'] = '/results/response_time_comparison.png'
    
    return formatted_results

def format_results(all_results, concurrent_users):
    # 格式化结果用于前端显示
    return {
        'concurrent_users': concurrent_users,
        'services': [{
            'name': service['name'],
            'qps': [float(result['QPS']) for result in service['results']],
            'response_times': [float(result['平均响应时间(秒)']) for result in service['results']]
        } for service in all_results]
    }

def get_latest_result_file():
    """获取最新的结果文件"""
    # 指定结果文件目录
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    os.makedirs(results_dir, exist_ok=True)  # 确保目录存在
    
    # 获取所有性能测试结果文件
    files = [f for f in os.listdir(results_dir) 
             if f.startswith('performance_comparison_') and f.endswith('.csv')]
    
    if not files:
        logger.warning("没有找到测试结果文件")
        return None
        
    # 获取最新的文件
    latest_file = max(files, key=lambda x: os.path.getctime(os.path.join(results_dir, x)))
    return os.path.join(results_dir, latest_file)

if __name__ == '__main__':
    app.run(debug=True, port=5000)