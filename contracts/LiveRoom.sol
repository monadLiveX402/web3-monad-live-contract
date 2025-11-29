// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./RevenueShare402.sol";

/**
 * @title LiveRoom
 * @notice 直播间管理 + 一次性打赏合约
 * @dev 管理直播间信息，处理"点一下就打赏一笔"的一次性打赏逻辑
 *
 * 功能说明：
 * 1. 直播间管理：roomId → 主播地址 → 分账方案
 * 2. 一次性打赏：用户点击打赏，立即结算
 * 3. 分账委托：调用 RevenueShare402._distribute() 完成分账
 * 4. 事件通知：emit 事件供前端监听（实时动画、榜单、统计）
 */
contract LiveRoom is RevenueShare402 {

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
        uint256 totalReceived;    // 累计收到打赏金额
        uint256 tipCount;         // 累计打赏次数
    }

    /**
     * @dev 打赏记录
     */
    struct TipRecord {
        uint256 roomId;
        address tipper;
        uint256 amount;
        uint256 timestamp;
    }

    // ============ 状态变量 ============

    // 直播间存储
    mapping(uint256 => Room) public rooms;
    mapping(address => uint256[]) public streamerRooms; // 主播 => 直播间列表
    uint256 public nextRoomId = 1; // 下一个可用的房间 ID

    // 打赏历史（可选，注意 gas 消耗）
    TipRecord[] public tipHistory;

    // 用户打赏统计
    mapping(address => uint256) public userTotalTipped;    // 用户累计打赏金额
    mapping(address => uint256) public userTipCount;       // 用户打赏次数

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

    event Tipped(
        uint256 indexed roomId,
        address indexed tipper,
        address indexed streamer,
        uint256 amount,
        uint256 timestamp
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
     * @param _schemeId 使用的分账方案 ID（忽略，自动为主播创建专属方案）
     * @return roomId 新创建的直播间 ID
     */
    function createRoom(uint256 _schemeId) external returns (uint256) {
        uint256 roomId = nextRoomId++;

        // 为每个直播间创建专属分账方案
        // 主播 95% 自动发给主播，平台 5% 发给固定平台地址
        uint256 schemeId = _createRoomScheme(msg.sender, roomId);

        rooms[roomId] = Room({
            roomId: roomId,
            streamer: msg.sender,
            schemeId: schemeId,
            active: true,
            createdAt: block.timestamp,
            totalReceived: 0,
            tipCount: 0
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
        recipients[0] = _streamer;                // 主播 95%
        recipients[1] = PLATFORM_RECIPIENT;       // 平台 5%

        uint256[] memory percentages = new uint256[](2);
        percentages[0] = 9500; // 主播 95%
        percentages[1] = 500;  // 平台 5%

        // 直接操作 schemes 数组
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

    /**
     * @dev 更新直播间配置（仅主播）
     * @param _roomId 直播间 ID
     * @param _schemeId 新的分账方案 ID
     */
    function updateRoomScheme(
        uint256 _roomId,
        uint256 _schemeId
    ) external onlyStreamer(_roomId) {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        require(schemes[_schemeId].active, "Scheme not active");

        rooms[_roomId].schemeId = _schemeId;

        emit RoomUpdated(_roomId, _schemeId, rooms[_roomId].active);
    }

    /**
     * @dev 启用/禁用直播间（仅主播）
     */
    function setRoomActive(uint256 _roomId, bool _active) external onlyStreamer(_roomId) {
        rooms[_roomId].active = _active;

        emit RoomUpdated(_roomId, rooms[_roomId].schemeId, _active);
    }

    // ============ 核心功能 - 一次性打赏 ============

    /**
     * @dev 打赏直播间（一次性）
     * @param _roomId 直播间 ID
     * @notice 用户附带 value 调用，金额会按照直播间的分账方案自动分配
     *
     * 流程：
     * 1. 检查直播间是否存在且启用
     * 2. 获取直播间的分账方案
     * 3. 调用 RevenueShare402._distribute() 执行分账
     * 4. 更新统计数据
     * 5. 触发事件（前端监听用于实时动画）
     */
    function tip(uint256 _roomId) external payable nonReentrant validRoom(_roomId) {
        require(msg.value > 0, "Tip amount must be > 0");

        Room storage room = rooms[_roomId];

        // 执行分账（调用父合约 RevenueShare402 的内部函数）
        _distribute(room.schemeId, msg.value, msg.sender);

        // 更新直播间统计
        room.totalReceived += msg.value;
        room.tipCount++;

        // 更新用户统计
        userTotalTipped[msg.sender] += msg.value;
        userTipCount[msg.sender]++;

        // 记录打赏历史（可选）
        tipHistory.push(TipRecord({
            roomId: _roomId,
            tipper: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        // 触发事件（前端监听用于实时动画和榜单更新）
        emit Tipped(_roomId, msg.sender, room.streamer, msg.value, block.timestamp);
    }

    /**
     * @dev 批量打赏（多次打赏同一个直播间）
     * @param _roomId 直播间 ID
     * @param _count 打赏次数
     * @notice 用于"连击打赏"场景，一次交易多次打赏效果
     */
    function tipMultiple(
        uint256 _roomId,
        uint256 _count
    ) external payable nonReentrant validRoom(_roomId) {
        require(msg.value > 0, "Tip amount must be > 0");
        require(_count > 0 && _count <= 100, "Count must be 1-100");

        Room storage room = rooms[_roomId];
        uint256 amountPerTip = msg.value / _count;
        require(amountPerTip > 0, "Amount too small");

        // 执行分账
        _distribute(room.schemeId, msg.value, msg.sender);

        // 更新统计
        room.totalReceived += msg.value;
        room.tipCount += _count;
        userTotalTipped[msg.sender] += msg.value;
        userTipCount[msg.sender] += _count;

        // 记录每一次打赏
        for (uint256 i = 0; i < _count; i++) {
            tipHistory.push(TipRecord({
                roomId: _roomId,
                tipper: msg.sender,
                amount: amountPerTip,
                timestamp: block.timestamp
            }));

            emit Tipped(_roomId, msg.sender, room.streamer, amountPerTip, block.timestamp);
        }
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
        uint256 tipCount
    ) {
        Room storage room = rooms[_roomId];
        require(room.roomId != 0, "Room does not exist");

        return (
            room.streamer,
            room.schemeId,
            room.active,
            room.createdAt,
            room.totalReceived,
            room.tipCount
        );
    }

    /**
     * @dev 获取主播的所有直播间
     */
    function getStreamerRooms(address _streamer) external view returns (uint256[] memory) {
        return streamerRooms[_streamer];
    }

    /**
     * @dev 获取用户打赏统计
     */
    function getUserStats(address _user) external view returns (
        uint256 totalTipped,
        uint256 tipCount
    ) {
        return (
            userTotalTipped[_user],
            userTipCount[_user]
        );
    }

    /**
     * @dev 获取打赏历史总数
     */
    function getTipHistoryCount() external view returns (uint256) {
        return tipHistory.length;
    }

    /**
     * @dev 获取最近的打赏记录
     * @param _limit 返回数量
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
     * @param _roomId 直播间 ID
     * @param _limit 返回数量
     */
    function getRoomTips(
        uint256 _roomId,
        uint256 _limit
    ) external view returns (TipRecord[] memory) {
        // 从后往前扫描，找到指定房间的打赏记录
        uint256 total = tipHistory.length;
        if (total == 0) {
            return new TipRecord[](0);
        }

        // 第一遍：计算有多少条符合条件的记录
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
}
