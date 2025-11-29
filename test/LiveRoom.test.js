const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiveRoom Contract", function () {
  let liveRoom;
  let owner, streamer, tipper1, tipper2, platform;

  beforeEach(async function () {
    [owner, streamer, tipper1, tipper2, platform] = await ethers.getSigners();

    const LiveRoom = await ethers.getContractFactory("LiveRoom");
    liveRoom = await LiveRoom.deploy();
    await liveRoom.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await liveRoom.getAddress()).to.be.properAddress;
    });

    it("Should create default revenue scheme", async function () {
      const schemeCount = await liveRoom.getSchemeCount();
      expect(schemeCount).to.equal(1);

      const [name, recipients, percentages, active] = await liveRoom.getScheme(0);
      expect(name).to.equal("Default");
      expect(active).to.be.true;
      expect(percentages.length).to.equal(2);
    });
  });

  describe("Revenue Scheme Management", function () {
    it("Should create custom revenue scheme", async function () {
      const recipients = [streamer.address, platform.address];
      const percentages = [9000, 1000]; // 90% streamer, 10% platform

      await liveRoom.createScheme("Custom", recipients, percentages);

      const [name, rcpts, pcts, active] = await liveRoom.getScheme(1);
      expect(name).to.equal("Custom");
      expect(rcpts[0]).to.equal(streamer.address);
      expect(pcts[0]).to.equal(9000);
    });

    it("Should reject invalid percentage total", async function () {
      const recipients = [streamer.address, platform.address];
      const percentages = [9000, 500]; // Total: 95% (invalid)

      await expect(
        liveRoom.createScheme("Invalid", recipients, percentages)
      ).to.be.revertedWith("Total percentage must be 10000 (100%)");
    });
  });

  describe("Room Management", function () {
    it("Should create a live room", async function () {
      const tx = await liveRoom.connect(streamer).createRoom(0);
      const receipt = await tx.wait();

      // Check event
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "RoomCreated"
      );
      expect(event).to.not.be.undefined;

      // Verify room data
      const [roomStreamer, schemeId, active] = await liveRoom.getRoom(1);
      expect(roomStreamer).to.equal(streamer.address);
      expect(schemeId).to.equal(0);
      expect(active).to.be.true;
    });

    it("Should update room scheme", async function () {
      // Create custom scheme
      const recipients = [streamer.address, platform.address];
      const percentages = [9500, 500];
      await liveRoom.createScheme("New", recipients, percentages);

      // Create room
      await liveRoom.connect(streamer).createRoom(0);

      // Update to new scheme
      await liveRoom.connect(streamer).updateRoomScheme(1, 1);

      const [, schemeId] = await liveRoom.getRoom(1);
      expect(schemeId).to.equal(1);
    });

    it("Should only allow streamer to update room", async function () {
      await liveRoom.connect(streamer).createRoom(0);

      await expect(
        liveRoom.connect(tipper1).updateRoomScheme(1, 0)
      ).to.be.revertedWith("Not the streamer");
    });
  });

  describe("Tipping", function () {
    beforeEach(async function () {
      // Create custom scheme: streamer 90%, platform 10%
      await liveRoom.createScheme(
        "90-10",
        [streamer.address, platform.address],
        [9000, 1000]
      );

      // Streamer creates room
      await liveRoom.connect(streamer).createRoom(1);
    });

    it("Should process single tip correctly", async function () {
      const tipAmount = ethers.parseEther("1.0");

      const streamerBalanceBefore = await ethers.provider.getBalance(streamer.address);
      const platformBalanceBefore = await ethers.provider.getBalance(platform.address);

      await liveRoom.connect(tipper1).tip(1, { value: tipAmount });

      const streamerBalanceAfter = await ethers.provider.getBalance(streamer.address);
      const platformBalanceAfter = await ethers.provider.getBalance(platform.address);

      // Verify distribution (90% / 10%)
      expect(streamerBalanceAfter - streamerBalanceBefore).to.equal(
        (tipAmount * 9000n) / 10000n
      );
      expect(platformBalanceAfter - platformBalanceBefore).to.equal(
        (tipAmount * 1000n) / 10000n
      );
    });

    it("Should emit Tipped event", async function () {
      const tipAmount = ethers.parseEther("0.5");

      await expect(liveRoom.connect(tipper1).tip(1, { value: tipAmount }))
        .to.emit(liveRoom, "Tipped")
        .withArgs(1, tipper1.address, streamer.address, tipAmount, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));
    });

    it("Should update room statistics", async function () {
      const tipAmount = ethers.parseEther("1.0");

      await liveRoom.connect(tipper1).tip(1, { value: tipAmount });

      const [, , , , totalReceived, tipCount] = await liveRoom.getRoom(1);
      expect(totalReceived).to.equal(tipAmount);
      expect(tipCount).to.equal(1);
    });

    it("Should update user statistics", async function () {
      const tipAmount = ethers.parseEther("2.0");

      await liveRoom.connect(tipper1).tip(1, { value: tipAmount });

      const [totalTipped, tipCount] = await liveRoom.getUserStats(tipper1.address);
      expect(totalTipped).to.equal(tipAmount);
      expect(tipCount).to.equal(1);
    });

    it("Should handle multiple tips", async function () {
      await liveRoom.connect(tipper1).tip(1, { value: ethers.parseEther("1.0") });
      await liveRoom.connect(tipper2).tip(1, { value: ethers.parseEther("2.0") });

      const [, , , , totalReceived, tipCount] = await liveRoom.getRoom(1);
      expect(totalReceived).to.equal(ethers.parseEther("3.0"));
      expect(tipCount).to.equal(2);
    });

    it("Should handle tipMultiple correctly", async function () {
      const totalAmount = ethers.parseEther("5.0");
      const count = 5;

      await liveRoom.connect(tipper1).tipMultiple(1, count, { value: totalAmount });

      const [, , , , totalReceived, tipCount] = await liveRoom.getRoom(1);
      expect(totalReceived).to.equal(totalAmount);
      expect(tipCount).to.equal(count);
    });

    it("Should reject tip to inactive room", async function () {
      // Disable room
      await liveRoom.connect(streamer).setRoomActive(1, false);

      await expect(
        liveRoom.connect(tipper1).tip(1, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Room not active");
    });

    it("Should reject zero amount tip", async function () {
      await expect(
        liveRoom.connect(tipper1).tip(1, { value: 0 })
      ).to.be.revertedWith("Tip amount must be > 0");
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await liveRoom.connect(streamer).createRoom(0);
    });

    it("Should get streamer rooms", async function () {
      await liveRoom.connect(streamer).createRoom(0);
      await liveRoom.connect(streamer).createRoom(0);

      const rooms = await liveRoom.getStreamerRooms(streamer.address);
      expect(rooms.length).to.equal(3);
    });

    it("Should get recent tips", async function () {
      await liveRoom.connect(tipper1).tip(1, { value: ethers.parseEther("1.0") });
      await liveRoom.connect(tipper2).tip(1, { value: ethers.parseEther("2.0") });

      const recentTips = await liveRoom.getRecentTips(10);
      expect(recentTips.length).to.equal(2);
      expect(recentTips[0].tipper).to.equal(tipper2.address); // Most recent first
    });

    it("Should get room tips", async function () {
      await liveRoom.connect(streamer).createRoom(0); // Room 2

      await liveRoom.connect(tipper1).tip(1, { value: ethers.parseEther("1.0") });
      await liveRoom.connect(tipper1).tip(2, { value: ethers.parseEther("2.0") });

      const room1Tips = await liveRoom.getRoomTips(1, 10);
      expect(room1Tips.length).to.equal(1);
      expect(room1Tips[0].roomId).to.equal(1);
    });

    it("Should get contract stats", async function () {
      await liveRoom.connect(tipper1).tip(1, { value: ethers.parseEther("1.0") });

      const [totalRooms, totalTips, totalVolume] = await liveRoom.getContractStats();
      expect(totalRooms).to.equal(1);
      expect(totalTips).to.equal(1);
      expect(totalVolume).to.equal(ethers.parseEther("1.0"));
    });
  });
});
