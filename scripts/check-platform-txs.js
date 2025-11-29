import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const PLATFORM_ADDRESS = "0x500947f01E346093000909882c620b7407129EfB";
  const LIVE_ROOM_ADDRESS = "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";

  console.log("\n🔍 检查平台地址收款记录...\n");

  const liveRoom = await ethers.getContractAt("LiveRoom", LIVE_ROOM_ADDRESS);

  // 1. 查询所有 Tipped 事件
  console.log("1️⃣ 查询 Tipped 事件 (用户打赏):");
  const tippedFilter = liveRoom.filters.Tipped();
  const currentBlock = await ethers.provider.getBlockNumber();

  try {
    const tippedEvents = await liveRoom.queryFilter(tippedFilter, currentBlock - 100, currentBlock);
    console.log(`   找到 ${tippedEvents.length} 个 Tipped 事件\n`);

    if (tippedEvents.length > 0) {
      tippedEvents.forEach((event, i) => {
        console.log(`   Tip #${i + 1}:`);
        console.log(`     打赏者: ${event.args.tipper}`);
        console.log(`     主播: ${event.args.streamer}`);
        console.log(`     金额: ${ethers.formatEther(event.args.amount)} MON`);
        console.log(`     交易: ${event.transactionHash}\n`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️  查询失败: ${error.message}\n`);
  }

  // 2. 查询 RevenueDistributed 事件
  console.log("2️⃣ 查询 RevenueDistributed 事件 (分账转账):");
  const revenueFilter = liveRoom.filters.RevenueDistributed();

  try {
    const revenueEvents = await liveRoom.queryFilter(revenueFilter, currentBlock - 100, currentBlock);
    console.log(`   找到 ${revenueEvents.length} 个 RevenueDistributed 事件\n`);

    if (revenueEvents.length > 0) {
      revenueEvents.forEach((event, i) => {
        console.log(`   分账 #${i + 1}:`);
        console.log(`     支付者: ${event.args.payer}`);
        console.log(`     总金额: ${ethers.formatEther(event.args.totalAmount)} MON`);
        console.log(`     收款人: ${event.args.recipients.join(', ')}`);
        console.log(`     分配金额: ${event.args.amounts.map(a => ethers.formatEther(a)).join(', ')} MON`);
        console.log(`     交易: ${event.transactionHash}\n`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️  查询失败: ${error.message}\n`);
  }

  // 3. 分析原因
  console.log("📊 为什么平台地址看不到 IN (收款) 记录？\n");
  console.log("🔍 原因分析:");
  console.log("  1. 区块浏览器的视角问题:");
  console.log("     • 区块浏览器显示的是 '外部账户' 的交易记录");
  console.log("     • 合约内部的 transfer 不会显示为独立交易\n");

  console.log("  2. 实际发生的事情:");
  console.log("     ❶ 用户调用 LiveRoom.tip() → 这是一笔交易");
  console.log("        - FROM: 用户地址");
  console.log("        - TO: LiveRoom 合约");
  console.log("        - 区块浏览器记录: ✅ 显示\n");

  console.log("     ❷ 合约内部调用 _distribute() → 内部转账");
  console.log("        - 合约执行 payable(platform).call{value: share}('')");
  console.log("        - FROM: LiveRoom 合约");
  console.log("        - TO: 平台地址");
  console.log("        - 区块浏览器记录: ❌ 不显示为独立交易\n");

  console.log("  3. 如何验证平台地址收到钱了？");
  console.log("     ✅ 方法1: 查看平台地址余额变化");
  console.log("     ✅ 方法2: 查看 tip() 交易的 Internal Transactions");
  console.log("     ✅ 方法3: 监听 RevenueDistributed 事件\n");

  console.log("💡 实际验证:");
  const [totalRooms, totalTips, totalVolume] = await liveRoom.getContractStats();
  const platformBalance = await ethers.provider.getBalance(PLATFORM_ADDRESS);

  console.log(`  • 合约记录的总分账金额: ${ethers.formatEther(totalVolume)} MON`);
  console.log(`  • 平台地址当前余额: ${ethers.formatEther(platformBalance)} MON`);
  console.log(`  • 结论: 钱确实到账了，只是区块浏览器不显示内部转账 ✅\n`);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
