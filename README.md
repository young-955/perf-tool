# peft-tool

一个支持 JSON 和图片上传的 HTTP 接口性能测试工具，提供 Web 界面和命令行两种使用方式，可以同时测试多个服务在不同并发度下的性能表现。

## 功能特点

- 🌐 支持 Web 界面和命令行两种使用模式
- 📊 支持 JSON 和图片两种请求类型
- 🚀 支持多服务并行测试
- 👥 灵活的并发度配置（预设+自定义）
- 📈 自动生成性能对比图表
- 📋 支持测试报告导出
- 📝 提供详细的测试日志

## 项目结构

```
perf-tool/
├── network/ # Web 服务器模块
│ ├── static/ # 静态资源
│ │ ├── css/ # 样式文件
│ │ └── js/ # JavaScript 文件
│ ├── templates/ # HTML 模板
│ ├── core/ # 核心测试逻辑
│ │ ├── load_tester.py # 压力测试实现
│ │ └── analyse_plt.py # 数据分析和图表生成
│ └── server.py # Web 服务器实现
```


## 安装依赖

```bash
pip install -r requirements.txt
```


## 使用方式

### 1. Web 界面模式

1. 启动服务：

```bash
python network/server.py
```


2. 访问 `http://localhost:5000` 使用 Web 界面

Web 界面特点：
- 可视化配置界面
- 实时测试状态展示
- 动态图表显示
- 支持文件上传
- 测试报告导出

### 2. 命令行模式

1. 准备配置文件 `config.json`：

```
json
{
    "services": [
        {
            "name": "JSON测试服务",
            "url": "http://example.com/api/test",
            "request_type": "json",
            "request_body": {
                "key": "value"
            },
            "headers": {
                "Content-Type": "application/json"
            }
        }
    ],
    "concurrent_users": [
        1,
        5,
        10
    ],
    "requests_per_user": 100
}
```


2. 运行测试：

```
bash
python local/main.py --config config.json
```


命令行模式特点：
- 支持批量测试
- 适合自动化场景
- 配置文件驱动
- 生成相同的测试报告

## 配置说明

### 服务配置

- `name`: 服务名称
- `url`: 服务地址
- `request_type`: 请求类型（"json" 或 "image"）
- `request_body`: JSON 请求体（request_type 为 "json" 时必需）
- `image_path`: 图片路径（request_type 为 "image" 时必需）
- `headers`: 请求头

### 测试参数

- `concurrent_users`: 并发用户数列表
- `requests_per_user`: 每个用户的请求数

## 输出结果

1. 测试日志
   - 实时显示测试进度
   - 显示每个请求的状态
   - 显示错误信息

2. CSV 报告
   - 生成时间戳命名的 CSV 文件
   - 包含所有测试指标
   - 支持多服务对比

3. 性能指标
   - 总耗时
   - 成功/失败请求数
   - 平均响应时间
   - 最大/最小响应时间
   - QPS (每秒查询率)

4. 可视化图表
   - QPS 对比图
   - 响应时间对比图

## 依赖项

- Flask (Web 界面)
- requests
- loguru (日志处理)
- matplotlib (图表生成)
- pandas (数据处理)
- opencv-python (图片处理)

## 注意事项

1. 图片测试需要确保图片文件存在且可访问
2. JSON 测试会自动为每个请求生成唯一的 bizno
3. 建议先用小并发度测试，确认无误后再增加并发度
4. Web 模式下上传的文件会保存在 uploads 目录
5. 测试结果和图表保存在 results 目录

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！