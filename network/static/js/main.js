let serviceCount = 0;
let qpsChartInstance = null;
let responseTimeChartInstance = null;

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

    // 添加合理的上限检查
    const MAX_CONCURRENT = 1000;
    if (value > MAX_CONCURRENT) {
        alert(`并发数不能超过 ${MAX_CONCURRENT}`);
        return;
    }
    
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

function addService(savedConfig = null) {
    serviceCount++;
    const servicesDiv = document.getElementById('services');
    const originalService = document.querySelector('.service-config');
    const newService = originalService.cloneNode(true);
    
    if (savedConfig) {
        // 使用保存的配置填充表单
        newService.querySelector('.service-name').value = savedConfig.name || '';
        newService.querySelector('.service-url').value = savedConfig.url || '';
        newService.querySelector('.request-type').value = savedConfig.request_type || 'json';
        
        if (savedConfig.request_type === 'json') {
            newService.querySelector('.request-body').value = 
                JSON.stringify(savedConfig.request_body || {}, null, 2);
            newService.querySelector('.json-config').style.display = 'block';
            newService.querySelector('.image-config').style.display = 'none';
        } else {
            newService.querySelector('.json-config').style.display = 'none';
            newService.querySelector('.image-config').style.display = 'block';
        }
        
        newService.querySelector('.headers').value = 
            JSON.stringify(savedConfig.headers || {}, null, 2);
    } else {
        // 使用默认值
        newService.querySelector('.service-name').value = '';
        newService.querySelector('.service-url').value = '';
        newService.querySelector('.request-type').value = 'json';
        newService.querySelector('.request-body').value = '{"key1": "value1", "key2": "value2"}';
        newService.querySelector('.headers').value = '{"Content-Type": "application/json"}';
    }
    
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
    const requestTypeSelect = newService.querySelector('.request-type');
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
        // 获取配置
        const config = getConfig();
        
        // 保存配置到 cookie
        saveConfigToCookie(config);
        
        // 验证配置
        if (!config || config.services.length === 0) {
            alert('请至少添加一个服务');
            return;
        }
        
        if (!config.concurrent_users || config.concurrent_users.length === 0) {
            alert('请至少选择一个并发用户数');
            return;
        }

        for (const service of config.services) {
            if (!service.name || !service.url) {
                alert('请填写所有服务的名称和 URL');
                return;
            }
        }
        
        // 隐藏上次的测试结果
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        
        // 销毁上次的图表实例
        if (qpsChartInstance) {
            qpsChartInstance.destroy();
        }
        if (responseTimeChartInstance) {
            responseTimeChartInstance.destroy();
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

            const formData = new FormData();
            
            // 处理图片文件
            config.services.forEach((service, index) => {
                if (service.request_type === 'image' && service.image_path) {
                    formData.append(`image_${index}`, service.image_path);
                    service.image_path = `image_${index}`;
                }
            });
            
            formData.append('config', JSON.stringify(config));

            const response = await fetch('/api/test', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                if (response.status === 666) {
                    alert('请求失败，请检查压测配置及网络策略是否正常');
                    return;
                }
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
    } catch (error) {
        alert(error.message);
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
        // 添加时间戳参数来防止缓存
        qpsChart.src = `${results.qps_plot_url}?t=${new Date().getTime()}`;
        qpsChart.style.display = 'block';
        
        qpsChart.onerror = function() {
            console.error('Failed to load QPS chart');
            this.style.display = 'none';
        };
    }
    
    if (results.response_plot_url) {
        // 添加时间戳参数来防止缓存
        responseTimeChart.src = `${results.response_plot_url}?t=${new Date().getTime()}`;
        responseTimeChart.style.display = 'block';
        
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

// 修改现有的 DOMContentLoaded 事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 加载上次保存的配置
    loadLastConfig();
    
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

// Cookie 操作函数
function saveConfigToCookie(config) {
    const configStr = JSON.stringify(config);
    document.cookie = `lastConfig=${encodeURIComponent(configStr)};path=/;max-age=604800`; // 保存7天
}

function getConfigFromCookie() {
    const cookies = document.cookie.split(';');
    const configCookie = cookies.find(cookie => cookie.trim().startsWith('lastConfig='));
    if (configCookie) {
        try {
            return JSON.parse(decodeURIComponent(configCookie.split('=')[1]));
        } catch (e) {
            console.error('解析配置cookie失败:', e);
            return null;
        }
    }
    return null;
}

function loadLastConfig() {
    const lastConfig = getConfigFromCookie();
    if (!lastConfig) return;

    // 获取第一个服务配置组件
    const firstService = document.querySelector('.service-config');
    if (!firstService) return;

    // 使用第一个配置更新初始服务
    if (lastConfig.services.length > 0) {
        const firstConfig = lastConfig.services[0];
        // 更新第一个服务的值
        firstService.querySelector('.service-name').value = firstConfig.name || '';
        firstService.querySelector('.service-url').value = firstConfig.url || '';
        firstService.querySelector('.request-type').value = firstConfig.request_type || 'json';
        
        if (firstConfig.request_type === 'json') {
            firstService.querySelector('.request-body').value = 
                JSON.stringify(firstConfig.request_body || {}, null, 2);
            firstService.querySelector('.json-config').style.display = 'block';
            firstService.querySelector('.image-config').style.display = 'none';
        } else {
            firstService.querySelector('.json-config').style.display = 'none';
            firstService.querySelector('.image-config').style.display = 'block';
        }
        
        firstService.querySelector('.headers').value = 
            JSON.stringify(firstConfig.headers || {}, null, 2);
    }

    // 添加其他服务配置
    for (let i = 1; i < lastConfig.services.length; i++) {
        addService(lastConfig.services[i]);
    }

    // 设置并发用户数
    document.querySelectorAll('.concurrent-checkbox').forEach(checkbox => {
        checkbox.checked = lastConfig.concurrent_users.includes(parseInt(checkbox.value));
    });

    // 设置每用户请求数
    document.getElementById('requests_per_user').value = lastConfig.requests_per_user;

    // 更新服务概要
    updateServiceSummary();
}

function downloadErrorRecords() {
    fetch('/api/download-errors')
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    alert('没有错误记录文件');
                    return;
                }
                throw new Error('下载失败');
            }
            return response.blob();
        })
        .then(blob => {
            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'error_records.json';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        })
        .catch(error => {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        });
}
