let serviceCount = 0;
let qpsChartInstance = null;
let responseTimeChartInstance = null;

// 添加获取并发用户数的新方法
function getConcurrentUsers() {
    const checkedValues = Array.from(document.querySelectorAll('.concurrent-checkbox:checked'))
        .map(checkbox => parseInt(checkbox.value))
        .sort((a, b) => a - b);
    return checkedValues;
}

// 添加自定义并发数的方法
function addCustomConcurrent() {
    const customInput = document.getElementById('custom-concurrent');
    const value = parseInt(customInput.value);
    
    if (isNaN(value) || value <= 0) {
        alert('请输入有效的并发数（大于0的整数）');
        return;
    }
    
    // 检查是否已存在
    const existingCheckboxes = document.querySelectorAll('.concurrent-checkbox');
    for (const checkbox of existingCheckboxes) {
        if (parseInt(checkbox.value) === value) {
            alert('该并发数已存在');
            return;
        }
    }
    
    // 创建新的复选框
    const checkboxGroup = document.querySelector('.checkbox-group');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'concurrent-checkbox';
    checkbox.value = value;
    checkbox.checked = true;
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${value}`));
    checkboxGroup.appendChild(label);
    
    // 清空输入框
    customInput.value = '';
}

function addService() {
    serviceCount++;
    const servicesDiv = document.getElementById('services');
    const originalService = document.querySelector('.service-config');
    const newService = originalService.cloneNode(true);
    
    // 清空新服务的输入值
    newService.querySelector('.service-name').value = '';
    newService.querySelector('.service-url').value = '';
    
    // 重置请求类型为 JSON
    const requestTypeSelect = newService.querySelector('.request-type');
    requestTypeSelect.value = 'json';
    
    // 重置并显示 JSON 配置，隐藏图片配置
    const jsonConfig = newService.querySelector('.json-config');
    const imageConfig = newService.querySelector('.image-config');
    jsonConfig.style.display = 'block';
    imageConfig.style.display = 'none';
    
    // 重置 JSON 请求体
    newService.querySelector('.request-body').value = '{"key1": "value1", "key2": "value2"}';
    // 重置请求头
    newService.querySelector('.headers').value = '{"Content-Type": "application/json"}';
    
    // 清空图片文件输入
    const imageFileInput = newService.querySelector('.image-file');
    imageFileInput.value = '';
    
    // 添加删除按钮
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-service';
    removeButton.textContent = '删除';
    removeButton.onclick = function() {
        newService.remove();
        updateServiceSummary();
    };
    newService.appendChild(removeButton);
    
    // 添加事件监听器
    requestTypeSelect.addEventListener('change', function(e) {
        toggleRequestConfig(e.target);
    });
    
    servicesDiv.appendChild(newService);
    updateServiceSummary();
}

function updateServiceSummary() {
    const summary = document.getElementById('service-summary');
    const summaryList = document.getElementById('service-summary-list');
    const services = document.querySelectorAll('.service-config');
    
    summaryList.innerHTML = '';
    
    if (services.length > 0) {
        summary.style.display = 'block';
        services.forEach((service, index) => {
            const name = service.querySelector('.service-name').value || `服务 ${index + 1}`;
            const url = service.querySelector('.service-url').value || '未设置 URL';
            const type = service.querySelector('.request-type').value;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${name}</strong><br>
                URL: ${url}<br>
                类型: ${type}
            `;
            summaryList.appendChild(li);
        });
    } else {
        summary.style.display = 'none';
    }
}

async function startTest() {
    try {
        const config = getConfig();
        
        // 验证配置
        if (config.services.length === 0) {
            alert('请至少添加一个服务');
            return;
        }
        
        if (config.concurrent_users.length === 0) {
            alert('请至少选择一个并发用户数');
            return;
        }

        for (const service of config.services) {
            if (!service.name || !service.url) {
                alert('请填写所有服务的名称和 URL');
                return;
            }
        }
    } catch (error) {
        alert(error.message);
        return;
    }
    
    // 显示状态区域
    const status = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const startButton = document.getElementById('startTestBtn');
    
    status.style.display = 'block';
    startButton.disabled = true;
    
    try {
        // 更新状态
        statusText.textContent = '正在执行测试...';
        progressBar.style.width = '50%';

        const response = await fetch('/api/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const results = await response.json();
        
        // 更新状态
        statusText.textContent = '测试完成！';
        progressBar.style.width = '100%';
        
        // 显示结果
        displayResults(results);
    } catch (error) {
        statusText.textContent = '测试失败：' + error.message;
        progressBar.style.width = '0%';
        alert('测试执行失败：' + error.message);
    } finally {
        startButton.disabled = false;
    }
}


function toggleRequestConfig(select) {
    const serviceConfig = select.closest('.service-config');
    const jsonConfig = serviceConfig.querySelector('.json-config');
    const imageConfig = serviceConfig.querySelector('.image-config');
    
    if (select.value === 'json') {
        jsonConfig.style.display = 'block';
        imageConfig.style.display = 'none';
    } else {
        jsonConfig.style.display = 'none';
        imageConfig.style.display = 'block';
    }
}

function getConfig() {
    const services = [];
    document.querySelectorAll('.service-config').forEach(serviceElement => {
        const service = {
            name: serviceElement.querySelector('.service-name').value,
            url: serviceElement.querySelector('.service-url').value,
            request_type: serviceElement.querySelector('.request-type').value,
            headers: JSON.parse(serviceElement.querySelector('.headers').value)
        };
        
        if (service.request_type === 'json') {
            service.request_body = JSON.parse(serviceElement.querySelector('.request-body').value);
        } else {
            const imageFile = serviceElement.querySelector('.image-file').files[0];
            if (imageFile) {
                service.image_path = imageFile;
            }
        }
        
        services.push(service);
    });

    const concurrentUsers = getConcurrentUsers();
    if (concurrentUsers.length === 0) {
        throw new Error('请至少选择一个并发用户数');
    }
    
    return {
        services: services,
        concurrent_users: concurrentUsers,
        requests_per_user: parseInt(document.getElementById('requests_per_user').value)
    };
}

function destroyCharts() {
    try {
        // 销毁 QPS 图表
        if (qpsChartInstance) {
            qpsChartInstance.destroy();
            qpsChartInstance = null;
        }
        
        // 销毁响应时间图表
        if (responseTimeChartInstance) {
            responseTimeChartInstance.destroy();
            responseTimeChartInstance = null;
        }
    } catch (error) {
        console.error('销毁图表时出错:', error);
    }
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';
    
    // 更新图表
    const qpsChart = document.getElementById('qpsChart');
    const responseTimeChart = document.getElementById('responseTimeChart');
    
    if (results.qps_plot_url) {
        qpsChart.src = results.qps_plot_url;
        qpsChart.style.display = 'block';
        
        // 添加错误处理
        qpsChart.onerror = function() {
            console.error('Failed to load QPS chart');
            this.style.display = 'none';
        };
    }
    
    if (results.response_plot_url) {
        responseTimeChart.src = results.response_plot_url;
        responseTimeChart.style.display = 'block';
        
        // 添加错误处理
        responseTimeChart.onerror = function() {
            console.error('Failed to load Response Time chart');
            this.style.display = 'none';
        };
    }
}

function displayCharts(results) {
    try {
        // 确保图表已被销毁
        destroyCharts();
        
        // 获取画布元素
        const qpsCanvas = document.getElementById('qpsChart');
        const responseTimeCanvas = document.getElementById('responseTimeChart');
        
        // 重新创建画布
        qpsCanvas.getContext('2d').clearRect(0, 0, qpsCanvas.width, qpsCanvas.height);
        responseTimeCanvas.getContext('2d').clearRect(0, 0, responseTimeCanvas.width, responseTimeCanvas.height);
        
        // 创建 QPS 图表
        qpsChartInstance = new Chart(qpsCanvas, {
            type: 'line',
            data: {
                labels: results.concurrent_users,
                datasets: results.services.map(service => ({
                    label: service.name,
                    data: service.qps,
                    fill: false,
                    borderColor: getRandomColor(),
                    tension: 0.1
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'QPS对比'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'QPS'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '并发用户数'
                        }
                    }
                }
            }
        });
        
        // 创建响应时间图表
        responseTimeChartInstance = new Chart(responseTimeCanvas, {
            type: 'line',
            data: {
                labels: results.concurrent_users,
                datasets: results.services.map(service => ({
                    label: service.name,
                    data: service.response_times,
                    fill: false,
                    borderColor: getRandomColor(),
                    tension: 0.1
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '平均响应时间对比'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '响应时间(秒)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '并发用户数'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('创建图表时出错:', error);
    }
}

// 添加辅助函数生成随机颜色
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function displayTable(results) {
    // 创建结果表格
    const table = document.createElement('table');
    // ... 表格创建代码 ...
}

function downloadResults() {
    // 触发服务器端的文件下载，但不重新加载页面
    fetch('/api/download-results')
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'test_results.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        });
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 为初始的服务配置添加请求类型变更监听器
    document.querySelector('.request-type').addEventListener('change', function(e) {
        toggleRequestConfig(e.target);
    });
    
    // 更新服务概要
    updateServiceSummary();
});

// 在页面加载完成时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 默认选中一些并发数
    document.querySelectorAll('.concurrent-checkbox').forEach(checkbox => {
        if (['1', '5', '10'].includes(checkbox.value)) {
            checkbox.checked = true;
        }
    });
    
    // 为初始的服务配置添加请求类型变更监听器
    document.querySelector('.request-type').addEventListener('change', function(e) {
        toggleRequestConfig(e.target);
    });
    
    // 更新服务概要
    updateServiceSummary();
});