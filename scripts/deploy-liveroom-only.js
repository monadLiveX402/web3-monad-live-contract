import hardhat from "hardhat";
import fs from "fs";

const { ethers, network } = hardhat;

/**
 * 只部署 LiveRoom 合约（节省 Gas）
 *
 * 部署命令：
 * npx hardhat run scripts/deploy-liveroom-only.js --network monad
 */

async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  const chainLabel = network.name !== 'hardhat'
    ? `${network.name} (chainId: ${networkInfo.chainId})`
    : `hardhat (chainId: ${networkInfo.chainId})`;

  console.log(`🚀 Starting LiveRoom deployment to ${chainLabel}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============ 部署 LiveRoom 合约 ============
  console.log("📦 Deploying LiveRoom contract...");

  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = await LiveRoom.deploy();
  await liveRoom.waitForDeployment();

  const liveRoomAddress = await liveRoom.getAddress();
  console.log("✅ LiveRoom deployed to:", liveRoomAddress);

  // ============ 验证部署 ============
  console.log("\n🔍 Verifying deployment...");

  const schemeCount = await liveRoom.getSchemeCount();
  console.log("   LiveRoom scheme count:", schemeCount.toString());

  const [schemeName, recipients, percentages] = await liveRoom.getScheme(0);
  console.log("   Default scheme:", schemeName);
  console.log("   Recipients:", recipients);
  console.log("   Percentages:", percentages.map(p => (Number(p) / 100).toString() + "%"));

  // ============ 输出部署摘要 ============
  console.log("\n" + "=".repeat(60));
  console.log("🎉 LiveRoom Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Address:");
  console.log("   LiveRoom:", liveRoomAddress);

  const explorerPrefix = {
    10143: "https://testnet.monadexplorer.com/address/",
    1: "https://etherscan.io/address/",
    11155111: "https://sepolia.etherscan.io/address/"
  }[Number(networkInfo.chainId)] || "";

  if (explorerPrefix) {
    console.log("\n🔗 Explorer link:");
    console.log("   " + explorerPrefix + liveRoomAddress);
  }

  // ============ 保存部署信息到文件 ============
  const deploymentInfo = {
    network: network.name,
    chainId: Number(networkInfo.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      LiveRoom: {
        address: liveRoomAddress,
        explorer: explorerPrefix ? explorerPrefix + liveRoomAddress : ""
      }
    }
  };

  fs.writeFileSync(
    "./deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📄 Deployment info saved to: deployment-info.json");
  console.log("\n📝 Next Steps:");
  console.log("   1. Update frontend config with LiveRoom address");
  console.log("   2. Test creating a room and tipping");
  console.log("   3. Verify revenue goes to platform address: 0x500947f01E346093000909882c620b7407129EfB");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
