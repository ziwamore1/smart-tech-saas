const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Address:", signer.address);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Balance (wei):", balance.toString());
  console.log("Balance (MATIC):", ethers.formatEther(balance));
}

main().catch(console.error);
