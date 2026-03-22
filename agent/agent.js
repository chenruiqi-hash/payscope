/**
 * PayScope AI Agent
 * 
 * An AI agent that makes scoped ETH payments on behalf of a user.
 * It can only spend within pre-authorized limits and purposes.
 * All actions are recorded on-chain for full auditability.
 */

const { ethers } = require("ethers");
const readline = require("readline");
const fs = require("fs");
require("dotenv").config();

// ABI - only what the agent needs
const ABI = [
  "function createScope(address agent, string purpose) external payable returns (bytes32)",
  "function executePayment(bytes32 scopeId, address to, uint256 amount, string memo) external",
  "function revokeScope(bytes32 scopeId) external",
  "function remaining(bytes32 scopeId) external view returns (uint256)",
  "function scopes(bytes32) external view returns (address owner, address agent, uint256 maxAmount, uint256 spentAmount, string purpose, bool active, uint256 createdAt)",
  "function getAgentScopes(address agent) external view returns (bytes32[])",
  "event ScopeCreated(bytes32 indexed scopeId, address indexed owner, address indexed agent, uint256 maxAmount, string purpose)",
  "event PaymentExecuted(bytes32 indexed scopeId, address indexed to, uint256 amount, string memo)",
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.org";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

class PayScopeAgent {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, this.wallet);
    this.decisionLog = [];
  }

  async getActiveScopes() {
    const scopeIds = await this.contract.getAgentScopes(this.wallet.address);
    const active = [];
    for (const id of scopeIds) {
      const scope = await this.contract.scopes(id);
      if (scope.active) {
        const rem = await this.contract.remaining(id);
        active.push({
          id,
          purpose: scope.purpose,
          maxAmount: ethers.formatEther(scope.maxAmount),
          spentAmount: ethers.formatEther(scope.spentAmount),
          remaining: ethers.formatEther(rem),
        });
      }
    }
    return active;
  }

  /**
   * Core decision-making: agent evaluates whether a payment is appropriate
   * given its authorized scope.
   */
  async decidePayment(scopeId, to, amountEth, memo) {
    const scope = await this.contract.scopes(scopeId);
    const rem = await this.contract.remaining(scopeId);
    const amountWei = ethers.parseEther(amountEth.toString());

    const decision = {
      timestamp: new Date().toISOString(),
      requested: { to, amount: amountEth, memo },
      scope: { purpose: scope.purpose, remaining: ethers.formatEther(rem) },
      approved: false,
      reason: "",
    };

    if (!scope.active) {
      decision.reason = "Scope is not active";
      this.decisionLog.push(decision);
      return decision;
    }

    if (amountWei > rem) {
      decision.reason = `Insufficient scope balance: need ${amountEth} ETH, have ${ethers.formatEther(rem)} ETH`;
      this.decisionLog.push(decision);
      return decision;
    }

    // Simple purpose-matching heuristic (replace with LLM call for production)
    const memoLower = memo.toLowerCase();
    const purposeLower = scope.purpose.toLowerCase();
    const purposeWords = purposeLower.split(/\s+/);
    const memoWords = memoLower.split(/\s+/);
    const overlap = purposeWords.filter(w => memoWords.includes(w) || memoLower.includes(w));

    if (overlap.length === 0) {
      decision.reason = `Payment memo "${memo}" doesn't match scope purpose "${scope.purpose}"`;
      this.decisionLog.push(decision);
      return decision;
    }

    decision.approved = true;
    decision.reason = `Approved: within scope (${ethers.formatEther(rem)} ETH remaining), purpose matches`;
    this.decisionLog.push(decision);
    return decision;
  }

  async executePayment(scopeId, to, amountEth, memo) {
    const decision = await this.decidePayment(scopeId, to, amountEth, memo);
    
    console.log("\n--- Agent Decision ---");
    console.log("Status:", decision.approved ? "APPROVED" : "REJECTED");
    console.log("Reason:", decision.reason);

    if (!decision.approved) return null;

    const amountWei = ethers.parseEther(amountEth.toString());
    console.log("Executing payment...");
    const tx = await this.contract.executePayment(scopeId, to, amountWei, memo);
    const receipt = await tx.wait();
    console.log("Payment confirmed! Tx:", receipt.hash);
    console.log(`https://sepolia.etherscan.io/tx/${receipt.hash}`);
    return receipt;
  }

  async showAuditTrail() {
    console.log("\n=== Agent Decision Audit Trail ===");
    for (const d of this.decisionLog) {
      console.log(`[${d.timestamp}] ${d.approved ? "✓ APPROVED" : "✗ REJECTED"}: ${d.reason}`);
    }

    // Also show on-chain events
    const filter = this.contract.filters.PaymentExecuted();
    const events = await this.contract.queryFilter(filter);
    if (events.length > 0) {
      console.log("\n=== On-Chain Payment History ===");
      for (const e of events) {
        console.log(`Tx ${e.transactionHash}: ${ethers.formatEther(e.args.amount)} ETH → ${e.args.to} | Memo: ${e.args.memo}`);
      }
    }
  }
}

async function interactiveDemo() {
  console.log("\n╔════════════════════════════════════╗");
  console.log("║         PayScope AI Agent          ║");
  console.log("║  Scoped Payments for AI Agents     ║");
  console.log("╚════════════════════════════════════╝\n");

  const agent = new PayScopeAgent();
  console.log("Agent address:", agent.wallet.address);

  const scopes = await agent.getActiveScopes();
  if (scopes.length === 0) {
    console.log("No active scopes found. Have the owner create a scope first.");
    return;
  }

  console.log("\nActive scopes:");
  scopes.forEach((s, i) => {
    console.log(`  [${i}] Purpose: ${s.purpose}`);
    console.log(`      Budget: ${s.maxAmount} ETH | Spent: ${s.spentAmount} ETH | Remaining: ${s.remaining} ETH`);
  });

  // Demo payment
  const scope = scopes[0];
  const recipient = "0x1ED94Ca0857134a6d230ec03072E5D716F2A4BFB"; // Demo recipient
  const amount = "0.0001";
  const memo = "cloud storage service payment";

  console.log(`\nDemo: Requesting payment of ${amount} ETH for "${memo}"`);
  await agent.executePayment(scope.id, recipient, amount, memo);

  // Try a rejected payment
  console.log(`\nDemo: Requesting suspicious payment "buy NFTs"`);
  await agent.executePayment(scope.id, recipient, amount, "buy NFTs");

  await agent.showAuditTrail();
}

interactiveDemo().catch(console.error);
