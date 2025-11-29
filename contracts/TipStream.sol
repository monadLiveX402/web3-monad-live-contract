// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./RevenueShare402.sol";

/**
 * @title TipStream
 * @notice 流式打赏合约 - 按时间持续打赏
 * @dev 实现"一键开启，持续计费，停止结算"的流式打赏逻辑
 *
 * 功能说明：
 * 1. 用户开启流式打赏：指定直播间 + 每秒费率
 * 2. 持续计费：时间流逝 → 金额累积
 * 3. 用户停止打赏：计算总金额 → 调用 RevenueShare402._distribute() 分账
 * 4. 区别于一次性打赏：只点两次（开/关），中间自动计费
 *
 * 应用场景：
 * - 用户想持续支持主播，不想频繁点击
 * - 类似"订阅打赏"，按观看时长付费
 * - 配合 Monad 低延迟，实现秒级计费
 */
contract TipStream is RevenueShare402 {

    // ============ 数据结构 ============

    /**
     * @dev 流式打赏状态
     */
    struct Stream {
        uint256 roomId;           // 打赏的直播间 ID
        address tipper;           // 打赏者
        uint256 ratePerSecond;    // 每秒打赏金额（wei）
        uint256 startTime;        // 开始时间
        uint256 balance;          // 预存余额
        bool active;              // 是否正在打赏
    }

    /**
     * @dev 流式打赏结算记录
     */
    struct StreamRecord {
        uint256 roomId;
        address tipper;
        uint256 duration;         // 持续时间（秒）
        uint256 amount;           // 总金额
        uint256 timestamp;        // 结算时间
    }

    // ============ 状态变量 ============

    // 用户 => 流式打赏状态
    mapping(address => Stream) public streams;

    // 直播间信息（简化版，只记录必要信息）
    mapping(uint256 => address) public roomStreamers; // roomId => 主播地址
    mapping(uint256 => uint256) public roomSchemes;   // roomId => schemeId
    mapping(uint256 => bool) public roomActive;       // roomId => 是否启用

    // 流式打赏历史
    StreamRecord[] public streamHistory;

    // 统计数据
    uint256 public totalStreamAmount;     // 累计流式打赏金额
    uint256 public activeStreamCount;     // 当前活跃流数量

    // ============ 事件 ============

    event RoomRegistered(
        uint256 indexed roomId,
        address indexed streamer,
        uint256 schemeId
    );

    event StreamStarted(
        address indexed tipper,
        uint256 indexed roomId,
        uint256 ratePerSecond,
        uint256 balance,
        uint256 timestamp
    );

    event StreamStopped(
        address indexed tipper,
        uint256 indexed roomId,
        uint256 duration,
        uint256 amount,
        uint256 timestamp
    );

    event StreamTopUp(
        address indexed tipper,
        uint256 amount,
        uint256 newBalance
    );

    // ============ 修饰器 ============

    modifier validRoom(uint256 _roomId) {
        require(roomStreamers[_roomId] != address(0), "Room not registered");
        require(roomActive[_roomId], "Room not active");
        _;
    }

    modifier hasActiveStream() {
        require(streams[msg.sender].active, "No active stream");
        _;
    }

    modifier noActiveStream() {
        require(!streams[msg.sender].active, "Already has active stream");
        _;
    }

    // ============ 构造函数 ============

    constructor() RevenueShare402() {}

    // ============ 管理功能 - 直播间注册 ============

    /**
     * @dev 注册直播间用于流式打赏
     * @param _roomId 直播间 ID
     * @param _schemeId 使用的分账方案 ID
     * @notice 主播需要先注册直播间才能接收流式打赏
     */
    function registerRoom(uint256 _roomId, uint256 _schemeId) external {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        require(schemes[_schemeId].active, "Scheme not active");
        require(roomStreamers[_roomId] == address(0), "Room already registered");

        roomStreamers[_roomId] = msg.sender;
        roomSchemes[_roomId] = _schemeId;
        roomActive[_roomId] = true;

        emit RoomRegistered(_roomId, msg.sender, _schemeId);
    }

    /**
     * @dev 更新直播间分账方案（仅主播）
     */
    function updateRoomScheme(uint256 _roomId, uint256 _schemeId) external {
        require(roomStreamers[_roomId] == msg.sender, "Not the streamer");
        require(_schemeId < schemes.length, "Invalid scheme ID");
        require(schemes[_schemeId].active, "Scheme not active");

        roomSchemes[_roomId] = _schemeId;
    }

    /**
     * @dev 启用/禁用直播间（仅主播）
     */
    function setRoomActive(uint256 _roomId, bool _active) external {
        require(roomStreamers[_roomId] == msg.sender, "Not the streamer");
        roomActive[_roomId] = _active;
    }

    // ============ 核心功能 - 流式打赏 ============

    /**
     * @dev 开始流式打赏
     * @param _roomId 直播间 ID
     * @param _ratePerSecond 每秒打赏金额（wei）
     * @notice 用户附带 value 作为预存余额，当余额不足时流会自动停止
     *
     * 流程：
     * 1. 检查用户没有正在进行的流
     * 2. 检查直播间存在且启用
     * 3. 创建流式打赏记录
     * 4. 触发事件
     */
    function startStream(
        uint256 _roomId,
        uint256 _ratePerSecond
    ) external payable nonReentrant noActiveStream validRoom(_roomId) {
        require(msg.value > 0, "Must deposit balance");
        require(_ratePerSecond > 0, "Rate must be > 0");
        require(_ratePerSecond <= msg.value, "Rate too high for balance");

        streams[msg.sender] = Stream({
            roomId: _roomId,
            tipper: msg.sender,
            ratePerSecond: _ratePerSecond,
            startTime: block.timestamp,
            balance: msg.value,
            active: true
        });

        activeStreamCount++;

        emit StreamStarted(
            msg.sender,
            _roomId,
            _ratePerSecond,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @dev 停止流式打赏并结算
     * @notice 用户主动停止，或余额不足时自动停止
     *
     * 流程：
     * 1. 计算持续时间
     * 2. 计算总金额 = 时间 × 费率（不超过余额）
     * 3. 调用 RevenueShare402._distribute() 执行分账
     * 4. 退还剩余余额
     * 5. 清除流状态
     */
    function stopStream() external nonReentrant hasActiveStream {
        Stream storage stream = streams[msg.sender];

        // 计算持续时间
        uint256 duration = block.timestamp - stream.startTime;

        // 计算应付金额
        uint256 amountDue = duration * stream.ratePerSecond;

        // 实际支付金额（不超过余额）
        uint256 actualAmount = amountDue > stream.balance ? stream.balance : amountDue;

        // 剩余余额
        uint256 remainingBalance = stream.balance - actualAmount;

        // 执行分账
        if (actualAmount > 0) {
            _distribute(roomSchemes[stream.roomId], actualAmount, msg.sender);

            // 记录历史
            streamHistory.push(StreamRecord({
                roomId: stream.roomId,
                tipper: msg.sender,
                duration: duration,
                amount: actualAmount,
                timestamp: block.timestamp
            }));

            totalStreamAmount += actualAmount;
        }

        // 退还剩余余额
        if (remainingBalance > 0) {
            (bool success, ) = payable(msg.sender).call{value: remainingBalance}("");
            require(success, "Refund failed");
        }

        emit StreamStopped(
            msg.sender,
            stream.roomId,
            duration,
            actualAmount,
            block.timestamp
        );

        // 清除流状态
        delete streams[msg.sender];
        activeStreamCount--;
    }

    /**
     * @dev 为流式打赏充值
     * @notice 在流进行中追加余额，延长打赏时间
     */
    function topUpStream() external payable hasActiveStream {
        require(msg.value > 0, "Top-up amount must be > 0");

        Stream storage stream = streams[msg.sender];
        stream.balance += msg.value;

        emit StreamTopUp(msg.sender, msg.value, stream.balance);
    }

    /**
     * @dev 检查流是否余额不足（前端可以调用此函数提醒用户）
     */
    function isStreamLowBalance(address _user) external view returns (bool, uint256) {
        Stream storage stream = streams[_user];
        if (!stream.active) {
            return (false, 0);
        }

        uint256 elapsed = block.timestamp - stream.startTime;
        uint256 consumed = elapsed * stream.ratePerSecond;

        if (consumed >= stream.balance) {
            return (true, 0); // 余额已耗尽
        }

        uint256 remaining = stream.balance - consumed;
        uint256 remainingTime = remaining / stream.ratePerSecond;

        // 如果剩余时间少于 60 秒，视为余额不足
        return (remainingTime < 60, remainingTime);
    }

    // ============ 查询功能 ============

    /**
     * @dev 获取用户当前流状态
     */
    function getStream(address _user) external view returns (
        uint256 roomId,
        uint256 ratePerSecond,
        uint256 startTime,
        uint256 balance,
        bool active,
        uint256 currentAmount
    ) {
        Stream storage stream = streams[_user];

        uint256 amount = 0;
        if (stream.active) {
            uint256 elapsed = block.timestamp - stream.startTime;
            uint256 calculated = elapsed * stream.ratePerSecond;
            amount = calculated > stream.balance ? stream.balance : calculated;
        }

        return (
            stream.roomId,
            stream.ratePerSecond,
            stream.startTime,
            stream.balance,
            stream.active,
            amount
        );
    }

    /**
     * @dev 获取流式打赏历史总数
     */
    function getStreamHistoryCount() external view returns (uint256) {
        return streamHistory.length;
    }

    /**
     * @dev 获取最近的流式打赏记录
     */
    function getRecentStreams(uint256 _limit) external view returns (StreamRecord[] memory) {
        uint256 total = streamHistory.length;
        if (total == 0) {
            return new StreamRecord[](0);
        }

        uint256 count = _limit > total ? total : _limit;
        StreamRecord[] memory recent = new StreamRecord[](count);

        for (uint256 i = 0; i < count; i++) {
            recent[i] = streamHistory[total - 1 - i];
        }

        return recent;
    }

    /**
     * @dev 获取合约统计数据
     */
    function getStreamStats() external view returns (
        uint256 _totalStreamAmount,
        uint256 _activeStreamCount,
        uint256 _totalStreams
    ) {
        return (
            totalStreamAmount,
            activeStreamCount,
            streamHistory.length
        );
    }

    /**
     * @dev 获取直播间信息
     */
    function getRoomInfo(uint256 _roomId) external view returns (
        address streamer,
        uint256 schemeId,
        bool active
    ) {
        return (
            roomStreamers[_roomId],
            roomSchemes[_roomId],
            roomActive[_roomId]
        );
    }

    // ============ 紧急功能 ============

    /**
     * @dev 紧急停止所有流（仅管理员，紧急情况使用）
     */
    function emergencyStopStream(address _user) external onlyOwner {
        Stream storage stream = streams[_user];
        require(stream.active, "No active stream");

        // 退还全部余额
        if (stream.balance > 0) {
            (bool success, ) = payable(_user).call{value: stream.balance}("");
            require(success, "Refund failed");
        }

        delete streams[_user];
        activeStreamCount--;
    }
}
