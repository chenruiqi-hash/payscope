const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying PaymentScope to", network.name, "...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const PaymentScope = await ethers.getContractFactory("PaymentScope");
  const contract = await PaymentScope.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nPaymentScope deployed to:", address);
  console.log("Tx hash:", contract.deploymentTransaction().hash);
  console.log("\nVerify on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${address}`);

  // Save deployment info
  const fs = require("fs");
  const deployment = {
    network: network.name,
    address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info saved to deployment.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
