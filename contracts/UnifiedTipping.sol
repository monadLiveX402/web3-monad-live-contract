// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UnifiedTipping
 * @notice 单房间打赏合约，支持一次性打赏与流式打赏，分账固定：95% 留在合约，5% 固定地址
 *
 * 设计约束：
 * - 只有一个房间，不需要 roomId
 * - 直接打赏：立即分账（95% 合约余额，5% 平台地址）
 * - 流式打赏：start → topUp → stop；停止时按同样规则分账，剩余余额退还打赏者
 * - 平台地址写死：0x500947f01e346093000909882c620b7407129efb
 */
contract UnifiedTipping is Ownable, ReentrancyGuard {
    // ========= 配置 =========
    uint256 public constant PLATFORM_BPS = 500; // 5%
    uint256 public constant CONTRACT_BPS = 9500; // 95%
    address public constant PLATFORM = 0x500947f01E346093000909882c620b7407129EfB;

    constructor() Ownable(msg.sender) {}

    // ========= 流式打赏状态 =========
    struct Stream {
        uint256 ratePerSecond; // wei per second
        uint256 startTime;
        uint256 balance;
        bool active;
    }

    mapping(address => Stream) public streams;
    uint256 public activeStreamCount;
    uint256 public totalInstantVolume;
    uint256 public totalStreamVolume;

    // ========= 事件 =========
    event InstantTipped(
        address indexed tipper,
        uint256 amount,
        uint256 platformShare,
        uint256 contractShare,
        uint256 timestamp
    );

    event StreamStarted(
        address indexed tipper,
        uint256 ratePerSecond,
        uint256 balance,
        uint256 timestamp
    );

    event StreamTopUp(address indexed tipper, uint256 amount, uint256 newBalance);

    event StreamStopped(
        address indexed tipper,
        uint256 duration,
        uint256 amountUsed,
        uint256 platformShare,
        uint256 contractShare,
        uint256 refund,
        uint256 timestamp
    );

    // ========= 修饰器 =========
    modifier hasActiveStream() {
        require(streams[msg.sender].active, "No active stream");
        _;
    }

    modifier noActiveStream() {
        require(!streams[msg.sender].active, "Stream already active");
        _;
    }

    // ========= 一次性打赏 =========
    function tip() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");

        (uint256 platformShare, uint256 contractShare) = _split(msg.value);

        // 先更新状态再转账，避免重入
        totalInstantVolume += msg.value;

        _payout(platformShare);

        emit InstantTipped(
            msg.sender,
            msg.value,
            platformShare,
            contractShare,
            block.timestamp
        );
        // contractShare 留在合约
    }

    // ========= 流式打赏 =========
    function startStream(uint256 _ratePerSecond)
        external
        payable
        nonReentrant
        noActiveStream
    {
        require(msg.value > 0, "Deposit must be > 0");
        require(_ratePerSecond > 0, "Rate must be > 0");
        require(_ratePerSecond <= msg.value, "Rate too high for balance");

        streams[msg.sender] = Stream({
            ratePerSecond: _ratePerSecond,
            startTime: block.timestamp,
            balance: msg.value,
            active: true
        });

        activeStreamCount++;

        emit StreamStarted(msg.sender, _ratePerSecond, msg.value, block.timestamp);
    }

    function topUpStream() external payable nonReentrant hasActiveStream {
        require(msg.value > 0, "Top-up must be > 0");

        Stream storage s = streams[msg.sender];
        s.balance += msg.value;

        emit StreamTopUp(msg.sender, msg.value, s.balance);
    }

    function stopStream() external nonReentrant hasActiveStream {
        Stream storage s = streams[msg.sender];

        uint256 elapsed = block.timestamp - s.startTime;
        uint256 amountDue = elapsed * s.ratePerSecond;
        uint256 amountUsed = amountDue > s.balance ? s.balance : amountDue;
        uint256 refund = s.balance - amountUsed;

        (uint256 platformShare, uint256 contractShare) = _split(amountUsed);

        // 更新总量 & 状态
        totalStreamVolume += amountUsed;
        activeStreamCount--;
        delete streams[msg.sender];

        if (platformShare > 0) {
            _payout(platformShare);
        }

        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "Refund failed");
        }

        emit StreamStopped(
            msg.sender,
            elapsed,
            amountUsed,
            platformShare,
            contractShare,
            refund,
            block.timestamp
        );
        // contractShare 留在合约
    }

    // ========= 只读辅助 =========
    function getStream(address _user)
        external
        view
        returns (
            uint256 ratePerSecond,
            uint256 startTime,
            uint256 balance,
            bool active,
            uint256 currentAmount
        )
    {
        Stream memory s = streams[_user];
        uint256 amount = 0;
        if (s.active) {
            uint256 elapsed = block.timestamp - s.startTime;
            uint256 calculated = elapsed * s.ratePerSecond;
            amount = calculated > s.balance ? s.balance : calculated;
        }
        return (s.ratePerSecond, s.startTime, s.balance, s.active, amount);
    }

    function isStreamLowBalance(address _user) external view returns (bool, uint256) {
        Stream memory s = streams[_user];
        if (!s.active) return (false, 0);

        uint256 elapsed = block.timestamp - s.startTime;
        uint256 consumed = elapsed * s.ratePerSecond;

        if (consumed >= s.balance) return (true, 0);

        uint256 remaining = s.balance - consumed;
        uint256 remainingTime = remaining / s.ratePerSecond;
        return (remainingTime < 60, remainingTime);
    }

    function getStats()
        external
        view
        returns (uint256 _instantVolume, uint256 _streamVolume, uint256 _activeStreams)
    {
        return (totalInstantVolume, totalStreamVolume, activeStreamCount);
    }

    // ========= 内部工具 =========
    function _split(uint256 _amount) internal pure returns (uint256 platformShare, uint256 contractShare) {
        platformShare = (_amount * PLATFORM_BPS) / 10000;
        contractShare = _amount - platformShare; // 避免舍入丢失
    }

    function _payout(uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = payable(PLATFORM).call{value: amount}("");
        require(ok, "Platform payout failed");
    }

    receive() external payable {}
}
