// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PaymentScope
 * @notice Scoped payment authorization for AI agents
 * @dev Owners fund scopes; agents can only spend within authorized limits
 */
contract PaymentScope {
    struct Scope {
        address owner;
        address agent;
        uint256 maxAmount;
        uint256 spentAmount;
        string purpose;
        bool active;
        uint256 createdAt;
    }

    mapping(bytes32 => Scope) public scopes;
    mapping(address => bytes32[]) public agentScopes;

    event ScopeCreated(
        bytes32 indexed scopeId,
        address indexed owner,
        address indexed agent,
        uint256 maxAmount,
        string purpose
    );
    event PaymentExecuted(
        bytes32 indexed scopeId,
        address indexed to,
        uint256 amount,
        string memo
    );
    event ScopeRevoked(bytes32 indexed scopeId, uint256 refunded);

    error NotAgent();
    error ScopeInactive();
    error ExceedsLimit(uint256 requested, uint256 remaining);
    error NotOwner();
    error ZeroAmount();

    /**
     * @notice Create a new payment scope, funding it with ETH
     * @param agent The AI agent address authorized to spend
     * @param purpose Human-readable description of what the agent can pay for
     * @return scopeId Unique identifier for this scope
     */
    function createScope(
        address agent,
        string calldata purpose
    ) external payable returns (bytes32 scopeId) {
        if (msg.value == 0) revert ZeroAmount();
        scopeId = keccak256(
            abi.encodePacked(msg.sender, agent, block.timestamp, block.prevrandao)
        );
        scopes[scopeId] = Scope({
            owner: msg.sender,
            agent: agent,
            maxAmount: msg.value,
            spentAmount: 0,
            purpose: purpose,
            active: true,
            createdAt: block.timestamp
        });
        agentScopes[agent].push(scopeId);
        emit ScopeCreated(scopeId, msg.sender, agent, msg.value, purpose);
    }

    /**
     * @notice AI agent executes a payment within its authorized scope
     * @param scopeId The scope to spend from
     * @param to Recipient address
     * @param amount Amount in wei
     * @param memo Why this payment was made (stored on-chain for audit)
     */
    function executePayment(
        bytes32 scopeId,
        address payable to,
        uint256 amount,
        string calldata memo
    ) external {
        Scope storage s = scopes[scopeId];
        if (msg.sender != s.agent) revert NotAgent();
        if (!s.active) revert ScopeInactive();
        uint256 remainingAmount = s.maxAmount - s.spentAmount;
        if (amount > remainingAmount) revert ExceedsLimit(amount, remainingAmount);
        s.spentAmount += amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit PaymentExecuted(scopeId, to, amount, memo);
    }

    /**
     * @notice Owner revokes a scope and gets unspent ETH refunded
     */
    function revokeScope(bytes32 scopeId) external {
        Scope storage s = scopes[scopeId];
        if (msg.sender != s.owner) revert NotOwner();
        if (!s.active) revert ScopeInactive();
        s.active = false;
        uint256 refund = s.maxAmount - s.spentAmount;
        if (refund > 0) {
            (bool ok,) = s.owner.call{value: refund}("");
            require(ok, "Refund failed");
        }
        emit ScopeRevoked(scopeId, refund);
    }

    /**
     * @notice Get remaining balance in a scope
     */
    function remaining(bytes32 scopeId) external view returns (uint256) {
        Scope storage s = scopes[scopeId];
        return s.maxAmount - s.spentAmount;
    }

    /**
     * @notice Get all scope IDs for an agent
     */
    function getAgentScopes(address agent) external view returns (bytes32[] memory) {
        return agentScopes[agent];
    }
}
