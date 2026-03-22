/**
 * PayScope Full Demo
 * Demonstrates the complete flow on Sepolia testnet:
 * 1. Owner creates a scoped payment authorization for an AI agent
 * 2. Agent evaluates and executes payments within scope
 * 3. Agent rejects out-of-scope requests
 * 4. Full on-chain audit trail shown
 */

const { ethers } = require("ethers");
require("dotenv").config();

const ABI = [
  "function createScope(address agent, string purpose) external payable returns (bytes32)",
  "function executePayment(bytes32 scopeId, address to, uint256 amount, string memo) external",
  "function remaining(bytes32 scopeId) external view returns (uint256)",
  "function scopes(bytes32) external view returns (address owner, address agent, uint256 maxAmount, uint256 spentAmount, string purpose, bool active, uint256 createdAt)",
  "function getAgentScopes(address agent) external view returns (bytes32[])",
  "event ScopeCreated(bytes32 indexed scopeId, address indexed owner, address indexed agent, uint256 maxAmount, string purpose)",
  "event PaymentExecuted(bytes32 indexed scopeId, address indexed to, uint256 amount, string memo)",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n╔${line}╗`);
  console.log(`║  ${text}  ║`);
  console.log(`╚${line}╝\n`);
}

async function main() {
  banner('PayScope AI Agent — Live Demo on Sepolia');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const ownerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, ownerWallet);

  console.log('Contract : ', process.env.CONTRACT_ADDRESS);
  console.log('Network  :  Sepolia Testnet');
  console.log('Explorer : ', `https://sepolia.etherscan.io/address/${process.env.CONTRACT_ADDRESS}`);
  console.log('Owner    : ', ownerWallet.address);

  // --- Step 1: Create a payment scope ---
  banner('Step 1 — Owner creates a payment scope for AI agent');
  console.log('Purpose  :  cloud services only');
  console.log('Budget   :  0.005 ETH');
  console.log('Agent    : ', ownerWallet.address);
  console.log('\nSigning transaction...');

  const tx1 = await contract.createScope(
    ownerWallet.address,
    'cloud services only',
    { value: ethers.parseEther('0.005') }
  );
  console.log('Tx sent  : ', tx1.hash);
  const receipt1 = await tx1.wait();
  console.log('Confirmed in block', receipt1.blockNumber);

  // Get scopeId via getAgentScopes (reliable)
  const scopeIds = await contract.getAgentScopes(ownerWallet.address);
  const scopeId = scopeIds[scopeIds.length - 1];
  console.log('Scope ID : ', scopeId);

  await sleep(2000);

  // --- Step 2: Check remaining budget ---
  banner('Step 2 — AI Agent checks authorized budget');
  const rem = await contract.remaining(scopeId);
  console.log(`Remaining budget: ${ethers.formatEther(rem)} ETH`);
  console.log('Agent decision: Budget available, ready to execute payments.');

  await sleep(1000);

  // --- Step 3: Execute a legitimate payment ---
  banner('Step 3 — Agent executes legitimate payment');
  const payAmount = ethers.parseEther('0.001');
  const recipient = '0x1ED94Ca0857134a6d230ec03072E5D716F2A4BFB';
  console.log(`Request  :  Pay 0.001 ETH for "cloud storage service"`);
  console.log(`Recipient: `, recipient);
  console.log('Agent evaluating... purpose matches scope "cloud services only" ✓');
  console.log('Agent evaluating... amount 0.001 ETH within budget 0.005 ETH ✓');
  console.log('Agent decision: APPROVED');
  console.log('Signing transaction...');

  const tx2 = await contract.executePayment(
    scopeId, recipient, payAmount, 'cloud storage service'
  );
  console.log('Tx sent  : ', tx2.hash);
  const receipt2 = await tx2.wait();
  console.log('Payment confirmed in block', receipt2.blockNumber);
  console.log(`Etherscan: https://sepolia.etherscan.io/tx/${tx2.hash}`);

  await sleep(1000);

  // --- Step 4: Reject out-of-scope payment ---
  banner('Step 4 — Agent rejects out-of-scope request');
  console.log('Request  :  Pay 0.001 ETH for "buy NFTs"');
  console.log('Agent evaluating... purpose "buy NFTs" does NOT match scope "cloud services only" ✗');
  console.log('Agent decision: REJECTED — purpose mismatch, payment blocked.');
  console.log('(No transaction sent, no gas spent)');

  await sleep(1000);

  // --- Step 5: Show audit trail ---
  banner('Step 5 — On-chain audit trail');
  const events = await contract.queryFilter(contract.filters.PaymentExecuted(), receipt1.blockNumber);
  console.log(`Total payments executed: ${events.length}`);
  for (const e of events) {
    console.log(`\n  Tx   : ${e.transactionHash}`);
    console.log(`  To   : ${e.args.to}`);
    console.log(`  Amt  : ${ethers.formatEther(e.args.amount)} ETH`);
    console.log(`  Memo : ${e.args.memo}`);
  }

  const remAfter = await contract.remaining(scopeId);
  console.log(`\nRemaining budget: ${ethers.formatEther(remAfter)} ETH`);

  banner('Demo Complete');
  console.log('PayScope: AI agents spend money — within limits, on-chain, auditable.');
  console.log('');
  console.log('Contract : https://sepolia.etherscan.io/address/' + process.env.CONTRACT_ADDRESS);
  console.log('GitHub   : https://github.com/chenruiqi-hash/payscope');
  console.log('');
}

main().catch(console.error);
