import hardhat from "hardhat";
import fs from "fs";

const { ethers, network } = hardhat;

/**
 * 部署 TipStream 合约脚本
 *
 * 部署命令：
 * npx hardhat run scripts/deploy-tipstream-only.js --network monad
 * npx hardhat run scripts/deploy-tipstream-only.js --network sepolia
 */

async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  const chainLabel = network.name !== 'hardhat'
    ? `${network.name} (chainId: ${networkInfo.chainId})`
    : `hardhat (chainId: ${networkInfo.chainId})`;

  console.log(`🚀 Starting TipStream deployment to ${chainLabel}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contract with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============ 部署 TipStream 合约 ============
  console.log("📦 Deploying TipStream contract...");

  const TipStream = await ethers.getContractFactory("TipStream");
  const tipStream = await TipStream.deploy();
  await tipStream.waitForDeployment();

  const tipStreamAddress = await tipStream.getAddress();
  console.log("✅ TipStream deployed to:", tipStreamAddress);

  // ============ 验证部署 ============
  console.log("\n🔍 Verifying deployment...");

  // 检查 TipStream 统计
  const [totalStreamAmount, activeStreamCount, totalStreams] = await tipStream.getStreamStats();
  console.log("   TipStream initialized:");
  console.log("   Active streams:", activeStreamCount.toString());
  console.log("   Total streams:", totalStreams.toString());
  console.log("   Total stream amount:", ethers.formatEther(totalStreamAmount), network.name === 'monad' ? 'MON' : 'ETH');

  // 检查默认分账方案
  const schemeCount = await tipStream.getSchemeCount();
  console.log("\n   Default scheme count:", schemeCount.toString());

  // ============ 输出部署摘要 ============
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Address:");
  console.log("   TipStream:", tipStreamAddress);

  const explorerPrefix = {
    10143: "https://testnet.monadexplorer.com/address/",
    1: "https://etherscan.io/address/",
    11155111: "https://sepolia.etherscan.io/address/"
  }[Number(networkInfo.chainId)] || "";

  if (explorerPrefix) {
    console.log("\n🔗 Explorer link:");
    console.log("   " + explorerPrefix + tipStreamAddress);
  }

  console.log("\n📝 Next Steps:");
  console.log("   1. Update deployment-info.ts with the TipStream address");
  console.log("   2. Register Room #1 using registerRoom() function");
  console.log("   3. Test stream tipping functionality");

  // ============ 保存部署信息 ============
  const deploymentInfo = {
    network: network.name,
    chainId: Number(networkInfo.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TipStream: {
        address: tipStreamAddress,
        explorer: explorerPrefix ? `${explorerPrefix}${tipStreamAddress}` : ""
      }
    }
  };

  fs.writeFileSync(
    'deployment-tipstream-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployment-tipstream-info.json");

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
