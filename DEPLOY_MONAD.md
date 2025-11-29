# 部署到 Monad 测试网

## 💰 准备工作

### 1. 检查余额
```bash
npx hardhat run scripts/estimate-gas.js --network monad
```

当前状态:
- 账户: `0x0F07CdFa12e37cB52f88CDdBE06Db475cf89f423`
- 余额: `0.2688545 MON`
- 需要: `~0.675 MON` (部署 LiveRoom + TipStream)

### 2. 获取测试币

访问 Monad 测试网水龙头:
```
https://testnet.monad.xyz/faucet
```

或者:
```
https://faucet.monad.xyz
```

需要获取至少 **0.5 MON** 才能成功部署。

## 🚀 部署步骤

### 1. 确认配置

检查 `.env` 文件:
```bash
cat .env
```

应该包含:
```
PRIVATE_KEY=你的私钥
MONAD_RPC_URL=https://testnet.monad.xyz
PLATFORM_ADDRESS=0x500947f01e346093000909882c620b7407129efb
```

### 2. 执行部署

```bash
npx hardhat run scripts/deploy.js --network monad
```

部署完成后会自动:
- ✅ 创建默认分账方案 (主播 95% + 平台 5%)
- ✅ 保存合约地址到 `deployment-info.json`
- ✅ 显示区块链浏览器链接

### 3. 更新前端配置

部署成功后,自动更新 `deployment-info.json`:
```json
{
  "monad": {
    "liveRoom": "0x...",
    "tipStream": "0x..."
  }
}
```

前端会自动读取这个文件。

## 📊 部署后操作

### 1. 查看合约余额
```bash
npx hardhat run scripts/check-balance.js --network monad
```

### 2. 提取合约资金
```bash
npx hardhat run scripts/withdraw-funds.js --network monad
```

资金会提取到 `.env` 中的 `PLATFORM_ADDRESS`。

### 3. 验证合约 (可选)
```bash
npx hardhat verify --network monad <LiveRoom地址>
npx hardhat verify --network monad <TipStream地址>
```

## 🔧 常见问题

### Q: 余额不足
```
Error: Signer had insufficient balance
```

**解决**: 去水龙头获取更多测试币

### Q: Gas price 太低
```
Error: replacement fee too low
```

**解决**: Hardhat 配置已设置 `gasPrice: 50_000_000_000` (50 gwei),应该足够

### Q: RPC 连接失败
```
Error: could not detect network
```

**解决**: 检查 `.env` 中的 `MONAD_RPC_URL` 是否正确

## 📝 当前部署状态

### Sepolia (已部署) ✅
```
LiveRoom:  0xA507D2E850176506Df5228c9bEFB88dfc96f839B
TipStream: 0xc8345A96a53C0A86cC601aB1e619ACeB565920D4
```

### Monad (待部署) ⏳
需要先获取足够的测试币 (~0.5 MON)

## 🎯 快速命令

```bash
# 1. 检查余额
npx hardhat run scripts/estimate-gas.js --network monad

# 2. 部署合约
npx hardhat run scripts/deploy.js --network monad

# 3. 查看部署结果
cat deployment-info.json

# 4. 查看合约余额
npx hardhat run scripts/check-balance.js --network monad

# 5. 提取资金
npx hardhat run scripts/withdraw-funds.js --network monad
```
