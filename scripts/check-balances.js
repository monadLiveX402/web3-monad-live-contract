import hardhat from "hardhat";
const { ethers, network } = hardhat;

async function main() {
  console.log(`\n💰 检查 Monad 测试网余额...\n`);

  const LIVE_ROOM_ADDRESS = "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";
  const PLATFORM_ADDRESS = "0x500947f01E346093000909882c620b7407129EfB";

  const provider = ethers.provider;

  // 查询合约余额
  const contractBalance = await provider.getBalance(LIVE_ROOM_ADDRESS);
  console.log("📋 LiveRoom 合约余额:");
  console.log(`   地址: ${LIVE_ROOM_ADDRESS}`);
  console.log(`   余额: ${ethers.formatEther(contractBalance)} MON\n`);

  // 查询平台地址余额
  const platformBalance = await provider.getBalance(PLATFORM_ADDRESS);
  console.log("💼 平台收益地址余额:");
  console.log(`   地址: ${PLATFORM_ADDRESS}`);
  console.log(`   余额: ${ethers.formatEther(platformBalance)} MON\n`);

  // 查询合约统计数据
  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = LiveRoom.attach(LIVE_ROOM_ADDRESS);

  const [totalRooms, totalTips, totalVolume] = await liveRoom.getContractStats();
  console.log("📊 合约统计数据:");
  console.log(`   总房间数: ${totalRooms}`);
  console.log(`   总打赏次数: ${totalTips}`);
  console.log(`   总分账金额: ${ethers.formatEther(totalVolume)} MON\n`);

  // 查询 Room #1 数据
  const [streamer, schemeId, active, createdAt, totalReceived, tipCount] = await liveRoom.getRoom(1);
  console.log("🏠 Room #1 统计数据:");
  console.log(`   累计收到: ${ethers.formatEther(totalReceived)} MON`);
  console.log(`   打赏次数: ${tipCount}\n`);

  console.log("🔍 结论:");
  if (contractBalance === 0n) {
    console.log("   ✅ 资金已自动转出,合约余额为 0");
    console.log("   ✅ 所有打赏都自动进入平台地址");
  } else {
    console.log(`   ⚠️  合约内仍有 ${ethers.formatEther(contractBalance)} MON 未转出`);
    console.log("   ⚠️  需要检查分账逻辑");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
