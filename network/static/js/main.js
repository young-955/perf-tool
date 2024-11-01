let serviceCount = 0;

function addService() {
    serviceCount++;
    const servicesDiv = document.getElementById('services');
    const originalService = document.querySelector('.service-config');
    const newService = originalService.cloneNode(true);
    
    // 清空新服务的输入值
    newService.querySelector('.service-name').value = '';
    newService.querySelector('.service-url').value = '';
    newService.querySelector('.request-body').value = '{"key1": "value1", "key2": "value2"}';
    newService.querySelector('.headers').value = '{"Content-Type": "application/json"}';
    
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
    newService.querySelector('.request-type').addEventListener('change', function(e) {
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
    const config = getConfig();
    
    // 验证配置
    if (config.services.length === 0) {
        alert('请至少添加一个服务');
        return;
    }

    for (const service of config.services) {
        if (!service.name || !service.url) {
            alert('请填写所有服务的名称和 URL');
            return;
        }
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
    
    return {
        services: services,
        concurrent_users: document.getElementById('concurrent_users').value.split(',').map(Number),
        requests_per_user: parseInt(document.getElementById('requests_per_user').value)
    };
}

function displayResults(results) {
    document.getElementById('results').style.display = 'block';
    
    // 显示图表
    displayCharts(results);
    
    // 显示表格
    displayTable(results);
}

function displayCharts(results) {
    // QPS图表
    new Chart(document.getElementById('qpsChart'), {
        type: 'line',
        data: {
            labels: results.concurrent_users,
            datasets: results.services.map(service => ({
                label: service.name,
                data: service.qps,
                fill: false
            }))
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'QPS对比'
            }
        }
    });
    
    // 响应时间图表
    new Chart(document.getElementById('responseTimeChart'), {
        type: 'line',
        data: {
            labels: results.concurrent_users,
            datasets: results.services.map(service => ({
                label: service.name,
                data: service.response_times,
                fill: false
            }))
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: '平均响应时间对比'
            }
        }
    });
}

function displayTable(results) {
    // 创建结果表格
    const table = document.createElement('table');
    // ... 表格创建代码 ...
}

function downloadResults() {
    // 触发服务器端的文件下载
    window.location.href = '/api/download-results';
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