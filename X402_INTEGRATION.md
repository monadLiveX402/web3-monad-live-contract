# X402 协议完整集成指南

## 什么是 X402？

X402 是基于 HTTP 402 状态码的微支付协议，让任何 API 端点都能即时收费。

### 传统方式 vs X402 方式

#### 传统链上支付流程（体验差）
```
用户点击打赏
  ↓
前端直接调用合约
  ↓
MetaMask 弹窗确认
  ↓
等待链上确认（可能几秒到几十秒）
  ↓
前端轮询事件或查询交易状态
  ↓
显示结果
```

**问题**：
- 用户需要等待链上确认
- 前端需要轮询
- 无法统一验证支付
- 不支持 AI Agent 自动支付

#### X402 协议流程（体验好）
```
用户点击打赏
  ↓
前端发送 HTTP 请求到后端
  ↓
后端返回 HTTP 402 + 支付要求（JSON）
  ↓
Thirdweb SDK 自动弹出支付确认
  ↓
用户签名交易
  ↓
后端验证链上交易
  ↓
调用智能合约
  ↓
立即返回结果（200 OK）
  ↓
前端收到响应 → 播放动画
```

**优势**：
- ✅ 后端统一验证支付
- ✅ 前端无需轮询
- ✅ 即时反馈（配合 Monad 0.4s 确认）
- ✅ 支持 AI Agent 自动支付

---

## X402 协议详解

### 1. HTTP 402 状态码

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "paymentDetails": {
    "network": "monad-testnet",
    "chainId": 10143,
    "price": "$1.00",
    "currency": "USDC",
    "recipient": "0x1234...",
    "description": "直播间打赏"
  }
}
```

这是服务器告诉客户端："你需要先支付才能访问这个资源"。

### 2. X402 支付流程图

```
┌─────────────┐
│  前端用户    │
└──────┬──────┘
       │ 1. 点击打赏
       ▼
┌─────────────────────┐
│ wrapFetchWithPayment │ (Thirdweb SDK)
└──────┬──────────────┘
       │ 2. POST /api/tip
       ▼
┌─────────────────────┐
│   后端 Express      │
└──────┬──────────────┘
       │ 3. 返回 402
       ▼
┌─────────────────────┐
│  Thirdweb SDK       │
│  (自动处理签名)      │
└──────┬──────────────┘
       │ 4. 带签名重新请求
       ▼
┌─────────────────────┐
│ settlePayment()     │
│ (验证链上交易)       │
└──────┬──────────────┘
       │ 5. 验证通过
       ▼
┌─────────────────────┐
│  调用智能合约        │
│  liveRoom.tip()     │
└──────┬──────────────┘
       │ 6. 返回 200 OK
       ▼
┌─────────────────────┐
│  前端播放动画        │
└─────────────────────┘
```

---

## 完整代码实现

### 后端：Express + Thirdweb X402

创建 `server/index.js`：

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createThirdwebClient } from "thirdweb";
import { facilitator, settlePayment } from "thirdweb/x402";
import { defineChain } from "thirdweb/chains";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ============ 配置 ============

// Monad 测试网配置
const monadTestnet = defineChain({
  id: 10143,
  rpc: "https://testnet-rpc.monad.xyz",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
});

// Thirdweb 客户端
const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY,
});

// Thirdweb Facilitator（支付处理器）
const twFacilitator = facilitator({
  client,
  serverWalletAddress: process.env.PLATFORM_WALLET,
});

// 连接智能合约
const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const LIVE_ROOM_ADDRESS = process.env.LIVE_ROOM_ADDRESS;
const LIVE_ROOM_ABI = [
  "function tip(uint256 roomId) external payable",
  "event Tipped(uint256 indexed roomId, address indexed tipper, address indexed streamer, uint256 amount, uint256 timestamp)"
];
const liveRoomContract = new ethers.Contract(LIVE_ROOM_ADDRESS, LIVE_ROOM_ABI, signer);

// ============ X402 API 端点 ============

/**
 * 一次性打赏接口（使用 X402 协议）
 *
 * 流程：
 * 1. 前端发起请求（不带支付信息）
 * 2. 后端返回 402 + 支付要求
 * 3. 前端 SDK 自动处理签名
 * 4. 前端带签名重新请求
 * 5. 后端验证支付 + 调用合约
 * 6. 返回 200 OK
 */
app.post("/api/tip", async (req, res) => {
  try {
    const { roomId, amount } = req.body;

    console.log(`[X402] Tip request: roomId=${roomId}, amount=${amount}`);

    // 使用 Thirdweb settlePayment 验证支付
    const result = await settlePayment({
      // 当前请求的 URL（用于验证）
      resourceUrl: `${req.protocol}://${req.get("host")}/api/tip`,
      method: "POST",

      // 前端自动附带的支付数据（第一次请求为空，返回 402 后重新请求会带上）
      paymentData: req.headers["x-payment"],

      // 网络配置
      network: monadTestnet,

      // 支付金额（支持 $0.0001 格式）
      price: `$${amount}`,

      // 收款人（平台钱包，后续再分账）
      payTo: process.env.PLATFORM_WALLET,

      // Facilitator 处理器
      facilitator: twFacilitator,
    });

    // ============ 支付验证成功 ============
    if (result.status === 200) {
      console.log(`[X402] Payment verified, tx: ${result.transactionHash}`);

      // 调用智能合约执行打赏
      const tipAmount = ethers.parseEther(amount.toString());
      const tx = await liveRoomContract.tip(roomId, {
        value: tipAmount,
        gasPrice: ethers.parseUnits("50", "gwei"), // Monad 最低 50 gwei
      });

      console.log(`[Contract] Tip transaction sent: ${tx.hash}`);

      // 等待交易确认（Monad 约 0.4 秒）
      const receipt = await tx.wait();

      console.log(`[Contract] Tip confirmed in block ${receipt.blockNumber}`);

      // 解析事件
      const event = receipt.logs.find(log => {
        try {
          const parsed = liveRoomContract.interface.parseLog(log);
          return parsed.name === "Tipped";
        } catch {
          return false;
        }
      });

      let eventData = null;
      if (event) {
        const parsed = liveRoomContract.interface.parseLog(event);
        eventData = {
          roomId: parsed.args.roomId.toString(),
          tipper: parsed.args.tipper,
          streamer: parsed.args.streamer,
          amount: ethers.formatEther(parsed.args.amount),
          timestamp: parsed.args.timestamp.toString(),
        };
      }

      // 返回成功响应
      res.json({
        success: true,
        message: "打赏成功！",
        data: {
          paymentTx: result.transactionHash,  // X402 支付交易
          contractTx: tx.hash,                // 合约调用交易
          blockNumber: receipt.blockNumber,
          event: eventData,
        },
      });
    }
    // ============ 需要支付（返回 402）============
    else {
      console.log(`[X402] Payment required, status: ${result.status}`);

      // 返回 402 状态码 + 支付要求
      res.status(result.status)
         .set(result.responseHeaders || {})
         .json(result.responseBody);
    }
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 流式打赏开始接口（使用 X402 协议）
 */
app.post("/api/stream/start", async (req, res) => {
  try {
    const { roomId, ratePerSecond, initialBalance } = req.body;

    const result = await settlePayment({
      resourceUrl: `${req.protocol}://${req.get("host")}/api/stream/start`,
      method: "POST",
      paymentData: req.headers["x-payment"],
      network: monadTestnet,
      price: `$${initialBalance}`,
      payTo: process.env.PLATFORM_WALLET,
      facilitator: twFacilitator,
    });

    if (result.status === 200) {
      // TODO: 调用 TipStream 合约 startStream()
      // const tx = await tipStreamContract.startStream(roomId, ratePerSecond, {...});

      res.json({
        success: true,
        message: "流式打赏已开启",
        data: {
          paymentTx: result.transactionHash,
        },
      });
    } else {
      res.status(result.status)
         .set(result.responseHeaders || {})
         .json(result.responseBody);
    }
  } catch (error) {
    console.error("[Error]", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 健康检查
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    network: "monad-testnet",
    chainId: 10143,
  });
});

// ============ 启动服务器 ============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  Monad Live Tipping Server (X402)   ║
╚═══════════════════════════════════════╝

🚀 Server running on http://localhost:${PORT}

📡 Endpoints:
   POST /api/tip              - 一次性打赏（X402）
   POST /api/stream/start     - 流式打赏开始（X402）
   GET  /health               - 健康检查

🔗 Network: Monad Testnet (ChainID: 10143)
📍 Contract: ${LIVE_ROOM_ADDRESS}

⚡ Powered by Thirdweb X402 Protocol
  `);
});
```

---

### 前端：React + Thirdweb X402 SDK

创建 `frontend/src/hooks/useTipping.js`：

```javascript
import { useState } from "react";
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { createWallet } from "thirdweb/wallets";

// Thirdweb 客户端（公开的 clientId）
const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
});

export function useTipping() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 连接钱包
   */
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      const wallet = createWallet("io.metamask");
      await wallet.connect({ client });

      setWallet(wallet);
      return wallet;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 发送打赏（使用 X402 协议）
   *
   * @param {number} roomId - 直播间 ID
   * @param {string} amount - 打赏金额（以太币单位）
   * @returns {Promise<Object>} 打赏结果
   */
  const sendTip = async (roomId, amount) => {
    if (!wallet) {
      throw new Error("请先连接钱包");
    }

    try {
      setLoading(true);
      setError(null);

      // 使用 X402 协议的 fetch 包装器
      const fetchPay = wrapFetchWithPayment(fetch, client, wallet);

      console.log(`[X402] Sending tip: roomId=${roomId}, amount=${amount}`);

      // 发起请求（SDK 会自动处理 402 响应）
      const response = await fetchPay("/api/tip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "打赏失败");
      }

      const result = await response.json();
      console.log("[X402] Tip successful:", result);

      return result;
    } catch (err) {
      console.error("[X402] Tip error:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 开始流式打赏
   */
  const startStream = async (roomId, ratePerSecond, initialBalance) => {
    if (!wallet) {
      throw new Error("请先连接钱包");
    }

    try {
      setLoading(true);
      setError(null);

      const fetchPay = wrapFetchWithPayment(fetch, client, wallet);

      const response = await fetchPay("/api/stream/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          ratePerSecond,
          initialBalance,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "开启流式打赏失败");
      }

      const result = await response.json();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    wallet,
    loading,
    error,
    connectWallet,
    sendTip,
    startStream,
  };
}
```

---

### 前端组件示例

创建 `frontend/src/components/TipButton.jsx`：

```javascript
import React, { useState } from "react";
import { useTipping } from "../hooks/useTipping";

export function TipButton({ roomId, streamerName }) {
  const { wallet, loading, error, connectWallet, sendTip } = useTipping();
  const [showAnimation, setShowAnimation] = useState(false);

  const handleTip = async () => {
    try {
      // 如果未连接钱包，先连接
      if (!wallet) {
        await connectWallet();
      }

      // 发送打赏（X402 协议会自动处理支付流程）
      const result = await sendTip(roomId, "1.0"); // 打赏 1 MON

      console.log("打赏成功！", result);

      // 播放礼物动画
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 3000);

      // 可以在这里触发更多 UI 更新
      // - 更新排行榜
      // - 显示弹幕
      // - 播放音效
    } catch (err) {
      console.error("打赏失败:", err);
      alert(`打赏失败: ${err.message}`);
    }
  };

  return (
    <div className="tip-button-container">
      <button
        onClick={handleTip}
        disabled={loading}
        className="tip-button"
      >
        {loading ? "处理中..." : wallet ? "打赏 1 MON 🚀" : "连接钱包打赏"}
      </button>

      {error && <div className="error">{error}</div>}

      {showAnimation && (
        <div className="gift-animation">
          🚀 礼物飞向 {streamerName}！
        </div>
      )}
    </div>
  );
}
```

---

## 环境变量配置

### 后端 `.env`

```bash
# Thirdweb API Keys
THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key

# Wallet
PRIVATE_KEY=your_private_key
PLATFORM_WALLET=0xYourPlatformWallet

# Contract Addresses
LIVE_ROOM_ADDRESS=0xYourLiveRoomContractAddress
TIP_STREAM_ADDRESS=0xYourTipStreamContractAddress

# Server
PORT=3000
```

### 前端 `.env`

```bash
VITE_THIRDWEB_CLIENT_ID=your_client_id
VITE_API_URL=http://localhost:3000
```

---

## 关键点总结

### X402 的本质
1. **HTTP 协议层**：不是智能合约功能
2. **后端验证**：`settlePayment()` 验证链上支付
3. **前端自动化**：`wrapFetchWithPayment()` 自动处理 402 响应
4. **统一网关**：所有支付请求走同一个后端验证

### 为什么需要 X402？
- ✅ 统一支付验证（防止前端直接调用合约绕过验证）
- ✅ 支持 AI Agent 自动支付
- ✅ 更好的用户体验（后端立即返回，前端无需轮询）
- ✅ 配合 Monad 低延迟，实现毫秒级确认

### X402 vs 传统方式
| 特性 | 传统方式 | X402 方式 |
|------|---------|----------|
| 支付流程 | 前端直接调合约 | 后端统一验证 |
| 确认反馈 | 前端轮询事件 | 后端立即返回 |
| AI Agent | 不支持 | 原生支持 |
| 用户体验 | 需要等待 | 即时反馈 |

---

## 下一步

1. **创建 Thirdweb 账号**：https://thirdweb.com/dashboard
2. **获取 API Keys**：clientId + secretKey
3. **实现后端**：复制上面的 Express 代码
4. **实现前端**：复制 React Hook 代码
5. **测试流程**：先连接钱包 → 点击打赏 → 观察 402 流程

---

这就是 X402 协议的完整实现！它是一个 **HTTP 层的支付协议**，让你的 API 端点可以即时收费，配合 Monad 的低延迟特性，实现真正的实时打赏体验。🚀
