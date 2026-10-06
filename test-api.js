const http = require('http');

function testAPI() {
    console.log('Testing registration...');
    
    const registerData = JSON.stringify({ username: 'testuser', password: 'testpass' });
    
    const registerOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': registerData.length
        }
    };
    
    const registerReq = http.request(registerOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Register response:', data);
            
            console.log('\nTesting login...');
            
            const loginData = JSON.stringify({ username: 'testuser', password: 'testpass' });
            
            const loginOptions = {
                hostname: 'localhost',
                port: 3001,
                path: '/api/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': loginData.length
                }
            };
            
            const loginReq = http.request(loginOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('Login response:', data);
                    console.log('\n✅ API测试完成!');
                });
            });
            
            loginReq.on('error', (e) => {
                console.error('Login error:', e.message);
            });
            
            loginReq.write(loginData);
            loginReq.end();
        });
    });
    
    registerReq.on('error', (e) => {
        console.error('Register error:', e.message);
    });
    
    registerReq.write(registerData);
    registerReq.end();
}

testAPI();