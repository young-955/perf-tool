# perf-tool

一个支持 JSON 和图片上传的 HTTP 接口性能测试工具，可以同时测试多个服务在不同并发度下的性能表现。

## 功能特点

- 支持 JSON 和图片两种请求类型
- 支持多服务并行测试
- 支持多种并发度测试
- 自动生成性能测试报告
- 支持性能指标可视化
- 提供详细的测试日志

## 安装依赖


```bash
pip install -r requirements.txt
```


## 快速开始

1. 准备配置文件 `config.json`：

```json
{
    "services": [
        {
            "name": "JSON测试任务",
            "url": "http://example.com/api/endpoint1",
            "request_type": "json",
            "request_body": {
                "key1": "value1",
                "key2": "value2"
            },
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer your-token-here"
            }
        },
        {
            "name": "图片识别测试",
            "url": "http://example.com/api/endpoint2",
            "request_type": "image",
            "image_path": "./test.jpg",
            "headers": {
                "Content-Type": "image/jpeg",
                "Authorization": "Bearer your-token-here"
            }
        }
    ],
    "concurrent_users": [
        1,
        2,
        5
    ],
    "requests_per_user": 100
}
```

2. 运行测试：

```bash
python main.py --config config.json
```

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

## 项目结构

```
.
├── main.py # 主程序
├── analyse_plt.py # 数据分析和可视化
├── config.json # 配置文件
├── requirements.txt # 依赖列表
└── README.md # 说明文档
```


## 依赖项

- requests
- loguru
- opencv-python
- numpy
- matplotlib
- pandas

## 注意事项

1. 图片测试需要确保图片文件存在且可访问
2. JSON 测试会自动为每个请求生成唯一的 bizno
3. 建议先用小并发度测试，确认无误后再增加并发度
4. 测试结果会自动保存在当前目录

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
