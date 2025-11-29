import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  console.log("\n🚀 部署统一直播间合约 (UnifiedLiveRoom)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 部署账户:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "MON\n");

  // 部署 UnifiedLiveRoom
  console.log("📦 部署 UnifiedLiveRoom...");
  const UnifiedLiveRoom = await ethers.getContractFactory("UnifiedLiveRoom");
  const unifiedLiveRoom = await UnifiedLiveRoom.deploy();
  await unifiedLiveRoom.waitForDeployment();

  const unifiedAddress = await unifiedLiveRoom.getAddress();
  console.log("✅ UnifiedLiveRoom 已部署:", unifiedAddress);
  console.log("");

  // 验证部署
  console.log("🔍 验证部署...");
  const [totalRooms, totalTips, totalVolume] = await unifiedLiveRoom.getContractStats();
  console.log("   总房间数:", totalRooms.toString());
  console.log("   总打赏次数:", totalTips.toString());
  console.log("   总分账金额:", ethers.formatEther(totalVolume), "MON");
  console.log("");

  // 保存部署信息
  const deploymentInfo = {
    network: hardhat.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    unifiedLiveRoom: unifiedAddress,
    deployedAt: new Date().toISOString(),
  };

  const fs = await import('fs');
  fs.writeFileSync(
    'deployment-unified-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("📄 部署信息已保存到 deployment-unified-info.json");
  console.log("");

  console.log("✨ 部署完成！");
  console.log("");
  console.log("📋 配置信息:");
  console.log("─".repeat(60));
  console.log(`Network: ${hardhat.network.name}`);
  console.log(`UnifiedLiveRoom: ${unifiedAddress}`);
  console.log("─".repeat(60));
  console.log("");

  console.log("🔧 更新前端配置:");
  console.log(`   NEXT_PUBLIC_MONAD_UNIFIED_LIVE_ROOM_ADDRESS=${unifiedAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
