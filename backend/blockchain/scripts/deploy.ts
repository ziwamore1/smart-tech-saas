const hre = require("hardhat");

async function main() {
  console.log("Deploying CertificateVerification contract...");

  const CertificateVerification = await hre.ethers.getContractFactory(
    "CertificateVerification"
  );

  const certificateVerification = await CertificateVerification.deploy();

  await certificateVerification.waitForDeployment();

  const address = await certificateVerification.getAddress();
  console.log("CertificateVerification deployed to:", address);

  // Verify contract on block explorer if on a public network
  const network = hre.network.name;
  const networkInfo = await hre.ethers.provider.getNetwork();
  const chainId = Number(networkInfo.chainId);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    contractAddress: address,
    deployedAt: new Date().toISOString(),
    deployer: (await hre.ethers.getSigners())[0].address,
    chainId: chainId,
  };

  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  // Write to deployment file
  const fs = require("fs");
  const path = require("path");

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network}-latest.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);

  // Also append to history
  const historyFile = path.join(deploymentsDir, "history.json");
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  }
  history.push(deploymentInfo);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log(`Deployment history updated: ${historyFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
