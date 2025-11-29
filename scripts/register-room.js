import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const { ethers, network } = hardhat;

/**
 * 注册直播间到 TipStream 合约
 *
 * 使用方法：
 * ROOM_ID=1 SCHEME_ID=0 npx hardhat run scripts/register-room.js --network monad
 */

async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  console.log(`\n🔗 Network: ${network.name} (chainId: ${networkInfo.chainId})\n`);

  const [deployer] = await ethers.getSigners();
  console.log("📍 Account:", deployer.address);

  // 从环境变量获取参数
  const roomId = process.env.ROOM_ID || "1";
  const schemeId = process.env.SCHEME_ID || "1"; // 使用房间特定的 scheme

  // TipStream 合约地址
  const TIP_STREAM_ADDRESS = process.env.TIP_STREAM_ADDRESS || "0x2dAA2b2370F37179E40E815b6D1f05cb107fE8c4";
  const LIVE_ROOM_ADDRESS = process.env.LIVE_ROOM_ADDRESS || "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";

  console.log(`\n📋 Parameters:`);
  console.log(`   Room ID: ${roomId}`);
  console.log(`   Scheme ID: ${schemeId}`);
  console.log(`   TipStream Address: ${TIP_STREAM_ADDRESS}`);
  console.log(`   LiveRoom Address: ${LIVE_ROOM_ADDRESS}\n`);

  // 获取 LiveRoom 合约
  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = LiveRoom.attach(LIVE_ROOM_ADDRESS);

  // 检查房间是否存在
  console.log("🔍 Checking if room exists...");
  try {
    const [streamer, _schemeId, active] = await liveRoom.getRoom(roomId);
    console.log(`   ✅ Room #${roomId} found:`);
    console.log(`      Streamer: ${streamer}`);
    console.log(`      Scheme ID: ${_schemeId}`);
    console.log(`      Active: ${active}\n`);

    // 使用房间实际的 schemeId
    const actualSchemeId = _schemeId;

    // 获取 TipStream 合约
    const TipStream = await ethers.getContractFactory("TipStream");
    const tipStream = TipStream.attach(TIP_STREAM_ADDRESS);

    // 检查是否已注册
    const registeredStreamer = await tipStream.roomStreamers(roomId);
    if (registeredStreamer !== ethers.ZeroAddress) {
      console.log(`⚠️  Room #${roomId} already registered in TipStream`);
      console.log(`   Registered streamer: ${registeredStreamer}\n`);
      return;
    }

    // 注册房间
    console.log(`📝 Registering Room #${roomId} to TipStream...`);
    const tx = await tipStream.registerRoom(roomId, actualSchemeId);
    console.log(`   Transaction hash: ${tx.hash}`);

    console.log("   Waiting for confirmation...");
    await tx.wait();

    console.log(`   ✅ Room #${roomId} registered successfully!\n`);

    // 验证注册
    const verifyStreamer = await tipStream.roomStreamers(roomId);
    const verifyScheme = await tipStream.roomSchemes(roomId);
    const verifyActive = await tipStream.roomActive(roomId);

    console.log("🔍 Verification:");
    console.log(`   Streamer: ${verifyStreamer}`);
    console.log(`   Scheme ID: ${verifyScheme}`);
    console.log(`   Active: ${verifyActive}\n`);

  } catch (error) {
    if (error.message.includes("Room not found")) {
      console.error(`❌ Room #${roomId} does not exist in LiveRoom contract`);
      console.error(`   Please create the room first using create-room.js\n`);
    } else {
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:");
    console.error(error);
    process.exit(1);
  });
