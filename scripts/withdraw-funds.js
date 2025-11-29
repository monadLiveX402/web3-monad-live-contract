import hre from "hardhat";
import fs from "fs";

/**
 * 提取合约中的资金
 * 用法:
 *   npx hardhat run scripts/withdraw-funds.js --network monad
 */
async function main() {
  console.log("🔍 开始提取合约资金...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(
    fs.readFileSync("./deployment-info.json", "utf8")
  );

  const network = hre.network.name;

  // 兼容旧格式
  let liveRoomAddress;
  if (deploymentInfo.contracts) {
    liveRoomAddress = deploymentInfo.contracts.LiveRoom?.address;
  } else if (deploymentInfo[network]) {
    liveRoomAddress = deploymentInfo[network].liveRoom;
  }

  if (!liveRoomAddress) {
    console.log("❌ 未找到合约地址");
    console.log("请先运行: npx hardhat run scripts/deploy.js --network monad");
    return;
  }

  console.log(`📍 网络: ${network}`);
  console.log(`📍 LiveRoom 合约: ${liveRoomAddress}\n`);

  // 获取合约实例
  const LiveRoom = await hre.ethers.getContractAt("LiveRoom", liveRoomAddress);

  // 获取当前账户
  const [signer] = await hre.ethers.getSigners();
  console.log(`👤 操作账户: ${signer.address}`);

  // 检查合约余额
  const balance = await hre.ethers.provider.getBalance(liveRoomAddress);
  const balanceEth = hre.ethers.formatEther(balance);

  console.log(`💰 合约余额: ${balanceEth} ETH\n`);

  if (balance === 0n) {
    console.log("❌ 合约余额为 0，无需提取");
    return;
  }

  // 提取地址（从环境变量读取，默认为部署账户）
  const withdrawTo = process.env.PLATFORM_ADDRESS || signer.address;

  console.log(`📤 提取到地址: ${withdrawTo}`);
  console.log(`💵 提取金额: ${balanceEth} ETH (全部)\n`);

  // 确认
  console.log("⚠️  即将执行提取操作...");

  // 执行提取
  console.log("📡 发送交易...");
  const tx = await LiveRoom.withdraw(withdrawTo, 0); // 0 表示提取全部

  console.log(`📋 交易哈希: ${tx.hash}`);
  console.log("⏳ 等待确认...");

  const receipt = await tx.wait();

  console.log(`\n✅ 提取成功!`);
  console.log(`📦 区块号: ${receipt.blockNumber}`);
  console.log(`⛽ Gas 使用: ${receipt.gasUsed.toString()}`);

  // 验证余额
  const newBalance = await hre.ethers.provider.getBalance(liveRoomAddress);
  console.log(`\n💰 合约剩余余额: ${hre.ethers.formatEther(newBalance)} ETH`);

  // 生成区块链浏览器链接
  if (network === "monad") {
    console.log(`\n🔗 查看交易: https://testnet.monadexplorer.com/tx/${tx.hash}`);
  } else if (network === "sepolia") {
    console.log(`\n🔗 查看交易: https://sepolia.etherscan.io/tx/${tx.hash}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
