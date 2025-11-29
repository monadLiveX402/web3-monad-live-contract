import hardhat from "hardhat";
import fs from "fs";

const { ethers, network } = hardhat;

/**
 * 部署脚本 - Monad / Ethereum
 *
 * 部署命令示例：
 * npx hardhat run scripts/deploy.js --network monad
 * npx hardhat run scripts/deploy.js --network sepolia
 * npx hardhat run scripts/deploy.js --network ethereum
 */

async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  const chainLabel = network.name !== 'hardhat'
    ? `${network.name} (chainId: ${networkInfo.chainId})`
    : `hardhat (chainId: ${networkInfo.chainId})`;

  console.log(`🚀 Starting deployment to ${chainLabel}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============ 1. 部署 LiveRoom 合约 ============
  console.log("📦 Deploying LiveRoom contract...");

  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = await LiveRoom.deploy();
  await liveRoom.waitForDeployment();

  const liveRoomAddress = await liveRoom.getAddress();
  console.log("✅ LiveRoom deployed to:", liveRoomAddress);

  // ============ 2. 部署 TipStream 合约 ============
  console.log("\n📦 Deploying TipStream contract...");

  const TipStream = await ethers.getContractFactory("TipStream");
  const tipStream = await TipStream.deploy();
  await tipStream.waitForDeployment();

  const tipStreamAddress = await tipStream.getAddress();
  console.log("✅ TipStream deployed to:", tipStreamAddress);

  // ============ 3. 验证部署 ============
  console.log("\n🔍 Verifying deployments...");

  // 检查 LiveRoom 默认分账方案
  const schemeCount = await liveRoom.getSchemeCount();
  console.log("   LiveRoom scheme count:", schemeCount.toString());

  const [schemeName, recipients, percentages] = await liveRoom.getScheme(0);
  console.log("   Default scheme:", schemeName);
  console.log("   Recipients:", recipients);
  console.log("   Percentages:", percentages.map(p => (Number(p) / 100).toString() + "%"));

  // 检查 TipStream 统计
  const [totalStreamAmount, activeStreamCount] = await tipStream.getStreamStats();
  console.log("\n   TipStream initialized:");
  console.log("   Active streams:", activeStreamCount.toString());
  console.log("   Total stream amount:", ethers.formatEther(totalStreamAmount), "MON");

  // ============ 4. 更新默认分账方案，避免资金打回合约 ============
  const primaryRecipient = process.env.STREAMER_ADDRESS || deployer.address;
  const platformRecipient = process.env.PLATFORM_ADDRESS || deployer.address;
  const primaryPct = Number(process.env.PRIMARY_PCT || "9500"); // 默认 95%
  const platformPct = 10000 - primaryPct; // 剩余给平台

  console.log("\n🧾 Updating default scheme (schemeId 0) for LiveRoom & TipStream");
  console.log("   Primary:", primaryRecipient, `${primaryPct / 100}%`);
  console.log("   Platform:", platformRecipient, `${platformPct / 100}%`);

  const recipients = [primaryRecipient, platformRecipient];
  const percentages = [primaryPct, platformPct];

  // LiveRoom 默认方案
  const txSchemeLive = await liveRoom.updateScheme(
    0,
    "Default",
    recipients,
    percentages,
    true
  );
  await txSchemeLive.wait();
  console.log("   LiveRoom scheme 0 updated");

  // TipStream 默认方案
  const txSchemeStream = await tipStream.updateScheme(
    0,
    "Default",
    recipients,
    percentages,
    true
  );
  await txSchemeStream.wait();
  console.log("   TipStream scheme 0 updated");

  // ============ 5. 输出部署摘要 ============
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   LiveRoom:  ", liveRoomAddress);
  console.log("   TipStream: ", tipStreamAddress);

  console.log("\n📝 Next Steps:");
  console.log(`   1. Verify contracts (network: ${network.name}):`);
  console.log(`      npx hardhat verify --network ${network.name} ${liveRoomAddress}`);
  console.log(`      npx hardhat verify --network ${network.name} ${tipStreamAddress}`);
  console.log("\n   2. Update frontend config with contract addresses");
  console.log("   3. Create custom revenue schemes if needed");
  console.log("   4. Test with small amounts first");

  const explorerPrefix = {
    10143: "https://testnet.monadexplorer.com/address/",
    1: "https://etherscan.io/address/",
    11155111: "https://sepolia.etherscan.io/address/"
  }[Number(networkInfo.chainId)] || "";

  if (explorerPrefix) {
    console.log("\n🔗 Explorer links:");
    console.log("   " + explorerPrefix + liveRoomAddress);
    console.log("   " + explorerPrefix + tipStreamAddress);
  }

  // ============ 5. 保存部署信息到文件 ============
  const deploymentInfo = {
    network: network.name,
    chainId: Number(networkInfo.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      LiveRoom: {
        address: liveRoomAddress,
        explorer: explorerPrefix ? `${explorerPrefix}${liveRoomAddress}` : undefined
      },
      TipStream: {
        address: tipStreamAddress,
        explorer: explorerPrefix ? `${explorerPrefix}${tipStreamAddress}` : undefined
      }
    }
  };

  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployment-info.json");

  console.log("\n" + "=".repeat(60) + "\n");
}

// 执行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
