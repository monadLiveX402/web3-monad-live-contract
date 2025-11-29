import hardhat from "hardhat";
import fs from "fs";

const { ethers, network } = hardhat;

/**
 * 调试脚本：展示房间分账方案 & 指定交易的分账去向
 *
 * 用法：
 *   ROOM_ID=1 TX_HASH=0x... npx hardhat run scripts/inspect-tip.js --network monad
 *   ROOM_ID=1 npx hardhat run scripts/inspect-tip.js --network sepolia   // 不传 TX_HASH 只看方案/余额
 */
async function main() {
  const roomId = Number(process.env.ROOM_ID || "1");
  const txHash = process.env.TX_HASH;

  // 读取 deployment-info.json
  const deployment = JSON.parse(fs.readFileSync("deployment-info.json", "utf-8"));
  const liveRoomAddress =
    deployment.contracts?.LiveRoom?.address ||
    deployment[network.name]?.liveRoom;

  if (!liveRoomAddress) {
    throw new Error(`deployment-info.json 未找到 ${network.name} 的 LiveRoom 地址`);
  }

  const networkInfo = await ethers.provider.getNetwork();
  console.log(`\n🌐  Network: ${network.name} (chainId=${networkInfo.chainId})`);
  console.log(`🏠  LiveRoom: ${liveRoomAddress}`);
  console.log(`🎯  Room ID:  ${roomId}`);
  if (txHash) console.log(`🔎  Tx:       ${txHash}`);

  // 合约实例
  const liveRoom = await ethers.getContractAt("LiveRoom", liveRoomAddress);

  // 房间与方案
  const room = await liveRoom.getRoom(roomId);
  const schemeId = Number(room[1]);
  console.log("\n📦 Room info");
  console.log(`   streamer: ${room[0]}`);
  console.log(`   schemeId: ${schemeId}`);
  console.log(`   active:   ${room[2]}`);
  console.log(`   totalReceived: ${ethers.formatEther(room[4])} ETH`);
  console.log(`   tipCount: ${room[5].toString()}`);

  const scheme = await liveRoom.getScheme(schemeId);
  console.log("\n🧾 Scheme detail");
  scheme[1].forEach((addr, i) => {
    const pct = Number(scheme[2][i]) / 100;
    console.log(`   - ${addr} : ${pct}%`);
  });

  // 合约余额
  const balance = await ethers.provider.getBalance(liveRoomAddress);
  console.log(`\n💰 Contract balance: ${ethers.formatEther(balance)} ETH`);

  if (!txHash) {
    console.log("\n(未提供 TX_HASH，只展示方案与余额)");
    return;
  }

  // 解析交易日志中的分账明细
  console.log("\n🔍 Decoding RevenueDistributed in tx...");
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  const iface = liveRoom.interface;
  let found = false;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== liveRoomAddress.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "RevenueDistributed") {
        found = true;
        const recipients = parsed.args.recipients;
        const amounts = parsed.args.amounts;
        console.log(`   Total: ${ethers.formatEther(parsed.args.totalAmount)} ETH`);
        recipients.forEach((addr, i) => {
          console.log(
            `   -> ${addr} : ${ethers.formatEther(amounts[i])} ETH`
          );
        });
      }
    } catch (_) {
      // skip non-matching logs
    }
  }

  if (!found) {
    console.log("   未在该交易中找到 RevenueDistributed 事件，确认 txHash/合约地址是否正确。");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
