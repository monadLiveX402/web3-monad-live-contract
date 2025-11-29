# 快速开始指南

## 5 分钟部署到 Monad 测试网

### 1. 准备工作（1 分钟）

```bash
# 克隆并进入项目
cd web3-monad-live-contract

# 安装依赖
npm install --legacy-peer-deps

# 配置环境变量
cp .env.example .env
```

编辑 `.env`：
```bash
PRIVATE_KEY=你的钱包私钥（不要包含 0x）
```

### 2. 获取测试币（2 分钟）

访问 Monad 测试网水龙头：
- https://testnet.monad.xyz
- 输入你的钱包地址
- 领取 MON 测试币

### 3. 编译合约（1 分钟）

```bash
npx hardhat compile
```

输出：
```
Compiled 3 Solidity files successfully
```

### 4. 部署合约（1 分钟）

```bash
npx hardhat run scripts/deploy.js --network monad
```

输出示例：
```
🚀 Starting deployment to Monad Testnet...

📍 Deploying contracts with account: 0x1234...
💰 Account balance: 10.0 MON

✅ LiveRoom deployed to: 0xABC...
✅ TipStream deployed to: 0xDEF...

🎉 Deployment Complete!
```

### 5. 验证部署（可选）

查看 `deployment-info.json` 文件：
```json
{
  "network": "monad-testnet",
  "chainId": 10143,
  "contracts": {
    "LiveRoom": {
      "address": "0xABC...",
      "explorer": "https://testnet.monadexplorer.com/address/0xABC..."
    },
    "TipStream": {
      "address": "0xDEF...",
      "explorer": "https://testnet.monadexplorer.com/address/0xDEF..."
    }
  }
}
```

---

## 测试合约功能

### 使用 Hardhat Console

```bash
npx hardhat console --network monad
```

```javascript
// 连接合约
const LiveRoom = await ethers.getContractFactory("LiveRoom");
const liveRoom = LiveRoom.attach("0xABC..."); // 替换为你的合约地址

// 创建直播间
const tx = await liveRoom.createRoom(0);
await tx.wait();
console.log("直播间已创建，roomId = 1");

// 打赏测试
const tipTx = await liveRoom.tip(1, {
  value: ethers.parseEther("1.0")
});
await tipTx.wait();
console.log("打赏成功！");

// 查询直播间
const room = await liveRoom.getRoom(1);
console.log("直播间信息：", room);
```

---

## 常见问题

### Q: 编译失败怎么办？

```bash
# 清除缓存重新编译
rm -rf cache artifacts
npx hardhat clean
npx hardhat compile
```

### Q: 部署失败 "insufficient funds"？

确保你的钱包有足够的 MON 测试币：
- 访问水龙头：https://testnet.monad.xyz
- 检查余额：`npx hardhat run scripts/check-balance.js --network monad`

### Q: Gas Price 太低怎么办？

Monad 最低要求 50 gwei，配置已设置，无需修改。

### Q: 如何查看交易详情？

访问 Monad 浏览器：
- https://testnet.monadexplorer.com/
- 搜索你的钱包地址或交易哈希

---

## 下一步

1. **阅读完整文档**：[CONTRACT_README.md](CONTRACT_README.md)
2. **集成前端**：使用 Thirdweb SDK 连接合约
3. **添加 X402**：参考 `monad-with-402.md` 集成支付协议
4. **运行测试**：`npx hardhat test`（需要先安装测试依赖）

---

## 需要帮助？

- Monad 文档：https://docs.monad.xyz/
- Hardhat 文档：https://hardhat.org/
- 项目 Issues：https://github.com/kkLiveGo/web3-monad-live-contract/issues
