import hre from "hardhat";
import fs from "fs";

/**
 * 查看合约余额
 * 用法:
 *   npx hardhat run scripts/check-balance.js --network monad
 */
async function main() {
  console.log("🔍 查询合约余额...\n");

  // 读取部署信息
  const deploymentInfo = JSON.parse(
    fs.readFileSync("./deployment-info.json", "utf8")
  );

  const network = hre.network.name;

  // 兼容旧格式
  let liveRoomAddress, tipStreamAddress;
  if (deploymentInfo.contracts) {
    liveRoomAddress = deploymentInfo.contracts.LiveRoom?.address;
    tipStreamAddress = deploymentInfo.contracts.TipStream?.address;
  } else if (deploymentInfo[network]) {
    liveRoomAddress = deploymentInfo[network].liveRoom;
    tipStreamAddress = deploymentInfo[network].tipStream;
  }

  if (!liveRoomAddress) {
    console.log("❌ 未找到合约地址");
    console.log("请先运行: npx hardhat run scripts/deploy.js --network monad");
    return;
  }

  console.log(`📍 网络: ${network}\n`);

  // LiveRoom 合约
  const LiveRoom = await hre.ethers.getContractAt("LiveRoom", liveRoomAddress);
  const liveRoomBalance = await hre.ethers.provider.getBalance(liveRoomAddress);

  console.log("📊 LiveRoom 合约:");
  console.log(`   地址: ${liveRoomAddress}`);
  console.log(`   余额: ${hre.ethers.formatEther(liveRoomBalance)} ETH`);

  // TipStream 合约
  let tipStreamBalance = 0n;
  if (tipStreamAddress) {
    tipStreamBalance = await hre.ethers.provider.getBalance(tipStreamAddress);
    console.log("\n📊 TipStream 合约:");
    console.log(`   地址: ${tipStreamAddress}`);
    console.log(`   余额: ${hre.ethers.formatEther(tipStreamBalance)} ETH`);
  }

  // 总余额
  const totalBalance = liveRoomBalance + tipStreamBalance;
  console.log(`\n💰 合约总余额: ${hre.ethers.formatEther(totalBalance)} ETH`);

  // 获取一些统计信息
  try {
    const stats = await LiveRoom.getContractStats();
    console.log("\n📈 LiveRoom 统计:");
    console.log(`   总直播间数: ${stats[0]}`);
    console.log(`   总打赏次数: ${stats[1]}`);
    console.log(`   总交易金额: ${hre.ethers.formatEther(stats[2])} ETH`);
  } catch (err) {
    console.log("\n⚠️  无法获取统计信息");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
