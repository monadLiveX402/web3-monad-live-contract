// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RevenueShare402
 * @notice 分账核心合约 - 管理分账方案并执行链上分账
 * @dev 提供统一的分账网关，所有打赏场景都通过这个合约进行分账
 *
 * X402 协议说明：
 * - X402 是 HTTP 层的微支付协议，不是链上路由器
 * - 本合约在链上实现分账逻辑，配合后端 X402 验证使用
 * - 后端使用 Thirdweb settlePayment 验证支付后调用本合约
 */
contract RevenueShare402 is Ownable, ReentrancyGuard {

    // ============ 数据结构 ============

    // 平台方收款地址（用于平台抽成）
    address public constant PLATFORM_RECIPIENT = 0x500947f01E346093000909882c620b7407129EfB;

    /**
     * @dev 分账方案
     * @notice 定义一笔收入如何分配给多个接收者
     */
    struct RevenueScheme {
        string name;                  // 方案名称（如："默认主播分成"）
        address[] recipients;         // 收款人数组
        uint256[] percentages;        // 分成比例数组（基数 10000，如 9000 = 90%）
        bool active;                  // 是否启用
        uint256 createdAt;            // 创建时间
    }

    // ============ 状态变量 ============

    // 分账方案存储
    RevenueScheme[] public schemes;

    // 方案名称 => 方案 ID 映射
    mapping(string => uint256) public schemeNameToId;

    // 统计数据
    uint256 public totalDistributed;  // 累计分账金额
    uint256 public totalDistributions;// 累计分账次数

    // ============ 事件 ============

    event SchemeCreated(
        uint256 indexed schemeId,
        string name,
        address[] recipients,
        uint256[] percentages
    );

    event SchemeUpdated(
        uint256 indexed schemeId,
        string name,
        address[] recipients,
        uint256[] percentages,
        bool active
    );

    event RevenueDistributed(
        uint256 indexed schemeId,
        address indexed payer,
        uint256 totalAmount,
        address[] recipients,
        uint256[] amounts
    );

    event FundsWithdrawn(address indexed to, uint256 amount);

    // ============ 修饰器 ============

    modifier validSchemeId(uint256 _schemeId) {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        require(schemes[_schemeId].active, "Scheme not active");
        _;
    }

    // ============ 构造函数 ============

    constructor() Ownable(msg.sender) {
        // 创建默认分账方案：主播 95% + 平台 5%
        _createDefaultScheme();
    }

    // ============ 核心功能 - 分账 ============

    /**
     * @dev 执行分账（内部函数）
     * @param _schemeId 分账方案 ID
     * @param _amount 总金额
     * @param _payer 支付者地址
     * @notice 这是核心分账逻辑，所有打赏合约都会调用这个函数
     */
    function _distribute(
        uint256 _schemeId,
        uint256 _amount,
        address _payer
    ) internal validSchemeId(_schemeId) {
        require(_amount > 0, "Amount must be > 0");

        RevenueScheme storage scheme = schemes[_schemeId];
        require(scheme.recipients.length > 0, "No recipients");
        require(
            scheme.recipients.length == scheme.percentages.length,
            "Recipients and percentages mismatch"
        );

        // 验证总比例是否为 100%
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < scheme.percentages.length; i++) {
            totalPercentage += scheme.percentages[i];
        }
        require(totalPercentage == 10000, "Total percentage must be 10000 (100%)");

        // 执行分账转账
        uint256[] memory distributedAmounts = new uint256[](scheme.recipients.length);
        uint256 totalTransferred = 0;

        for (uint256 i = 0; i < scheme.recipients.length; i++) {
            uint256 share = (_amount * scheme.percentages[i]) / 10000;
            distributedAmounts[i] = share;
            totalTransferred += share;

            // 转账给接收者
            (bool success, ) = payable(scheme.recipients[i]).call{value: share}("");
            require(success, "Transfer failed");
        }

        // 处理舍入误差（将剩余金额发给第一个接收者）
        if (totalTransferred < _amount) {
            uint256 remainder = _amount - totalTransferred;
            (bool success, ) = payable(scheme.recipients[0]).call{value: remainder}("");
            require(success, "Remainder transfer failed");
            distributedAmounts[0] += remainder;
        }

        // 更新统计数据
        totalDistributed += _amount;
        totalDistributions++;

        // 触发事件
        emit RevenueDistributed(
            _schemeId,
            _payer,
            _amount,
            scheme.recipients,
            distributedAmounts
        );
    }

    // ============ 管理功能 - 方案管理 ============

    /**
     * @dev 创建新的分账方案（仅管理员）
     * @param _name 方案名称
     * @param _recipients 收款人数组
     * @param _percentages 分成比例数组（基数 10000）
     */
    function createScheme(
        string memory _name,
        address[] memory _recipients,
        uint256[] memory _percentages
    ) external onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_recipients.length > 0, "Must have at least one recipient");
        require(
            _recipients.length == _percentages.length,
            "Recipients and percentages length mismatch"
        );
        require(schemeNameToId[_name] == 0, "Scheme name already exists");

        // 验证总比例
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _percentages.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient address");
            require(_percentages[i] > 0, "Percentage must be > 0");
            totalPercentage += _percentages[i];
        }
        require(totalPercentage == 10000, "Total percentage must be 10000 (100%)");

        // 创建方案
        schemes.push(RevenueScheme({
            name: _name,
            recipients: _recipients,
            percentages: _percentages,
            active: true,
            createdAt: block.timestamp
        }));

        uint256 schemeId = schemes.length - 1;
        schemeNameToId[_name] = schemeId;

        emit SchemeCreated(schemeId, _name, _recipients, _percentages);

        return schemeId;
    }

    /**
     * @dev 更新分账方案（仅管理员）
     * @param _schemeId 方案 ID
     * @param _name 新方案名称
     * @param _recipients 新收款人数组
     * @param _percentages 新分成比例数组
     * @param _active 是否启用
     */
    function updateScheme(
        uint256 _schemeId,
        string memory _name,
        address[] memory _recipients,
        uint256[] memory _percentages,
        bool _active
    ) external onlyOwner {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_recipients.length > 0, "Must have at least one recipient");
        require(
            _recipients.length == _percentages.length,
            "Recipients and percentages length mismatch"
        );

        // 验证总比例
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _percentages.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient address");
            require(_percentages[i] > 0, "Percentage must be > 0");
            totalPercentage += _percentages[i];
        }
        require(totalPercentage == 10000, "Total percentage must be 10000 (100%)");

        // 更新方案
        RevenueScheme storage scheme = schemes[_schemeId];

        // 删除旧名称映射
        delete schemeNameToId[scheme.name];

        scheme.name = _name;
        scheme.recipients = _recipients;
        scheme.percentages = _percentages;
        scheme.active = _active;

        // 创建新名称映射
        schemeNameToId[_name] = _schemeId;

        emit SchemeUpdated(_schemeId, _name, _recipients, _percentages, _active);
    }

    /**
     * @dev 启用/禁用分账方案（仅管理员）
     */
    function setSchemeActive(uint256 _schemeId, bool _active) external onlyOwner {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        schemes[_schemeId].active = _active;
    }

    // ============ 查询功能 ============

    /**
     * @dev 获取分账方案总数
     */
    function getSchemeCount() external view returns (uint256) {
        return schemes.length;
    }

    /**
     * @dev 获取分账方案详情
     */
    function getScheme(uint256 _schemeId) external view returns (
        string memory name,
        address[] memory recipients,
        uint256[] memory percentages,
        bool active,
        uint256 createdAt
    ) {
        require(_schemeId < schemes.length, "Invalid scheme ID");
        RevenueScheme storage scheme = schemes[_schemeId];
        return (
            scheme.name,
            scheme.recipients,
            scheme.percentages,
            scheme.active,
            scheme.createdAt
        );
    }

    /**
     * @dev 通过名称获取方案 ID
     */
    function getSchemeIdByName(string memory _name) external view returns (uint256) {
        uint256 schemeId = schemeNameToId[_name];
        require(schemeId < schemes.length, "Scheme not found");
        return schemeId;
    }

    /**
     * @dev 获取统计数据
     */
    function getStats() external view returns (
        uint256 _totalDistributed,
        uint256 _totalDistributions,
        uint256 _schemeCount
    ) {
        return (
            totalDistributed,
            totalDistributions,
            schemes.length
        );
    }

    // ============ 内部函数 ============

    /**
     * @dev 创建默认分账方案
     * @notice 默认方案：主播 95% + 平台 5%
     */
    function _createDefaultScheme() private {
        address[] memory recipients = new address[](2);
        recipients[0] = owner(); // 将默认 95% 直接转给合约管理员，避免资金卡在合约
        recipients[1] = PLATFORM_RECIPIENT; // 平台地址

        uint256[] memory percentages = new uint256[](2);
        percentages[0] = 9500; // 主播 95%
        percentages[1] = 500;  // 平台 5%

        schemes.push(RevenueScheme({
            name: "Default",
            recipients: recipients,
            percentages: percentages,
            active: true,
            createdAt: block.timestamp
        }));

        schemeNameToId["Default"] = 0;
    }

    // ============ 接收以太币 ============

    receive() external payable {}

    // ============ 资金取回 ============

    /**
     * @dev 提取合约内意外留存的原生币（仅管理员）
     * @param _to 提取到账地址
     * @param _amount 提取金额；填 0 表示提取全部余额
     *
     * 说明：
     * - 仅影响合约余额，不会改变任何分账方案或房间状态
     * - 用于清理默认方案把 95% 打进合约地址的历史资金
     */
    function withdraw(
        address payable _to,
        uint256 _amount
    ) external onlyOwner nonReentrant {
        require(_to != address(0), "Invalid recipient");

        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        uint256 amount = _amount == 0 ? balance : _amount;
        require(amount <= balance, "Amount exceeds balance");

        (bool success, ) = _to.call{value: amount}("");
        require(success, "Withdraw failed");

        emit FundsWithdrawn(_to, amount);
    }

    /**
     * @dev 查询合约当前原生币余额
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
