# Monad 直播打赏智能合约

基于 Monad 测试链 + X402 协议的实时直播打赏系统

## 项目概述

本项目利用 **Monad** 高性能区块链（10,000 TPS，~0.4s 出块）+ **X402** 微支付协议，实现类似抖音直播的实时打赏体验：
- 几十人同时打赏，无延迟
- 点击礼物 → 几百毫秒内确认 → 立即飞屏
- 极低 Gas 费用，适合高频小额支付

---

## 合约架构

### 三个核心合约

#### ① RevenueShare402.sol - 分账核心
**职责**：管理分账方案，执行链上分账

```solidity
// 分账方案示例
Scheme {
    name: "默认分成",
    recipients: [主播地址, 平台地址],
    percentages: [9500, 500]  // 主播 95%，平台 5%
}

// 统一分账入口
_distribute(schemeId, amount, payer)
```

#### ② LiveRoom.sol - 一次性打赏
**职责**：管理直播间，处理"点一下打赏一笔"

```solidity
// 创建直播间
createRoom(schemeId) → roomId

// 用户打赏
tip(roomId) payable

// 事件监听（前端用于实时动画）
event Tipped(roomId, tipper, streamer, amount, timestamp)
```

#### ③ TipStream.sol - 流式打赏
**职责**：按时间持续打赏，类似"订阅支持"

```solidity
// 开始流式打赏（预存余额）
startStream(roomId, ratePerSecond) payable

// 停止并结算
stopStream() → 自动计算金额并分账

// 充值
topUpStream() payable
```

---

## 技术亮点

### Monad 优势
- **并行执行**：支持高并发打赏
- **0.4s 出块**：实时反馈
- **单槽终结**：无需等待多个确认
- **极低费用**：Gas Price 仅 50 gwei

### X402 协议集成
**X402 不是链上合约路由器**，而是 HTTP 层微支付协议：

```
前端点击打赏
  ↓
HTTP POST /api/tip (带 x-payment header)
  ↓
后端返回 402 状态码 + 支付要求
  ↓
Thirdweb SDK 自动处理钱包签名
  ↓
后端 settlePayment 验证交易
  ↓
调用智能合约 tip() 函数
  ↓
立即返回结果 → 前端播放动画
```

**优势**：
- 后端统一验证支付
- 前端无需轮询链上事件
- 支持 AI Agent 自动支付
- 配合 Monad 实现毫秒级确认

---

## 部署指南

### 1. 环境准备

```bash
# 安装依赖
npm install --legacy-peer-deps

# 配置环境变量
cp .env.example .env
```

编辑 `.env` 文件：
```bash
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
PRIVATE_KEY=你的私钥
```

### 2. 编译合约

```bash
npx hardhat compile
```

### 3. 部署到 Monad 测试网

```bash
npx hardhat run scripts/deploy.js --network monad
```

部署后会输出：
- LiveRoom 合约地址
- TipStream 合约地址
- 保存到 `deployment-info.json`

### 4. 验证合约（可选）

```bash
npx hardhat verify --network monad <合约地址>
```

---

## 使用示例

### 场景 1：主播创建直播间

```javascript
// 主播调用 LiveRoom 合约
const tx = await liveRoom.createRoom(0); // 使用默认分账方案
const receipt = await tx.wait();

// 获取 roomId
const roomId = 1; // 第一个直播间
```

### 场景 2：观众一次性打赏

```javascript
// 观众调用 LiveRoom 合约
await liveRoom.tip(roomId, {
  value: ethers.parseEther("1.0") // 打赏 1 MON
});

// 事件自动触发 → 前端监听 → 播放礼物动画
```

### 场景 3：观众流式打赏

```javascript
// 1. 开始流式打赏（每秒 0.01 MON，预存 10 MON）
await tipStream.startStream(roomId, ethers.parseEther("0.01"), {
  value: ethers.parseEther("10.0")
});

// 2. 观看直播中...（自动按秒计费）

// 3. 停止打赏（自动结算）
await tipStream.stopStream();
// 假设持续了 300 秒，实际支付 3 MON，退还 7 MON
```

---

## X402 后端集成

### Express 服务器示例

```javascript
const { settlePayment, facilitator } = require("thirdweb/x402");

app.post("/api/tip", async (req, res) => {
  const { roomId, amount } = req.body;

  // X402 支付验证
  const result = await settlePayment({
    resourceUrl: "http://localhost:3000/api/tip",
    method: "POST",
    paymentData: req.headers["x-payment"],
    network: monadTestnet,
    price: `$${amount}`,
    payTo: PLATFORM_WALLET,
    facilitator: twFacilitator,
  });

  if (result.status === 200) {
    // 调用合约
    await liveRoomContract.tip(roomId, {
      value: ethers.parseUnits(amount, 18)
    });

    res.json({ success: true, tx: result.transactionHash });
  } else {
    res.status(result.status).json(result.responseBody);
  }
});
```

### 前端集成

```javascript
import { wrapFetchWithPayment } from "thirdweb/x402";

const sendGift = async (roomId) => {
  const wallet = createWallet("io.metamask");
  await wallet.connect({ client });

  const fetchPay = wrapFetchWithPayment(fetch, client, wallet);

  const response = await fetchPay("/api/tip", {
    method: "POST",
    body: JSON.stringify({ roomId, amount: "1.0" })
  });

  if (response.ok) {
    playGiftAnimation(); // 立即播放动画
  }
};
```

---

## 合约 API 文档

### LiveRoom 合约

#### 管理功能
- `createRoom(schemeId)` - 创建直播间
- `updateRoomScheme(roomId, schemeId)` - 更新分账方案
- `setRoomActive(roomId, active)` - 启用/禁用直播间

#### 打赏功能
- `tip(roomId) payable` - 一次性打赏
- `tipMultiple(roomId, count) payable` - 批量打赏（连击）

#### 查询功能
- `getRoom(roomId)` - 获取直播间信息
- `getStreamerRooms(address)` - 获取主播的所有直播间
- `getUserStats(address)` - 获取用户打赏统计
- `getRecentTips(limit)` - 获取最近打赏记录
- `getRoomTips(roomId, limit)` - 获取指定直播间打赏记录

### TipStream 合约

#### 核心功能
- `registerRoom(roomId, schemeId)` - 注册直播间用于流式打赏
- `startStream(roomId, ratePerSecond) payable` - 开始流式打赏
- `stopStream()` - 停止并结算
- `topUpStream() payable` - 充值余额

#### 查询功能
- `getStream(address)` - 获取用户当前流状态
- `isStreamLowBalance(address)` - 检查余额是否不足
- `getStreamStats()` - 获取合约统计数据

### RevenueShare402 合约

#### 分账方案管理
- `createScheme(name, recipients, percentages)` - 创建分账方案
- `updateScheme(schemeId, ...)` - 更新分账方案
- `setSchemeActive(schemeId, active)` - 启用/禁用方案

#### 查询功能
- `getScheme(schemeId)` - 获取方案详情
- `getSchemeIdByName(name)` - 通过名称查询方案
- `getStats()` - 获取统计数据

---

## 测试

运行测试（需要先安装测试依赖）：

```bash
npm install --save-dev @nomicfoundation/hardhat-chai-matchers chai
npx hardhat test
```

---

## 网络信息

### Monad Testnet
- RPC URL: `https://testnet-rpc.monad.xyz`
- ChainID: `10143`
- 浏览器: https://testnet.monadexplorer.com/
- 水龙头: https://testnet.monad.xyz

### 测试代币地址
- USDC: `0xf817257fed379853cDe0fa4F97AB987181B1E5Ea`
- USDT: `0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D`
- WETH: `0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37`

---

## 项目文件结构

```
web3-monad-live-contract/
├── contracts/
│   ├── RevenueShare402.sol    # 分账核心
│   ├── LiveRoom.sol            # 一次性打赏
│   └── TipStream.sol           # 流式打赏
├── scripts/
│   └── deploy.js               # 部署脚本
├── test/
│   └── LiveRoom.test.js        # 测试用例
├── hardhat.config.js           # Hardhat 配置
├── .env.example                # 环境变量模板
└── deployment-info.json        # 部署信息（自动生成）
```

---

## 黑客松演示要点

### 核心亮点
1. **技术创新**：Monad 并行执行 + X402 协议，解决链上打赏延迟问题
2. **用户体验**：点击打赏 → 几百毫秒确认 → 实时飞屏
3. **高并发**：支持几十人同时打赏，无拥堵
4. **真实场景**：直播打赏是 Web2 成熟场景，Web3 化具有实际价值

### Demo 流程建议
1. 展示主播创建直播间
2. 多个观众同时打赏（展示并发能力）
3. 前端实时显示礼物动画
4. 浏览器查看链上交易（展示毫秒级确认）
5. 展示流式打赏功能（独特卖点）

---

## 下一步开发

### 短期（黑客松前）
- [ ] 前端直播间 UI
- [ ] 礼物动画效果
- [ ] 实时榜单统计
- [ ] 后端 X402 集成

### 中期
- [ ] 礼物 NFT 化（高价值礼物）
- [ ] 多币种支持（USDC, USDT）
- [ ] 主播提现功能优化
- [ ] 移动端适配

### 长期
- [ ] 跨链桥接
- [ ] DAO 治理
- [ ] 二级市场
- [ ] 更多互动玩法

---

## 联系方式

- 项目仓库: https://github.com/kkLiveGo/web3-monad-live-contract
- Monad 文档: https://docs.monad.xyz/
- X402 协议: https://github.com/thirdweb-dev/x402

---

## License

MIT License
