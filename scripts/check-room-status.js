import hardhat from "hardhat";

const { ethers, network } = hardhat;

async function main() {
  console.log(`\n🔍 Checking Room #1 status on ${network.name}...\n`);

  const LIVE_ROOM_ADDRESS = "0x3E2a676F83CC030C764a9F942bCEeE5657331CE8";
  const TIP_STREAM_ADDRESS = "0x2dAA2b2370F37179E40E815b6D1f05cb107fE8c4";

  // 检查 LiveRoom
  console.log("📋 LiveRoom Contract:");
  const LiveRoom = await ethers.getContractFactory("LiveRoom");
  const liveRoom = LiveRoom.attach(LIVE_ROOM_ADDRESS);

  try {
    const [streamer, schemeId, active, createdAt, totalReceived, tipCount] = await liveRoom.getRoom(1);
    console.log(`   ✅ Room #1 exists in LiveRoom`);
    console.log(`      Streamer: ${streamer}`);
    console.log(`      Scheme ID: ${schemeId}`);
    console.log(`      Active: ${active}`);
    console.log(`      Total Received: ${ethers.formatEther(totalReceived)} MON`);
    console.log(`      Tip Count: ${tipCount}\n`);
  } catch (error) {
    console.log(`   ❌ Room #1 not found in LiveRoom\n`);
  }

  // 检查 TipStream
  console.log("📋 TipStream Contract:");
  const TipStream = await ethers.getContractFactory("TipStream");
  const tipStream = TipStream.attach(TIP_STREAM_ADDRESS);

  const registeredStreamer = await tipStream.roomStreamers(1);
  const registeredScheme = await tipStream.roomSchemes(1);
  const roomActive = await tipStream.roomActive(1);

  if (registeredStreamer !== ethers.ZeroAddress) {
    console.log(`   ✅ Room #1 is registered in TipStream`);
    console.log(`      Streamer: ${registeredStreamer}`);
    console.log(`      Scheme ID: ${registeredScheme}`);
    console.log(`      Active: ${roomActive}\n`);
  } else {
    console.log(`   ❌ Room #1 is NOT registered in TipStream`);
    console.log(`      Need to call: registerRoom(1, 0)\n`);
  }

  console.log("📊 Summary:");
  console.log(`   LiveRoom: ${registeredStreamer === ethers.ZeroAddress ? '❌' : '✅'} Room exists`);
  console.log(`   TipStream: ${registeredStreamer === ethers.ZeroAddress ? '❌ Not registered' : '✅ Registered'}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
