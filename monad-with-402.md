# **如何**在 Monad 上**开始使用 x402**

### 什么是 x402？

x402 是 HTTP 402 "需要付款 "状态代码，是互联网原生小额支付的最小协议。

与需要账户的订阅或付费墙不同，x402 让任何 HTTP 端点都能即时付费：

1. 客户端请求资源
2. 服务器响应 402，提出一个小的 JSON 支付要求
3. 客户通过签名交易付款
4. 服务器验证并提供内容

---

### **超越传统限制**

x402 专为现代互联网经济而设计，解决了传统系统的主要局限性：

- **减少费用和摩擦：**直接链上支付，无需中介、高额费用或手动设置。
- **小额支付和按使用计费：**通过简单、可编程的 "即用即付 "流程，按通话或功能收费。
- **机器对机器交易：**让人工智能代理自主支付和访问服务，无需按键或人工输入。

---

### 为什么选择Monad上的x402？

Monad 是与 EVM 完全兼容的第 1 层系统：

- 10,000 TPS
- ~0.4 秒分块时间
- 单槽终结
- 并行执行
- 极低的费用

这些特性使 Monad 成为 ****真正的小额支付和代理对代理商务的理想环境。支付**即时结算，成本低，并避免了内存池拥塞**--这在许多人工智能代理通过 API 调用支付时非常完美。

---

### 核心流程

![无Facilitator的核心流程](attachment:db5c3b3f-b2e9-4cc9-bc2c-9249de4c0947:mermaid-diagram.svg)

无Facilitator的核心流程

Facilitator是可选的，但建议在生产中使用。Facilitator可以处理非常多事情，简化用户操作，比如实现无GAS Token的交易支付。

![带促进器的核心流程](attachment:bebffbde-d95d-4e08-ae7a-8131cd1335ac:mermaid-diagram_(1).svg)

带促进器的核心流程

---

# 教程：使用 Thirdweb Facilitator

本指南介绍如何使用 Thirdweb 内置的Facilitator添加 x402 付款。它适用于 Monad testnet/mainnet 和 170+ EVM 链（Base、Arbitrum、Ethereum、Polygon 等）。

## 前提条件

- Node.js 18 以上
- 一个 EVM 钱包
- 访问 Monad 测试网资金（下面是 USDC 测试代币）

### 步骤 1：创建 Thirdweb 账户并获取密钥

1. 访问<https://thirdweb.com/dashboard>
2. 登录（钱包或电子邮件/谷歌）
3. 创建项目
4. 转到设置 → API 密钥
5. 你会看到两个密钥

    ![image.png](attachment:5042053e-e3ee-41c8-b065-31482e22f027:image.png)

    - clientId → 用于前端/浏览器的安全密钥
    - secretKey → 服务器专用
6. 添加到 .env 文件中：

```bash
THIRDWEB_CLIENT_ID=your_client_id_here
THIRDWEB_SECRET_KEY=your_secret_key_here
RECIPIENT_WALLET=0xYourWallet
```

### 第 2 步：服务器端（Express 示例）

此代码在你的后端（Next.js API 路由、Express 等）运行。

```jsx
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createThirdwebClient } = require("thirdweb");
const { facilitator, settlePayment } = require("thirdweb/x402");
const { defineChain } = require("thirdweb/chains");

const app = express();
app.use(express.json());
app.use(cors());

const monadTestnet = defineChain(10143);
const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY });

const twFacilitator = facilitator({
  client,
  serverWalletAddress: process.env.RECIPIENT_WALLET,
});

app.get("/premium", async (req, res) => {
  try {
    const result = await settlePayment({
      resourceUrl: "http://localhost:3000/premium",
      method: "GET",
      paymentData: req.headers["x-payment"],
      network: monadTestnet,
      price: "$0.0001",
      payTo: process.env.RECIPIENT_WALLET,
      facilitator: twFacilitator,
    });

    if (result.status === 200) {
      res.json({ message: "Paid! Monad is blazing fast ⚡", tx: result.transactionHash });
    } else {
      res.status(result.status).set(result.responseHeaders || {}).json(result.responseBody);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.listen(3000, () => console.log("Server live → http://localhost:3000/premium"));
```

### 第 3 步：客户端（React 示例）

该代码在浏览器或代理脚本中运行。

```tsx
import { useState } from "react";
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { createWallet } from "thirdweb/wallets";
import "./App.css";

const client = createThirdwebClient({
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID || "YOUR_PUBLIC_CLIENT_ID",
});

export default function App() {
  const [message, setMessage] = useState("Click to pay $0.0001 USDC (zero gas on Monad testnet)");

  const payAndFetch = async () => {
    setMessage("Connecting wallet...");
    try {
      const wallet = createWallet("io.metamask");
      await wallet.connect({ client });
      setMessage("Wallet connected — paying...");

      const fetchPay = wrapFetchWithPayment(fetch, client, wallet);
      const res = await fetchPay("/premium"); // relative URL = no CORS
      const json = await res.json();
      setMessage("PAID SUCCESSFULLY! 🎉\n\n" + JSON.stringify(json, null, 2));
    } catch (e: any) {
      setMessage("ERROR: " + e.message);
    }
  };

  return (
    <div style= padding: 24, fontFamily: "system-ui, sans-serif" >
      <h1>Monad testnet x402 — Thirdweb</h1>
      <button onClick={payAndFetch} style= padding: 12, fontSize: 16 >
        Pay & Unlock Content
      </button>
      <pre style= marginTop: 16, background: "#111", color: "#0f0", padding: 12 >
        {message}
      </pre>
    </div>
  );
}
```

用户流程：

1. 点击按钮 → 请求进入服务器
2. 服务器返回 402 → 封装器显示小钱包弹窗（例如，"支付 0.0001 美元USDC？）
3. 用户批准 → 支付完成 → 文章立即加载

---

### 第 4 步：使用龙头进行测试

Circle 的 USDC 令牌地址：

```
0x534b2f3A21130d7a60830c2Df862319e593943A3
```

![image.png](attachment:9f924f20-bae6-4ba4-9201-e588776f8029:image.png)

1. 访问<https://faucet.circle.com/>
2. 选择 Monad Testnet 并输入您的钱包地址
