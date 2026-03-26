// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

/**
 * @title  FORTRESS BINARY MATRIX — V2
 * @notice Multi-level binary MLM reward system with first-activation level-jump onboarding.
 *
 * ── V2 CHANGES SUMMARY ──────────────────────────────────────────────────────────
 *
 *  1. AffiliateData struct (BREAKING STORAGE CHANGE — new deployment required):
 *       OLD: { parent, address[] children, agent, totalDirect, level }
 *       NEW: { parent, agent, totalDirect, level, address[] children }
 *     Moving the dynamic array to the end produces a stable, predictable auto-getter:
 *     affiliates(addr) → (parent, agent, totalDirect, level) — identical ABI output.
 *
 *  2. mapping(address => bool) public hasActivated
 *     Tracks whether a user has ever completed activateRank(). Gates the jump feature.
 *
 *  3. mapping(address => uint8) private pendingTargetLevel
 *     Stores the desired final level chosen during a jump deposit. Cleared after activation.
 *
 *  4. calculateCumulativeCost(uint8 targetLevel) — NEW public view
 *     Returns the total USDT required to jump directly to affiliate.level == targetLevel.
 *     Formula: entryFee × (2^targetLevel − 1)
 *
 *  5. depositUSDT(uint8 targetLevel) — SIGNATURE CHANGE (was depositUSDT() no args)
 *     targetLevel == 0 → normal single-level deposit (same as V1 behaviour).
 *     targetLevel  > 0 (only when !hasActivated) → jump deposit for cumulative cost.
 *
 *  6. activateRank() — MODIFIED
 *     Branch A: !hasActivated && pendingTargetLevel > 0 → JUMP ACTIVATION.
 *     Branch B: all other cases                         → SEQUENTIAL ACTIVATION (V1 logic).
 *
 *  7. updateAffiliateData admin function — EXTENDED (new _hasActivated param).
 *     Migration note: pass _hasActivated = (oldLevel > 0) for migrated users.
 *
 *  8. resetPendingTargetLevel(address) — NEW admin function.
 *     Safety escape hatch if a user is stuck in a pending jump state.
 *
 * ── COST EXAMPLES (entryFee = 5 USDT) ──────────────────────────────────────────
 *
 *   targetLevel │ Cost formula          │ USDT    │ resulting affiliate.level
 *   ────────────┼───────────────────────┼─────────┼──────────────────────────
 *       1       │ 5 × (2¹ − 1) = 5×1   │   5     │ 1   (identical to V1)
 *       2       │ 5 × (2² − 1) = 5×3   │  15     │ 2   (covers lvl-0 + lvl-1)
 *       3       │ 5 × (2³ − 1) = 5×7   │  35     │ 3   (covers lvl-0 thru 2)
 *       4       │ 5 × (2⁴ − 1) = 5×15  │  75     │ 4
 *       5       │ 5 × (2⁵ − 1) = 5×31  │ 155     │ 5
 *
 * ── MIGRATION COMPATIBILITY ─────────────────────────────────────────────────────
 *
 *   updateAffiliateData signature is extended with bool _hasActivated.
 *   ADMIN_ABI in contracts.js must be updated to add this parameter.
 *   Migration code: _hasActivated = (oldData.affiliate.level > 0)
 *   depositUSDT ABI in FBMXDAO_ABI must change from no-args to (uint8 targetLevel).
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES & BASE CONTRACTS  (unchanged from V1)
// ─────────────────────────────────────────────────────────────────────────────

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    constructor() { _status = _NOT_ENTERED; }
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) { return msg.sender; }
    function _msgData() internal view virtual returns (bytes calldata) { return msg.data; }
    function _contextSuffixLength() internal view virtual returns (uint256) { return 0; }
}

abstract contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() { _transferOwnership(_msgSender()); }
    function owner() public view virtual returns (address) { return _owner; }
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }
    function renounceOwnership() public virtual onlyOwner { _transferOwnership(address(0)); }
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

interface LIQUIDITY {
    function addLiquidityUSDT(uint256 usdtAmount, uint24 slippageBps) external returns (uint256);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

contract FBMXDAO is Ownable, ReentrancyGuard {

    // ==================== CONSTANTS ====================
    uint256 private constant BASIS_POINTS   = 10000;
    uint256 private constant TOKEN_DECIMALS = 1e18;

    // ==================== STATE VARIABLES ====================
    IERC20   private usdtToken     = IERC20(0x55d398326f99059fF775485246999027B3197955);
    IERC20   private fbmxToken     = IERC20(0x5951F937ff590239D38c10e871F9982359E56C36);    
    LIQUIDITY private liquidity    = LIQUIDITY(0x9686E2186842B5C303Fe5759c7857D3c145fF0f1);
    address  private projectWallet   = 0xf3EdCdefd7B8812aA661B79c3E615d653c606A81;
    address  private marketingWallet = 0xEb08Bed941e80424A385b983525756D02Ef72Fed;

    // Safety parameters
    uint8   private maxRank       = 14;
    uint8   private maxCapped     = 3;
    uint8   private maxCooldown   = 1;
    uint8   private maxIteration  = 100;
    uint8   private maxBinaryHits = 3;
    uint256 private entryFee      = 5 * TOKEN_DECIMALS;
    uint256 private minTransaction = 50000000000000000;
    uint256 private transactionCooldown = 10;

    // Reward rates (basis points)
    uint256 private rewardsReferral       = 1000;
    uint256 private rewardsBinary         = 1000;
    uint256 private rewardsAgent          = 500;
    uint256 private rewardsMarketingFunds = 500;
    uint256 private rewardsProjectFunds   = 1000;
    uint256 private rewardsLiquidityFunds = 1000;

    // Global statistics
    uint256 private totalDeposits;
    uint256 private totalRewards;
    uint256 private totalWithdrawals;
    uint256 private totalMarketingFunding;
    uint256 private totalProjectFunding;
    uint256 private totalLiquidityFunding;
    uint256 private totalUsers;

    // ==================== STRUCTS ====================

    struct AffiliateData {
        address   parent;       // Referral/affiliate sponsor
        address   agent;        // Master agent (inherited from sponsor chain)
        uint256   totalDirect;  // Cumulative referral income credited to this user
        uint8     level;        // Current rank (0 = registered but never activated)
        address[] children;     // Direct referral children (dynamic — always at end)
    }

    struct BinaryData {
        address parent;
        address leftAddress;
        address rightAddress;
        uint256 leftVolume;
        uint256 rightVolume;
        uint256 coolDown;
    }

    struct WalletData {
        uint256 balance;
        uint256 capping;
        uint256 totalIncome;
        uint256 coolDown;
    }

    struct PassiveData {
        uint256 totalPassive;
        uint256 totalEquity;
        uint256 coolDown;
    }

    // ==================== MAPPINGS ====================
    mapping(address => AffiliateData) public affiliates;
    mapping(address => BinaryData)    public binaries;
    mapping(address => WalletData)    public wallets;
    mapping(address => PassiveData)   public passives;
    mapping(address => uint256)       public lastCallBlock;
    mapping(address => uint256)       public lastCallTime;
    mapping(address => uint256)       public tokenBalance;
    mapping(address => bool)          public isUser;
    mapping(address => bool) public hasActivated;
    mapping(address => uint8) private pendingTargetLevel;

    // ==================== EVENTS ====================
    event InternalTransfer(string method, address indexed from, address indexed to, uint256 amount);
    event WithdrawBalance(address indexed from, address indexed to, uint256 amount);
    event DepositBalance(address indexed from, address indexed to, uint256 amount);
    event TokenBalance(address indexed user, uint256 oldBalance, uint256 newBalance);
    event AccountRegistered(address indexed user, address indexed affiliateParent, address indexed binaryParent, bool binaryGroup);
    event AgentActivated(address indexed agent);
    event AccountActivated(address indexed user, uint8 newLevel);
    event Rewards(string rewardsName, address indexed from, address indexed to, uint256 value);
    event JumpActivation(address indexed user, uint8 indexed targetLevel, uint256 totalCost);

    // ==================== MODIFIERS ====================
    modifier isRegistered() {
        require(isUser[msg.sender], "USER_NOT_FOUND");
        _;
    }

    modifier antiSpam() {
        require(msg.sender == tx.origin,                              "CALLER_NOT_EOA");
        require(block.number > lastCallBlock[msg.sender],             "ONE_CALL_PER_BLOCK");
        require(block.timestamp >= lastCallTime[msg.sender] + transactionCooldown, "TRANSACTION_COOLDOWN");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    constructor() {
        lastCallBlock[msg.sender] = block.number;
        tokenBalance[msg.sender]  = 1000 * TOKEN_DECIMALS;
        affiliates[msg.sender] = AffiliateData({
            parent:      address(this),
            agent:       msg.sender,
            totalDirect: 0,
            level:       maxRank,
            children:    new address[](0)
        });
        binaries[msg.sender] = BinaryData({
            parent:       address(this),
            leftAddress:  address(0),
            rightAddress: address(0),
            leftVolume:   0,
            rightVolume:  0,
            coolDown:     block.timestamp
        });
        wallets[msg.sender] = WalletData({
            balance:     10240 * TOKEN_DECIMALS,
            capping:     10240 * TOKEN_DECIMALS * maxCapped,
            totalIncome: 0,
            coolDown:    block.timestamp
        });
        passives[msg.sender] = PassiveData({
            totalPassive: 0,
            totalEquity:  10240 * TOKEN_DECIMALS,
            coolDown:     block.timestamp
        });
        isUser[msg.sender]       = true;
        hasActivated[msg.sender] = true;
        totalUsers += 1;
    }

    // ==================== VIEW FUNCTIONS ====================

    function getChildren(
        address _user,
        uint256 _startIndex,
        uint256 _count)
    external view returns (address[] memory childrenBatch) {
        address[] storage children = affiliates[_user].children;
        uint256 totalChildren = children.length;
        if (_startIndex >= totalChildren || _count == 0) {
            return new address[](0);
        }
        uint256 endIndex = _startIndex + _count;
        if (endIndex > totalChildren) { endIndex = totalChildren; }
        childrenBatch = new address[](endIndex - _startIndex);
        for (uint256 i = _startIndex; i < endIndex; i++) {
            childrenBatch[i - _startIndex] = children[i];
        }
        return childrenBatch;
    }

    function getPassiveReward(address _user) external view returns (uint256) {
        return _calculatePassiveReward(_user);
    }

    function getPercentage(uint256 _passiveEquity, uint256 _referralIncome)
    external pure returns (uint256) {
        return _calculatePassivePct(_passiveEquity, _referralIncome);
    }

    function getEquity(uint256 _totalEquity, uint256 _totalIncome)
    external pure returns (uint256) {
        return _activeEquity(_totalEquity, _totalIncome);
    }

    function getUpgradeAmount(address _user) external view returns (uint256) {
        return _calculateUpgradeAmount(_user);
    }

    function getPlacement(address _user, uint8 _options)
    external view returns (address _address, bool _position) {
        if (_options == 0) return _binaryOpenNode(_user, false);
        if (_options == 1) return _binaryOpenNode(_user, true);
        return _binaryLessNode(_user);
    }

    function getWithdrawAmount(uint8 _userLevel, uint256 _amount)
    external pure returns (uint256) {
        return _calculateWithdrawAmount(_userLevel, _amount);
    }

    function getContractStats()
    external view returns (
        uint256 _totalUsers,
        uint256 _totalUSDT,
        uint256 _totalFBMX,
        uint256 _totalDeposits,
        uint256 _totalRewards,
        uint256 _totalWithdrawals,
        uint256 _totalMarketingFunding,
        uint256 _totalProjectFunding,
        uint256 _totalLiquidityFunding
    ) {
        return (
            totalUsers,
            usdtToken.balanceOf(address(this)),
            fbmxToken.balanceOf(address(this)),
            totalDeposits,
            totalRewards,
            totalWithdrawals,
            totalMarketingFunding,
            totalProjectFunding,
            totalLiquidityFunding
        );
    }

    function calculateCumulativeCost(uint8 targetLevel) public view returns (uint256) {
        require(targetLevel >= 1,       "MIN_TARGET_LEVEL_IS_1");
        require(targetLevel <= maxRank, "TARGET_EXCEEDS_MAX_RANK");
        // entryFee × (2^targetLevel − 1)
        return entryFee * ((2 ** uint256(targetLevel)) - 1);
    }

    // ==================== USER FUNCTIONS ====================

    function register(address _referrer, uint8 _group)
    external nonReentrant antiSpam {
        AffiliateData storage affiliate = affiliates[_referrer];
        AffiliateData storage newMember = affiliates[msg.sender];
        require(usdtToken.balanceOf(msg.sender) >= entryFee, "REQUIRED_USDT_BALANCE");
        address _address;
        bool    _position;
        if (_group == 0 || _group == 1) {
            (_address, _position) = _binaryOpenNode(_referrer, _group == 1);
        } else {
            (_address, _position) = _binaryLessNode(_referrer);
        }
        BinaryData storage binaryParent = binaries[_address];

        require(!isUser[msg.sender],         "ALREADY_REGISTERED");
        require(isUser[_referrer],           "SPONSOR_NOT_FOUND");
        require(_referrer != msg.sender,     "SELF_REFERRAL_NOT_ALLOWED");
        if (!_position) require(binaryParent.leftAddress  == address(0), "PLACEMENT_TAKEN");
        if ( _position) require(binaryParent.rightAddress == address(0), "PLACEMENT_TAKEN");

        // Update referrer's children list
        affiliate.children.push(msg.sender);

        // Initialise new affiliate record (V2 field order)
        newMember.parent      = _referrer;
        newMember.agent       = affiliate.agent;
        newMember.totalDirect = 0;
        newMember.level       = 0;
        // children is already an empty dynamic array by default — no explicit assignment needed

        // Binary tree placement
        if (_position) { binaryParent.rightAddress = msg.sender; }
        else           { binaryParent.leftAddress  = msg.sender; }

        BinaryData storage binary = binaries[msg.sender];
        binary.parent       = _address;
        binary.leftAddress  = address(0);
        binary.rightAddress = address(0);
        binary.leftVolume   = 0;
        binary.rightVolume  = 0;
        binary.coolDown     = block.timestamp;

        isUser[msg.sender]       = true;
        totalUsers              += 1;
        lastCallBlock[msg.sender] = block.number;
        tokenBalance[msg.sender]  = 0;
        emit AccountRegistered(msg.sender, _referrer, _address, _position);
    }

    function depositUSDT(uint8 targetLevel)
    external nonReentrant antiSpam isRegistered {
        WalletData storage wallet = wallets[msg.sender];
        uint256 amount;

        if (targetLevel > 0 && !hasActivated[msg.sender]) {
            // ── JUMP DEPOSIT ──────────────────────────────────────────────
            require(targetLevel <= maxRank,                    "TARGET_EXCEEDS_MAX_RANK");
            require(affiliates[msg.sender].level == 0,         "ALREADY_HAS_LEVEL");
            // Block a second jump deposit while one is already pending.
            // If user wants to change targetLevel they must activate first,
            // or the admin can call resetPendingTargetLevel().
            require(pendingTargetLevel[msg.sender] == 0,       "PENDING_ACTIVATION_EXISTS");

            amount = calculateCumulativeCost(targetLevel);
            pendingTargetLevel[msg.sender] = targetLevel;

        } else if (targetLevel > 0 && hasActivated[msg.sender]) {
            // Jump mode requested but already activated — hard revert.
            revert("JUMP_MODE_FIRST_ACTIVATION_ONLY");

        } else {
            // ── NORMAL DEPOSIT ────────────────────────────────────────────
            // targetLevel == 0.  Clear any stale pending state defensively.
            if (pendingTargetLevel[msg.sender] != 0) {
                pendingTargetLevel[msg.sender] = 0;
            }
            amount = _calculateUpgradeAmount(msg.sender);
        }

        require(usdtToken.balanceOf(msg.sender) >= amount, "NOT_ENOUGH_BALANCE");
        wallet.balance  += amount;
        wallet.coolDown  = block.timestamp;
        totalDeposits   += amount;
        lastCallBlock[msg.sender] = block.number;
        require(usdtToken.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        _distributeFundings(amount);
        emit DepositBalance(msg.sender, address(this), amount);
    }

    // ────────────────────────────────────────────────────────────────────────
    /**
     * @notice Deposit FBMX tokens into the contract as utility-fee balance.
     * @dev    Unchanged from V1.
     */
    function depositFBMX(uint256 _amount)
    external nonReentrant antiSpam isRegistered {
        require(_amount >= 5 * TOKEN_DECIMALS,                               "MINIMUM_DEPOSIT_REQUIRED");
        require(fbmxToken.balanceOf(msg.sender) >= _amount,                 "NOT_ENOUGH_BALANCE");
        require(fbmxToken.transferFrom(msg.sender, address(this), _amount), "TRANSFER_FAILED");
        tokenBalance[msg.sender] += _amount;
        lastCallBlock[msg.sender] = block.number;
        emit TokenBalance(msg.sender, tokenBalance[msg.sender] - _amount, tokenBalance[msg.sender]);
    }

    function activateRank()
    external nonReentrant antiSpam isRegistered {
        AffiliateData storage affiliate = affiliates[msg.sender];
        WalletData    storage wallet    = wallets[msg.sender];
        PassiveData   storage passive   = passives[msg.sender];

        if (!hasActivated[msg.sender] && pendingTargetLevel[msg.sender] > 0) {

            // ════════════════════════════════════════════════════════════════
            //  BRANCH A — JUMP ACTIVATION
            // ════════════════════════════════════════════════════════════════

            uint8   targetLevel = pendingTargetLevel[msg.sender];
            uint256 totalCost   = calculateCumulativeCost(targetLevel);

            // ── Integrity guards ────────────────────────────────────────────
            // These should never fail if the deposit path was used correctly,
            // but are kept for defence-in-depth.
            require(affiliate.level == 0,       "ALREADY_HAS_LEVEL");
            require(wallet.balance >= totalCost, "NOT_ENOUGH_BALANCE");

            // ── Capping: equivalent to N sequential activateRank() calls ───
            uint256 totalCapping = _calculateJumpCapping(targetLevel);

            // ── State mutations ─────────────────────────────────────────────
            affiliate.level     = targetLevel;

            wallet.capping     += totalCapping;
            wallet.balance     -= totalCost;
            wallet.coolDown     = block.timestamp;

            passive.totalEquity += totalCost;   // totalCost == ∑ upgradeAmount_k
            passive.coolDown    = block.timestamp;

            // ── Clear jump state before external calls (CEI pattern) ────────
            pendingTargetLevel[msg.sender] = 0;
            hasActivated[msg.sender]       = true;

            // ── Distribute rewards once (linear equivalence holds) ──────────
            _distributeReferralRewards(msg.sender, totalCost);
            _distributeBinaryRewards(msg.sender, totalCost);
            _distributeMasterAgent(affiliate.agent, totalCost);

            lastCallBlock[msg.sender] = block.number;
            lastCallTime[msg.sender]  = block.timestamp;

            emit JumpActivation(msg.sender, targetLevel, totalCost);
            emit AccountActivated(msg.sender, targetLevel);

        } else {

            // ════════════════════════════════════════════════════════════════
            //  BRANCH B — SEQUENTIAL ACTIVATION (original V1 logic)
            // ════════════════════════════════════════════════════════════════

            uint256 upgradeAmount = _calculateUpgradeAmount(msg.sender);

            // Level increments BEFORE capping calculation (same as V1)
            affiliate.level += 1;

            require(wallet.balance >= upgradeAmount, "NOT_ENOUGH_BALANCE");

            uint8 maxCappedLimit  = affiliate.level > maxRank ? 2 : maxCapped;
            wallet.capping       += upgradeAmount * maxCappedLimit;
            wallet.balance       -= upgradeAmount;
            wallet.coolDown       = block.timestamp;

            passive.totalEquity  += upgradeAmount;
            passive.coolDown      = block.timestamp;

            // Mark activated on first sequential activation
            if (!hasActivated[msg.sender]) {
                hasActivated[msg.sender] = true;
            }

            _distributeReferralRewards(msg.sender, upgradeAmount);
            _distributeBinaryRewards(msg.sender, upgradeAmount);
            _distributeMasterAgent(affiliate.agent, upgradeAmount);

            lastCallBlock[msg.sender] = block.number;
            lastCallTime[msg.sender]  = block.timestamp;
            emit AccountActivated(msg.sender, affiliate.level);
        }
    }

    function collectPassiveRewards()
    external nonReentrant antiSpam isRegistered {
        WalletData  storage wallet  = wallets[msg.sender];
        PassiveData storage passive = passives[msg.sender];
        uint256 passiveRewards = _calculatePassiveReward(msg.sender);
        require(block.timestamp >= passive.coolDown + 24 hours,          "COOLDOWN_ACTIVE");
        passiveRewards = passiveRewards > wallet.capping ? wallet.capping : passiveRewards;
        require(passiveRewards > 0,                                      "NOT_ENOUGH_REWARDS");
        require(tokenBalance[msg.sender] >= minTransaction,              "NOT_ENOUGH_FBMX");
        tokenBalance[msg.sender]  -= minTransaction;
        wallet.balance            += passiveRewards;
        wallet.totalIncome        += passiveRewards;
        wallet.capping            -= passiveRewards;
        passive.coolDown           = block.timestamp;
        passive.totalPassive      += passiveRewards;
        totalRewards              += passiveRewards;
        lastCallBlock[msg.sender]  = block.number;
        lastCallTime[msg.sender]   = block.timestamp;
        emit InternalTransfer("PASSIVE", address(this), msg.sender, passiveRewards);
    }

    function collectBinaryRewards()
    external nonReentrant antiSpam isRegistered {
        WalletData storage wallet = wallets[msg.sender];
        BinaryData storage binary = binaries[msg.sender];
        uint256 binaryRewards;
        if (binary.leftVolume >= binary.rightVolume) { binaryRewards = binary.rightVolume; }
        else                                         { binaryRewards = binary.leftVolume;  }
        binaryRewards = binaryRewards > wallet.capping ? wallet.capping : binaryRewards;
        require(
            binary.leftVolume  >= binaryRewards &&
            binary.rightVolume >= binaryRewards &&
            binaryRewards > 0,
            "NOT_ENOUGH_REWARDS"
        );
        require(block.timestamp >= binary.coolDown + 24 hours, "COOLDOWN_ACTIVE");
        require(tokenBalance[msg.sender] >= minTransaction,    "NOT_ENOUGH_FBMX");
        tokenBalance[msg.sender]  -= minTransaction;
        binary.coolDown            = block.timestamp;
        binary.leftVolume         -= binaryRewards;
        binary.rightVolume        -= binaryRewards;
        wallet.capping            -= binaryRewards;
        wallet.balance            += binaryRewards;
        wallet.totalIncome        += binaryRewards;
        totalRewards              += binaryRewards;
        lastCallBlock[msg.sender]  = block.number;
        lastCallTime[msg.sender]   = block.timestamp;
        emit InternalTransfer("BINARY", address(this), msg.sender, binaryRewards);
    }

    function withdrawBalance(uint256 _amount)
    external nonReentrant antiSpam isRegistered {
        WalletData storage wallet = wallets[msg.sender];
        require(block.timestamp >= wallet.coolDown + 24 hours, "COOLDOWN_ACTIVE");
        uint8   userLevel      = affiliates[msg.sender].level;
        uint256 transferAmount = _calculateWithdrawAmount(userLevel, _amount);
        require(transferAmount > 0,                                              "TRANSFER_AMOUNT_FAILED");
        require(transferAmount <= wallet.balance,                                "NOT_ENOUGH_BALANCE");
        require(transferAmount <= usdtToken.balanceOf(address(this)),           "NOT_ENOUGH_FUNDS");
        require(tokenBalance[msg.sender] >= minTransaction,                      "NOT_ENOUGH_FBMX");
        tokenBalance[msg.sender]  -= minTransaction;
        wallet.balance            -= transferAmount;
        wallet.coolDown            = block.timestamp;
        totalWithdrawals          += transferAmount;
        lastCallBlock[msg.sender]  = block.number;
        lastCallTime[msg.sender]   = block.timestamp;
        require(usdtToken.transfer(msg.sender, transferAmount), "TRANSFER_FAILED");
        emit WithdrawBalance(address(this), msg.sender, transferAmount);
    }

    // ==================== PRIVATE FUNCTIONS ====================

    function _calculateJumpCapping(uint8 targetLevel) private view returns (uint256) {
        uint256 totalCapping = 0;
        for (uint8 i = 0; i < targetLevel; i++) {
            uint256 amt       = entryFee * (2 ** uint256(i));
            uint8   postLevel = i + 1;
            uint8   cappedLimit = postLevel > maxRank ? 2 : maxCapped; // mirrors sequential branch: > not >=
            totalCapping += amt * cappedLimit;
        }
        return totalCapping;
    }

    function _calculateWithdrawAmount(uint8 _userLevel, uint256 _amount)
    private pure returns (uint256) {
        if (_amount ==   15 * TOKEN_DECIMALS && _userLevel >=  1) return _amount;
        if (_amount ==   50 * TOKEN_DECIMALS && _userLevel >=  4) return _amount;
        if (_amount ==  100 * TOKEN_DECIMALS && _userLevel >=  7) return _amount;
        if (_amount ==  500 * TOKEN_DECIMALS && _userLevel >= 10) return _amount;
        if (_amount == 1000 * TOKEN_DECIMALS && _userLevel >= 13) return _amount;
        return 0;
    }

    function _calculateUpgradeAmount(address _user) private view returns (uint256) {
        uint8 currentLevel = affiliates[_user].level < maxRank
            ? affiliates[_user].level
            : maxRank;
        return entryFee * (2 ** uint256(currentLevel));
    }

    function _distributeMasterAgent(address _agent, uint256 _amount) private {
        uint256 agentRewards = (_amount * rewardsAgent) / BASIS_POINTS;
        require(usdtToken.transfer(_agent, agentRewards), "TRANSFER_FAILED");
        emit Rewards("agentRewards", address(this), _agent, agentRewards);
    }

    function _distributeFundings(uint256 _amount) private {
        uint256 balance = usdtToken.balanceOf(address(this));

        uint256 marketingFunding = (_amount * rewardsMarketingFunds) / BASIS_POINTS;
        if (marketingFunding > 0 && balance >= marketingFunding) {
            usdtToken.transfer(marketingWallet, marketingFunding);
            totalMarketingFunding += marketingFunding;
            balance               -= marketingFunding;
            emit Rewards("tradeFunding", address(this), marketingWallet, marketingFunding);
        }

        uint256 projectFunding = (_amount * rewardsProjectFunds) / BASIS_POINTS;
        if (projectFunding > 0 && balance >= projectFunding) {
            usdtToken.transfer(projectWallet, projectFunding);
            totalProjectFunding += projectFunding;
            balance             -= projectFunding;
            emit Rewards("tradeFunding", address(this), projectWallet, projectFunding);
        }

        uint256 liquidityFunding = (_amount * rewardsLiquidityFunds) / BASIS_POINTS;
        uint256 minLiquidity = 1 * TOKEN_DECIMALS;
        if (liquidityFunding < minLiquidity) { liquidityFunding = minLiquidity; }
        if (liquidityFunding > 0 && balance >= liquidityFunding) {
            usdtToken.approve(address(liquidity), liquidityFunding);
            uint256 liquidityAdded = liquidity.addLiquidityUSDT(liquidityFunding, 500);
            totalLiquidityFunding += liquidityAdded;
            emit Rewards("liquidityFunding", address(liquidity), address(this), liquidityFunding);
        }
    }

    function _distributeReferralRewards(address _user, uint256 _amount) private {
        address referrer = affiliates[_user].parent;
        uint256 reward   = (_amount * rewardsReferral) / BASIS_POINTS;
        if (referrer == address(0) || referrer == address(this)) return;
        WalletData    storage referrerWallet = wallets[referrer];
        AffiliateData storage affiliate      = affiliates[referrer];
        if (referrerWallet.capping >= reward) {
            referrerWallet.capping    -= reward;
            referrerWallet.balance    += reward;
            referrerWallet.totalIncome += reward;
            affiliate.totalDirect     += reward;
            totalRewards              += reward;
            emit Rewards("ReferralRewards", _user, referrer, reward);
        }
    }

    function _distributeBinaryRewards(address _user, uint256 _amount) private {
        uint256 reward          = (_amount * rewardsBinary) / BASIS_POINTS;
        uint256 rewardsGiven    = 0;
        uint256 levelsTraversed = 0;
        address currentChild    = _user;
        address currentParent   = binaries[_user].parent;
        uint8   currentLevel    = affiliates[_user].level;

        while (rewardsGiven < maxBinaryHits && levelsTraversed < maxIteration) {
            levelsTraversed++;
            if (currentParent == address(0)) break;

            BinaryData    storage binary    = binaries[currentParent];
            WalletData    storage wallet    = wallets[currentParent];
            AffiliateData storage affiliate = affiliates[currentParent];

            if (affiliate.level > currentLevel && wallet.capping >= reward) {
                currentLevel = affiliate.level;
                bool isLeftChild  = (binary.leftAddress  == currentChild);
                bool isRightChild = (binary.rightAddress == currentChild);
                if (!isLeftChild && !isRightChild) break;

                if (isLeftChild) {
                    if (binary.leftVolume < binary.rightVolume) {
                        rewardsGiven++;
                        emit Rewards("BINARY", _user, currentParent, reward);
                    }
                    binary.leftVolume += reward;
                } else {
                    if (binary.rightVolume < binary.leftVolume) {
                        rewardsGiven++;
                        emit Rewards("BINARY", _user, currentParent, reward);
                    }
                    binary.rightVolume += reward;
                }
            }
            currentChild  = currentParent;
            currentParent = binary.parent;
        }
    }

    function _calculatePassiveReward(address _user) private view returns (uint256) {
        WalletData    storage wallet    = wallets[_user];
        AffiliateData memory  affiliate = affiliates[_user];
        PassiveData   memory  passive   = passives[_user];
        if (passive.coolDown == 0) return 0;

        uint256 maturedDays     = (block.timestamp - passive.coolDown) / 24 hours;
        uint256 availableEquity = _activeEquity(passive.totalEquity, wallet.totalIncome);
        if (availableEquity == 0) return 0;

        uint256 passivePct = _calculatePassivePct(passive.totalEquity, affiliate.totalDirect);
        return (availableEquity * passivePct * maturedDays) / BASIS_POINTS;
    }

    function _calculatePassivePct(uint256 _passiveEquity, uint256 _referralIncome)
    private pure returns (uint256) {
        if (_passiveEquity   == 0) return 0;
        if (_referralIncome  == 0) return 100;
        uint256 rateBps = (_referralIncome * 1000) / _passiveEquity;
        if (rateBps < 100) return 100;
        if (rateBps > 800) return 800;
        return rateBps;
    }

    function _activeEquity(uint256 _totalEquity, uint256 _totalIncome)
    private pure returns (uint256) {
        if (_totalEquity == 0) return 0;

        uint256 BASE_DEPOSIT    = 5  * TOKEN_DECIMALS;
        uint8   MAX_LAYERS      = 15;
        uint256 INCOME_CAP      = 491_505 * TOKEN_DECIMALS;
        uint256 CAPPED_INCREMENT = 81_920 * TOKEN_DECIMALS;

        if (_totalIncome < BASE_DEPOSIT * 3) return _totalEquity;

        uint256 removedEquity = 0;
        uint256 cumulative    = 0;
        uint256 deposit       = BASE_DEPOSIT;

        for (uint8 i = 0; i < MAX_LAYERS; i++) {
            cumulative += deposit;
            if (_totalIncome >= cumulative * 3) {
                removedEquity += deposit;
                if (removedEquity >= _totalEquity) return 0;
                deposit *= 2;
            } else {
                break;
            }
        }

        uint256 activeEquity = _totalEquity - removedEquity;
        if (_totalIncome >= INCOME_CAP) {
            return activeEquity > CAPPED_INCREMENT ? CAPPED_INCREMENT : activeEquity;
        }
        return activeEquity;
    }

    function _removedChild(address _parent, address _child) private {
        if (affiliates[_parent].parent == address(0)) return;
        address[] storage children = affiliates[_parent].children;
        uint256 length = children.length;
        for (uint256 i = 0; i < length; i++) {
            if (children[i] == _child) {
                if (i != length - 1) { children[i] = children[length - 1]; }
                children.pop();
                return;
            }
        }
    }

    function _binaryOpenNode(address _placement, bool _group)
    private view returns (address, bool) {
        uint256 iterations = 0;
        while (_placement != address(0) && iterations < maxIteration) {
            BinaryData memory node = binaries[_placement];
            if (_group) {
                if (node.rightAddress != address(0)) { _placement = node.rightAddress; }
                else                                  { return (_placement, true);  }
            } else {
                if (node.leftAddress != address(0))  { _placement = node.leftAddress;  }
                else                                  { return (_placement, false); }
            }
            iterations++;
        }
        return (_placement, false);
    }

    function _binaryLessNode(address _user)
    private view returns (address _address, bool _position) {
        address current    = _user;
        uint256 iterations = 0;
        while (current != address(0) && iterations < maxIteration) {
            BinaryData memory node = binaries[current];
            bool hasLeft  = node.leftAddress  != address(0);
            bool hasRight = node.rightAddress != address(0);

            // 1. No children → place left
            if (!hasLeft && !hasRight) return (current, false);

            // 2. Left child only → right slot is open; right has less
            if (hasLeft && !hasRight) return (current, true);

            // 3. Right child only → left slot is open; left has less
            if (!hasLeft && hasRight) return (current, false);

            // 4. Both children → descend toward the leg with less (or equal) volume
            if (node.leftVolume <= node.rightVolume) {
                current = node.leftAddress;
            } else {
                current = node.rightAddress;
            }
            iterations++;
        }
        return (current, false);
    }

    // ==================== ADMIN FUNCTIONS ====================

    function updateAffiliateData(
        address _user,
        address _parent,
        address _agent,
        uint256 _totalDirect,
        uint8   _level,
        bool    _isUser,
        bool    _hasActivated
    ) external onlyOwner {
        require(_user   != address(0), "ZERO_ADDRESS_FORBIDDEN");
        require(_parent != _user,      "CHILD_IS_NOT_PARENT");

        AffiliateData storage affiliate = affiliates[_user];

        if (_parent != address(0)) {
            address oldParent = affiliate.parent;
            _removedChild(oldParent, _user);
            affiliate.parent = _parent;
            affiliates[_parent].children.push(_user);
        }
        if (_agent        != address(0))       affiliate.agent       = _agent;
        if (_totalDirect  > 0)                 affiliate.totalDirect = _totalDirect;
        if (_level        != affiliate.level)  affiliate.level       = _level;

        if (_isUser != isUser[_user]) {
            isUser[_user] = _isUser;
            if (_isUser) totalUsers += 1;
            else         totalUsers -= 1;
        }

        // V2: migrate hasActivated state
        if (_hasActivated != hasActivated[_user]) {
            hasActivated[_user] = _hasActivated;
        }
    }

    function updateBinaryData(
        address _user,
        address _parent,
        address _leftAddress,
        address _rightAddress,
        uint256 _leftVolume,
        uint256 _rightVolume,
        uint256 _coolDown
    ) external onlyOwner {
        require(isUser[_user], "USER_NOT_FOUND");
        BinaryData storage userNode = binaries[_user];
        if (_parent != address(0) && _parent != _user) userNode.parent = _parent;
        if (_leftAddress  != address(0) && _leftAddress  != _user) userNode.leftAddress  = _leftAddress;
        if (_rightAddress != address(0) && _rightAddress != _user) userNode.rightAddress = _rightAddress;
        if (_leftVolume  > 0) userNode.leftVolume  = _leftVolume;
        if (_rightVolume > 0) userNode.rightVolume = _rightVolume;
        if (_coolDown    > 0) userNode.coolDown    = _coolDown;
    }

    function updateWalletData(
        address _user,
        uint256 _balance,
        uint256 _capping,
        uint256 _totalIncome,
        uint256 _coolDown,
        uint256 _tokenBalance
    ) external onlyOwner {
        require(isUser[_user], "USER_NOT_FOUND");
        WalletData storage wallet = wallets[_user];
        if (_balance      > 0) wallet.balance     = _balance;
        if (_capping      > 0) wallet.capping     = _capping;
        if (_totalIncome  > 0) wallet.totalIncome = _totalIncome;
        if (_coolDown     > 0) wallet.coolDown    = _coolDown;
        if (_tokenBalance > 0) tokenBalance[_user] = _tokenBalance;
    }

    function updatePassiveData(
        address _user,
        uint256 _totalPassive,
        uint256 _totalEquity,
        uint256 _coolDown
    ) external onlyOwner {
        require(isUser[_user], "USER_NOT_FOUND");
        PassiveData storage passive = passives[_user];
        if (_totalPassive > 0) passive.totalPassive = _totalPassive;
        if (_totalEquity  > 0) passive.totalEquity  = _totalEquity;
        if (_coolDown     > 0) passive.coolDown     = _coolDown;
    }

    function updateFundingWallets(
        address _liquidityWallet,
        address _projectWallet,
        address _marketingWallet
    ) external onlyOwner {
        if (_liquidityWallet != address(0)) liquidity       = LIQUIDITY(_liquidityWallet);
        if (_projectWallet   != address(0)) projectWallet   = _projectWallet;
        if (_marketingWallet != address(0)) marketingWallet = _marketingWallet;
    }

    function resetPendingTargetLevel(address _user) external onlyOwner {
        require(isUser[_user],                          "USER_NOT_FOUND");
        require(!hasActivated[_user],                   "ALREADY_ACTIVATED");
        require(pendingTargetLevel[_user] > 0,          "NO_PENDING_TARGET");
        pendingTargetLevel[_user] = 0;
    }

    function emergencyWithdrawal() external onlyOwner nonReentrant {
        uint256 usdtLeft = usdtToken.balanceOf(address(this));
        uint256 fbmxLeft = fbmxToken.balanceOf(address(this));
        if (usdtLeft > 0) usdtToken.transfer(owner(), usdtLeft);
        if (fbmxLeft > 0) fbmxToken.transfer(owner(), fbmxLeft);
    }
}
