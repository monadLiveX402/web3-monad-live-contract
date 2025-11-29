import hardhat from "hardhat";
import fs from "fs";

const { ethers, network } = hardhat;

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

  // ============ 部署 UnifiedTipping 合约 ============
  console.log("📦 Deploying UnifiedTipping contract...");

  const UnifiedTipping = await ethers.getContractFactory("UnifiedTipping");
  const unifiedTipping = await UnifiedTipping.deploy();
  await unifiedTipping.waitForDeployment();

  const unifiedTippingAddress = await unifiedTipping.getAddress();
  console.log("✅ UnifiedTipping deployed to:", unifiedTippingAddress);

  // ============ 输出部署摘要 ============
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   UnifiedTipping: ", unifiedTippingAddress);

  console.log("\n📝 Next Steps:");
  console.log(`   1. Verify contracts (network: ${network.name}):`);
  console.log(`      npx hardhat verify --network ${network.name} ${unifiedTippingAddress}`);
  console.log("\n   2. Update frontend config with contract address");
  console.log("   3. Test with small amounts first");

  const explorerPrefix = {
    10143: "https://testnet.monadexplorer.com/address/",
    1: "https://etherscan.io/address/",
    11155111: "https://sepolia.etherscan.io/address/"
  }[Number(networkInfo.chainId)] || "";

  if (explorerPrefix) {
    console.log("\n🔗 Explorer links:");
    console.log("   " + explorerPrefix + unifiedTippingAddress);
  }

  // ============ 保存部署信息到文件 ============
  const deploymentInfo = {
    network: network.name,
    chainId: Number(networkInfo.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      UnifiedTipping: {
        address: unifiedTippingAddress,
        explorer: explorerPrefix ? `${explorerPrefix}${unifiedTippingAddress}` : undefined
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
