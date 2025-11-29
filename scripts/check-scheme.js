import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  console.log("\n🔍 检查分账方案配置...\n");

  const LIVE_ROOM_ADDRESS = "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";
  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = LiveRoom.attach(LIVE_ROOM_ADDRESS);

  // 查询 Room #1 的分账方案
  const [streamer, schemeId, active, createdAt, totalReceived, tipCount] = await liveRoom.getRoom(1);
  
  console.log("🏠 Room #1 信息:");
  console.log(`   Streamer: ${streamer}`);
  console.log(`   Scheme ID: ${schemeId}`);
  console.log(`   Active: ${active}\n`);

  // 查询该分账方案的详情
  console.log(`📋 分账方案 #${schemeId} 详情:`);
  const [name, recipients, percentages, schemeActive, schemeCreatedAt] = await liveRoom.getScheme(schemeId);
  
  console.log(`   Name: ${name}`);
  console.log(`   Active: ${schemeActive}`);
  console.log(`   Recipients (${recipients.length}):`);
  
  for (let i = 0; i < recipients.length; i++) {
    console.log(`     [${i}] ${recipients[i]} → ${percentages[i] / 100}%`);
  }
  
  // 检查是否都是平台地址
  const PLATFORM_ADDRESS = "0x500947f01E346093000909882c620b7407129EfB";
  console.log(`\n🔍 验证收款人地址:`);
  
  let allCorrect = true;
  for (let i = 0; i < recipients.length; i++) {
    const isCorrect = recipients[i].toLowerCase() === PLATFORM_ADDRESS.toLowerCase();
    console.log(`   [${i}] ${isCorrect ? '✅' : '❌'} ${recipients[i]} ${isCorrect ? '(平台地址)' : '(错误地址)'}`);
    if (!isCorrect) allCorrect = false;
  }
  
  if (allCorrect) {
    console.log(`\n✅ 分账方案配置正确，所有收款人都是平台地址`);
  } else {
    console.log(`\n❌ 分账方案配置错误！需要修复`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
