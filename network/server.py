from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, session, redirect
import os
from werkzeug.utils import secure_filename
from core.load_tester import LoadTester, save_comparison_results_to_csv, analyze_results
import json
import threading
from loguru import logger
import traceback
import time
import asyncio
import aiohttp
from core.session_manager import SessionManager
from core import ensure_directories
import requests  # 确保导入requests库

# 创建会话管理器实例
session_manager = SessionManager()

# 设置正确的模板和静态文件路径
app = Flask(__name__,
    template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'static')
)

app.secret_key = os.urandom(24)

# 设置上传文件夹路径
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.before_request
def check_session():
    if request.endpoint != 'static':
        session_id = session.get('test_session_id')
        if not session_id or not session_manager.get_session(session_id):
            session['test_session_id'] = session_manager.create_session()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/results/<path:filename>')
def serve_results(filename):
    results_dir = os.path.join(os.path.dirname(__file__), 'results')  # 修改为正确的结果目录路径
    logger.info(f"Serving results file: {filename} from {results_dir}")
    try:
        response = send_from_directory(results_dir, filename)
        # 设置正确的 MIME 类型和字符编码
        response.headers['Content-Type'] = 'image/png; charset=utf-8'
        return response
    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/download-errors')
def download_errors():
    try:
        session_id = session.get('test_session_id')
        test_session = session_manager.get_session(session_id)
        if not test_session:
            return jsonify({'error': '会话已过期'}), 401
        
        error_files = session.get('error_files', [])
        if not error_files:
            return jsonify({'error': '没有错误记录文件'}), 404
        
        # 如果有多个错误文件，创建一个压缩文件
        if len(error_files) > 1:
            import zipfile
            zip_filename = f"error_records_{int(time.time())}.zip"
            zip_filepath = os.path.join(test_session.results_dir, zip_filename)
            
            with zipfile.ZipFile(zip_filepath, 'w') as zipf:
                for error_file in error_files:
                    file_path = os.path.join(test_session.results_dir, error_file)
                    if os.path.exists(file_path):
                        zipf.write(file_path, error_file)
            
            return send_file(
                zip_filepath,
                as_attachment=True,
                download_name=zip_filename,
                mimetype='application/zip'
            )
        else:
            # 只有一个错误文件时直接返回
            error_file = error_files[0]
            file_path = os.path.join(test_session.results_dir, error_file)
            if os.path.exists(file_path):
                return send_file(
                    file_path,
                    as_attachment=True,
                    download_name=error_file,
                    mimetype='application/json'
                )
            else:
                return jsonify({'error': '错误记录文件不存在'}), 404
                
    except Exception as e:
        logger.error(f"下载错误记录失败: {str(e)}")
        return jsonify({'error': '下载错误记录失败'}), 500
    
@app.route('/api/test', methods=['POST'])
def run_test():
    try:
        session_id = session.get('test_session_id')
        test_session = session_manager.get_session(session_id)
        if not test_session:
            return jsonify({'error': '会话已过期'}), 401
        
        # 从 FormData 中获取配置
        if 'config' not in request.form:
            return jsonify({'error': '缺少配置信息'}), 400
            
        config = json.loads(request.form['config'])
        # 添加会话信息到配置中
        config['session_dir'] = test_session.results_dir
        
        # 基本验证
        if not config.get('services'):
            return jsonify({'error': '没有配置服务'}), 400
            
        # 检测目标地址的请求是否可以正常发送
        for service in config['services']:
            try:
                response = requests.get(service['url'], timeout=5)  # 发送GET请求以检测可达性
                if response.status_code != 200:
                    return jsonify({'error': f'无法访问服务: {service["name"]}，状态码: {response.status_code}'}), 666
            except requests.exceptions.RequestException as e:
                return jsonify({'error': f'无法访问服务: {service["name"]}，错误信息: {str(e)}'}), 666

        # 处理上传的图片
        for service in config['services']:
            if service.get('request_type') == 'image' and service.get('image_path'):
                # 获取对应的文件
                file = request.files.get(service['image_path'])
                if file:
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(filepath)
                    service['image_path'] = filepath
                else:
                    return jsonify({'error': f'未找到图片文件: {service["image_path"]}'}), 400

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
    error_files = []  # 用于收集所有错误文件
    
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
                num_requests=concurrent_users * config['requests_per_user'],
                session_dir=config['session_dir']
            )
            
            # 运行测试并获取结果
            results = tester.run_load_test()
            
            # 如果有错误文件，添加到列表中
            if results.get('error_file'):
                error_files.append(results['error_file'])
                
            # 从结果中移除错误文件路径（不需要返回给前端）
            results.pop('error_file', None)
            
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
    
    # 将错误文件列表保存到会话中
    session['error_files'] = error_files
    
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

def clear_results_directory():
    """清空 results 目录下的所有文件"""
    results_dir = os.path.join(os.path.dirname(__file__), 'results')
    if os.path.exists(results_dir):
        for filename in os.listdir(results_dir):
            file_path = os.path.join(results_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    import shutil
                    shutil.rmtree(file_path)
            except Exception as e:
                logger.error(f"删除文件失败 {file_path}: {str(e)}")
    logger.info("已清空 results 目录")

@app.route('/json-validator')
def redirect_to_json_validator():
    return redirect('http://localhost:31007')

if __name__ == '__main__':
    ensure_directories()
    clear_results_directory()
    app.run(host="0.0.0.0", debug=True, port=31008)