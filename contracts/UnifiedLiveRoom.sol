// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./RevenueShare402.sol";

/**
 * @title UnifiedLiveRoom
 * @notice 统一的直播间合约：即时打赏 + 流式打赏
 * @dev 合并 LiveRoom 和 TipStream 的功能到一个合约
 */
contract UnifiedLiveRoom is RevenueShare402 {

    // ============ 数据结构 ============

    /**
     * @dev 直播间信息
     */
    struct Room {
        uint256 roomId;           // 直播间 ID
        address streamer;         // 主播地址
        uint256 schemeId;         // 使用的分账方案 ID
        bool active;              // 是否启用
        uint256 createdAt;        // 创建时间
        uint256 totalReceived;    // 累计收到打赏金额（即时）
        uint256 tipCount;         // 累计打赏次数（即时）
        uint256 streamRevenue;    // 累计流式打赏收入
    }

    /**
     * @dev 即时打赏记录
     */
    struct TipRecord {
        uint256 roomId;
        address tipper;
        uint256 amount;
        uint256 timestamp;
    }

    /**
     * @dev 流式打赏会话
     */
    struct StreamSession {
        address tipper;           // 打赏者
        uint256 ratePerSecond;    // 每秒费率
        uint256 balance;          // 剩余余额
        uint256 startTime;        // 开始时间
        bool active;              // 是否活跃
    }

    // ============ 状态变量 ============

    // 直播间存储
    mapping(uint256 => Room) public rooms;
    mapping(address => uint256[]) public streamerRooms;
    uint256 public nextRoomId = 1;

    // 即时打赏历史
    TipRecord[] public tipHistory;

    // 用户打赏统计
    mapping(address => uint256) public userTotalTipped;
    mapping(address => uint256) public userTipCount;

    // 流式打赏会话
    mapping(uint256 => mapping(address => StreamSession)) public streamSessions;

    // ============ 事件 ============

    event RoomCreated(
        uint256 indexed roomId,
        address indexed streamer,
        uint256 schemeId
    );

    event RoomUpdated(
        uint256 indexed roomId,
        uint256 schemeId,
        bool active
    );

    // 即时打赏事件
    event Tipped(
        uint256 indexed roomId,
        address indexed tipper,
        address indexed streamer,
        uint256 amount,
        uint256 timestamp
    );

    // 流式打赏事件
    event StreamStarted(
        uint256 indexed roomId,
        address indexed tipper,
        uint256 ratePerSecond,
        uint256 initialBalance
    );

    event StreamStopped(
        uint256 indexed roomId,
        address indexed tipper,
        uint256 totalAmount,
        uint256 duration
    );

    event StreamToppedUp(
        uint256 indexed roomId,
        address indexed tipper,
        uint256 amount
    );

    // ============ 修饰器 ============

    modifier validRoom(uint256 _roomId) {
        require(rooms[_roomId].roomId != 0, "Room does not exist");
        require(rooms[_roomId].active, "Room not active");
        _;
    }

    modifier onlyStreamer(uint256 _roomId) {
        require(rooms[_roomId].streamer == msg.sender, "Not the streamer");
        _;
    }

    // ============ 构造函数 ============

    constructor() RevenueShare402() {}

    // ============ 核心功能 - 直播间管理 ============

    /**
     * @dev 创建直播间
     */
    function createRoom(uint256 _schemeId) external returns (uint256) {
        uint256 roomId = nextRoomId++;

        // 为每个直播间创建专属分账方案
        uint256 schemeId = _createRoomScheme(msg.sender, roomId);

        rooms[roomId] = Room({
            roomId: roomId,
            streamer: msg.sender,
            schemeId: schemeId,
            active: true,
            createdAt: block.timestamp,
            totalReceived: 0,
            tipCount: 0,
            streamRevenue: 0
        });

        streamerRooms[msg.sender].push(roomId);

        emit RoomCreated(roomId, msg.sender, schemeId);

        return roomId;
    }

    /**
     * @dev 内部函数：为直播间创建专属分账方案
     */
    function _createRoomScheme(address _streamer, uint256 _roomId) internal returns (uint256) {
        address[] memory recipients = new address[](2);
        recipients[0] = 0x500947f01E346093000909882c620b7407129EfB; // 95% → 平台
        recipients[1] = 0x500947f01E346093000909882c620b7407129EfB; // 5% → 平台

        uint256[] memory percentages = new uint256[](2);
        percentages[0] = 9500; // 95%
        percentages[1] = 500;  // 5%

        schemes.push(RevenueScheme({
            name: string(abi.encodePacked("Room-", _uintToString(_roomId))),
            recipients: recipients,
            percentages: percentages,
            active: true,
            createdAt: block.timestamp
        }));

        uint256 schemeId = schemes.length - 1;
        schemeNameToId[string(abi.encodePacked("Room-", _uintToString(_roomId)))] = schemeId;

        return schemeId;
    }

    /**
     * @dev 辅助函数：将 uint 转为字符串
     */
    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) {
            return "0";
        }
        uint256 j = v;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = v;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }

    // ============ 即时打赏功能 ============

    /**
     * @dev 即时打赏
     */
    function tip(uint256 _roomId) external payable nonReentrant validRoom(_roomId) {
        require(msg.value > 0, "Tip amount must be > 0");

        Room storage room = rooms[_roomId];

        // 执行分账
        _distribute(room.schemeId, msg.value, msg.sender);

        // 更新统计
        room.totalReceived += msg.value;
        room.tipCount++;
        userTotalTipped[msg.sender] += msg.value;
        userTipCount[msg.sender]++;

        // 记录历史
        tipHistory.push(TipRecord({
            roomId: _roomId,
            tipper: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        emit Tipped(_roomId, msg.sender, room.streamer, msg.value, block.timestamp);
    }

    // ============ 流式打赏功能 ============

    /**
     * @dev 开始流式打赏
     * @param _roomId 直播间 ID
     * @param _ratePerSecond 每秒费率（wei）
     */
    function startStream(
        uint256 _roomId,
        uint256 _ratePerSecond
    ) external payable nonReentrant validRoom(_roomId) {
        require(msg.value > 0, "Initial balance must be > 0");
        require(_ratePerSecond > 0, "Rate must be > 0");

        StreamSession storage session = streamSessions[_roomId][msg.sender];
        require(!session.active, "Stream already active");

        session.tipper = msg.sender;
        session.ratePerSecond = _ratePerSecond;
        session.balance = msg.value;
        session.startTime = block.timestamp;
        session.active = true;

        emit StreamStarted(_roomId, msg.sender, _ratePerSecond, msg.value);
    }

    /**
     * @dev 停止流式打赏并结算
     */
    function stopStream(uint256 _roomId) external nonReentrant {
        StreamSession storage session = streamSessions[_roomId][msg.sender];
        require(session.active, "Stream not active");

        Room storage room = rooms[_roomId];

        // 计算已消费金额
        uint256 elapsed = block.timestamp - session.startTime;
        uint256 consumed = elapsed * session.ratePerSecond;

        // 实际结算金额（不超过余额）
        uint256 actualAmount = consumed > session.balance ? session.balance : consumed;

        // 执行分账
        if (actualAmount > 0) {
            _distribute(room.schemeId, actualAmount, msg.sender);
            room.streamRevenue += actualAmount;
        }

        // 退还剩余余额
        uint256 refund = session.balance - actualAmount;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            require(success, "Refund failed");
        }

        emit StreamStopped(_roomId, msg.sender, actualAmount, elapsed);

        // 清理会话
        delete streamSessions[_roomId][msg.sender];
    }

    /**
     * @dev 充值流式打赏余额
     */
    function topUpStream(uint256 _roomId) external payable nonReentrant {
        require(msg.value > 0, "Top-up amount must be > 0");

        StreamSession storage session = streamSessions[_roomId][msg.sender];
        require(session.active, "Stream not active");

        session.balance += msg.value;

        emit StreamToppedUp(_roomId, msg.sender, msg.value);
    }

    /**
     * @dev 查询流式打赏会话
     */
    function getStreamSession(
        uint256 _roomId,
        address _tipper
    ) external view returns (
        address tipper,
        uint256 ratePerSecond,
        uint256 balance,
        uint256 startTime,
        bool active
    ) {
        StreamSession storage session = streamSessions[_roomId][_tipper];
        return (
            session.tipper,
            session.ratePerSecond,
            session.balance,
            session.startTime,
            session.active
        );
    }

    // ============ 查询功能 ============

    /**
     * @dev 获取直播间详情
     */
    function getRoom(uint256 _roomId) external view returns (
        address streamer,
        uint256 schemeId,
        bool active,
        uint256 createdAt,
        uint256 totalReceived,
        uint256 tipCount,
        uint256 streamRevenue
    ) {
        Room storage room = rooms[_roomId];
        require(room.roomId != 0, "Room does not exist");

        return (
            room.streamer,
            room.schemeId,
            room.active,
            room.createdAt,
            room.totalReceived,
            room.tipCount,
            room.streamRevenue
        );
    }

    /**
     * @dev 获取合约统计数据
     */
    function getContractStats() external view returns (
        uint256 totalRooms,
        uint256 totalTips,
        uint256 totalVolume
    ) {
        return (
            nextRoomId - 1,
            tipHistory.length,
            totalDistributed
        );
    }

    /**
     * @dev 获取最近的打赏记录
     */
    function getRecentTips(uint256 _limit) external view returns (TipRecord[] memory) {
        uint256 total = tipHistory.length;
        if (total == 0) {
            return new TipRecord[](0);
        }

        uint256 count = _limit > total ? total : _limit;
        TipRecord[] memory recent = new TipRecord[](count);

        for (uint256 i = 0; i < count; i++) {
            recent[i] = tipHistory[total - 1 - i];
        }

        return recent;
    }

    /**
     * @dev 获取指定直播间的打赏记录
     */
    function getRoomTips(
        uint256 _roomId,
        uint256 _limit
    ) external view returns (TipRecord[] memory) {
        uint256 total = tipHistory.length;
        if (total == 0) {
            return new TipRecord[](0);
        }

        // 第一遍：计算符合条件的记录数
        uint256 matchCount = 0;
        for (uint256 i = total; i > 0 && matchCount < _limit; i--) {
            if (tipHistory[i - 1].roomId == _roomId) {
                matchCount++;
            }
        }

        // 第二遍：收集记录
        TipRecord[] memory roomTips = new TipRecord[](matchCount);
        uint256 index = 0;
        for (uint256 i = total; i > 0 && index < matchCount; i--) {
            if (tipHistory[i - 1].roomId == _roomId) {
                roomTips[index] = tipHistory[i - 1];
                index++;
            }
        }

        return roomTips;
    }

    /**
     * @dev 更新直播间配置
     */
    function setRoomActive(uint256 _roomId, bool _active) external onlyStreamer(_roomId) {
        rooms[_roomId].active = _active;
        emit RoomUpdated(_roomId, rooms[_roomId].schemeId, _active);
    }

    /**
     * @dev 获取主播的所有直播间
     */
    function getStreamerRooms(address _streamer) external view returns (uint256[] memory) {
        return streamerRooms[_streamer];
    }
}
