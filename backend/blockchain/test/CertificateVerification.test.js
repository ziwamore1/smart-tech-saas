const { expect } = require("chai");
const { ethers } = require("hardhat");
const crypto = require("crypto");

describe("CertificateVerification", function () {
  let certificateVerification;
  let owner;
  let addr1;
  let addr2;

  const sampleHash =
    "0x" + crypto.createHash("sha256").update("test-certificate").digest("hex");
  const sampleMetadata = JSON.stringify({
    documentId: "doc-123",
    type: "certificate",
    schoolId: "school-456",
  });

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const CertificateVerification = await ethers.getContractFactory(
      "CertificateVerification"
    );
    certificateVerification = await CertificateVerification.deploy();
    await certificateVerification.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await certificateVerification.owner()).to.equal(owner.address);
    });

    it("Should start with zero certificates", async function () {
      expect(await certificateVerification.getTotalCertificates()).to.equal(0);
    });
  });

  describe("Certificate Registration", function () {
    it("Should register a certificate successfully", async function () {
      const tx = await certificateVerification.registerCertificate(sampleHash, sampleMetadata);
      const receipt = await tx.wait();

      expect(receipt.logs.length).to.be.gt(0);
      expect(await certificateVerification.getTotalCertificates()).to.equal(1);
    });

    it("Should not allow duplicate registration", async function () {
      await certificateVerification.registerCertificate(sampleHash, sampleMetadata);

      await expect(
        certificateVerification.registerCertificate(sampleHash, sampleMetadata)
      ).to.be.revertedWith("Certificate already registered");
    });

    it("Should not allow zero hash registration", async function () {
      await expect(
        certificateVerification.registerCertificate(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          sampleMetadata
        )
      ).to.be.revertedWith("Invalid certificate hash");
    });

    it("Should allow multiple different certificates", async function () {
      const hash2 =
        "0x" + crypto.createHash("sha256").update("test-certificate-2").digest("hex");

      await certificateVerification.registerCertificate(sampleHash, sampleMetadata);
      await certificateVerification.registerCertificate(hash2, sampleMetadata);

      expect(await certificateVerification.getTotalCertificates()).to.equal(2);
    });
  });

  describe("Certificate Verification", function () {
    beforeEach(async function () {
      await certificateVerification.registerCertificate(sampleHash, sampleMetadata);
    });

    it("Should verify an existing certificate", async function () {
      const [exists, valid, registeredAt] =
        await certificateVerification.verifyCertificate(sampleHash);

      expect(exists).to.be.true;
      expect(valid).to.be.true;
      expect(registeredAt).to.be.gt(0);
    });

    it("Should return false for non-existent certificate", async function () {
      const fakeHash =
        "0x" + crypto.createHash("sha256").update("fake").digest("hex");

      const [exists, valid, registeredAt] =
        await certificateVerification.verifyCertificate(fakeHash);

      expect(exists).to.be.false;
      expect(valid).to.be.false;
      expect(registeredAt).to.equal(0);
    });

    it("Should return full certificate record", async function () {
      const record = await certificateVerification.getCertificateRecord(sampleHash);

      expect(record.certificateHash).to.equal(sampleHash);
      expect(record.registrant).to.equal(owner.address);
      expect(record.metadata).to.equal(sampleMetadata);
      expect(record.revoked).to.be.false;
    });
  });

  describe("Certificate Revocation", function () {
    beforeEach(async function () {
      await certificateVerification.registerCertificate(sampleHash, sampleMetadata);
    });

    it("Should allow owner to revoke a certificate", async function () {
      const tx = await certificateVerification.revokeCertificate(sampleHash);
      const receipt = await tx.wait();

      expect(receipt.logs.length).to.be.gt(0);

      const [exists, valid] = await certificateVerification.verifyCertificate(
        sampleHash
      );

      expect(exists).to.be.true;
      expect(valid).to.be.false;
    });

    it("Should not allow non-owner to revoke", async function () {
      await expect(
        certificateVerification.connect(addr1).revokeCertificate(sampleHash)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should not allow revoking non-existent certificate", async function () {
      const fakeHash =
        "0x" + crypto.createHash("sha256").update("fake").digest("hex");

      await expect(
        certificateVerification.revokeCertificate(fakeHash)
      ).to.be.revertedWith("Certificate not found");
    });

    it("Should not allow revoking already revoked certificate", async function () {
      await certificateVerification.revokeCertificate(sampleHash);

      await expect(
        certificateVerification.revokeCertificate(sampleHash)
      ).to.be.revertedWith("Certificate already revoked");
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await certificateVerification.transferOwnership(addr1.address);
      expect(await certificateVerification.owner()).to.equal(addr1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        certificateVerification.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should not allow transfer to zero address", async function () {
      await expect(
        certificateVerification.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("New owner cannot be zero address");
    });
  });

  describe("Certificate Enumeration", function () {
    it("Should return correct range of hashes", async function () {
      const hashes = [];
      for (let i = 0; i < 5; i++) {
        const hash =
          "0x" + crypto.createHash("sha256").update(`cert-${i}`).digest("hex");
        hashes.push(hash);
        await certificateVerification.registerCertificate(hash, sampleMetadata);
      }

      const result = await certificateVerification.getCertificateHashes(1, 3);
      expect(result.length).to.equal(3);
      expect(result[0]).to.equal(hashes[1]);
      expect(result[1]).to.equal(hashes[2]);
      expect(result[2]).to.equal(hashes[3]);
    });

    it("Should revert on invalid range", async function () {
      await expect(
        certificateVerification.getCertificateHashes(5, 2)
      ).to.be.revertedWith("Invalid range");
    });
  });

  async function getCurrentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
