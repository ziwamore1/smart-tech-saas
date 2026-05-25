const hre = require("hardhat");
const crypto = require("crypto");

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage:");
    console.log("  Register: npx hardhat run scripts/verify.ts --network polygon -- register <certificateHash> <metadata>");
    console.log("  Verify:   npx hardhat run scripts/verify.ts --network polygon -- verify <certificateHash>");
    console.log("  Revoke:   npx hardhat run scripts/verify.ts --network polygon -- revoke <certificateHash>");
    console.log("\nExample:");
    console.log('  npx hardhat run scripts/verify.ts --network polygonAmoy -- register 0x1234... \'{"documentId":"doc-123","type":"certificate"}\'');
    process.exit(1);
  }

  const action = args[0];
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error("Error: CONTRACT_ADDRESS environment variable not set");
    console.error("Set it in your .env file or pass it directly");
    process.exit(1);
  }

  const CertificateVerification = await hre.ethers.getContractFactory(
    "CertificateVerification"
  );
  const contract = await CertificateVerification.attach(contractAddress);

  switch (action) {
    case "register": {
      const certificateHash = args[1];
      const metadata = args[2] || "{}";

      console.log(`Registering certificate: ${certificateHash}`);
      const tx = await contract.registerCertificate(certificateHash, metadata);
      console.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log("Certificate registered successfully!");
      break;
    }

    case "verify": {
      const certificateHash = args[1];

      console.log(`Verifying certificate: ${certificateHash}`);
      const [exists, valid, registeredAt] = await contract.verifyCertificate(
        certificateHash
      );

      console.log("\nVerification Result:");
      console.log(`  Exists: ${exists}`);
      console.log(`  Valid: ${valid}`);
      console.log(
        `  Registered At: ${registeredAt > 0 ? new Date(Number(registeredAt) * 1000).toISOString() : "N/A"}`
      );

      if (exists) {
        const record = await contract.getCertificateRecord(certificateHash);
        console.log(`  Registrant: ${record.registrant}`);
        console.log(`  Metadata: ${record.metadata}`);
        console.log(`  Revoked: ${record.revoked}`);
      }
      break;
    }

    case "revoke": {
      const certificateHash = args[1];

      console.log(`Revoking certificate: ${certificateHash}`);
      const tx = await contract.revokeCertificate(certificateHash);
      console.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log("Certificate revoked successfully!");
      break;
    }

    case "total": {
      const total = await contract.getTotalCertificates();
      console.log(`Total registered certificates: ${total}`);
      break;
    }

    default:
      console.log(`Unknown action: ${action}`);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
