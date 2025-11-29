import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");

  const PLATFORM_ADDRESS = "0x500947f01E346093000909882c620b7407129EfB";
  const LIVE_ROOM_ADDRESS = "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";

  console.log("\\n💡 分析平台地址打赏流程...\\n");
  console.log("平台地址:", PLATFORM_ADDRESS);
  console.log("LiveRoom 合约:", LIVE_ROOM_ADDRESS);
  console.log("");

  // 查询当前余额
  const platformBalance = await provider.getBalance(PLATFORM_ADDRESS);
  const contractBalance = await provider.getBalance(LIVE_ROOM_ADDRESS);

  console.log("📊 当前余额:");
  console.log(`  平台地址: ${ethers.formatEther(platformBalance)} MON`);
  console.log(`  LiveRoom 合约: ${ethers.formatEther(contractBalance)} MON`);
  console.log("");

  // 查询合约统计数据
  const liveRoomAbi = [
    "function getContractStats() view returns (uint256, uint256, uint256)",
    "function getRoom(uint256) view returns (address, uint256, bool, uint256, uint256, uint256)"
  ];

  const liveRoom = new ethers.Contract(LIVE_ROOM_ADDRESS, liveRoomAbi, provider);
  const [totalRooms, totalTips, totalVolume] = await liveRoom.getContractStats();

  console.log("📈 合约统计:");
  console.log(`  总房间数: ${totalRooms}`);
  console.log(`  总打赏次数: ${totalTips}`);
  console.log(`  总分账金额: ${ethers.formatEther(totalVolume)} MON`);
  console.log("");

  // 查询 Room #1
  const [streamer, schemeId, active, createdAt, totalReceived, tipCount] = await liveRoom.getRoom(1);

  console.log("🏠 Room #1:");
  console.log(`  主播地址: ${streamer}`);
  console.log(`  累计收到: ${ethers.formatEther(totalReceived)} MON`);
  console.log(`  打赏次数: ${tipCount}`);
  console.log("");

  console.log("🔍 结论:");
  console.log("─".repeat(60));

  const isSameAddress = streamer.toLowerCase() === PLATFORM_ADDRESS.toLowerCase();

  if (isSameAddress) {
    console.log("✅ 检测到：主播地址 = 平台地址");
    console.log("");
    console.log("📌 这意味着:");
    console.log("  1. 你用平台地址发起打赏 → OUT (转出到合约)");
    console.log("  2. 合约自动分账:");
    console.log(`     - 95% → ${PLATFORM_ADDRESS} (平台地址)`);
    console.log(`     - 5%  → ${PLATFORM_ADDRESS} (平台地址)`);
    console.log("  3. 结果: 钱转了一圈回到平台地址 (扣除 gas 费)");
    console.log("");
    console.log("💡 这是正常的！如果是其他用户打赏:");
    console.log("  - 其他用户地址 → OUT (转出到合约)");
    console.log("  - 平台地址 → IN (收到 100% 分账)");
  }

  if (contractBalance === BigInt(0)) {
    console.log("");
    console.log("✅ LiveRoom 合约余额 = 0");
    console.log("   说明所有资金都已自动转出，没有留在合约");
  }

  console.log("─".repeat(60));
}

main().catch(console.error);
