import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ethers } from 'ethers';
import * as crypto from 'crypto';

const CERTIFICATE_VERIFICATION_ABI = [
  'function registerCertificate(bytes32 _certificateHash, string calldata _metadata) external',
  'function verifyCertificate(bytes32 _certificateHash) external view returns (bool exists, bool valid, uint256 registeredAt)',
  'function getCertificateRecord(bytes32 _certificateHash) external view returns (bytes32 certificateHash, address registrant, uint256 registeredAt, string metadata, bool revoked, address revokedBy, uint256 revokedAt)',
  'function revokeCertificate(bytes32 _certificateHash) external',
  'function getTotalCertificates() external view returns (uint256 count)',
  'function isRegistered(bytes32 _certificateHash) external view returns (bool)',
  'event CertificateRegistered(bytes32 certificateHash, address registrant, uint256 timestamp, string metadata)',
  'event CertificateRevoked(bytes32 certificateHash, address revoker, uint256 timestamp)',
];

export interface BlockchainCertifyInput {
  documentId: string;
  documentSignatureId: string;
  certificateHash: string;
  schoolId: string;
  network?: string;
  metadata?: Record<string, any>;
}

export interface BlockchainVerificationResult {
  transactionHash: string;
  blockNumber: number;
  verificationUrl: string;
  network: string;
  exists: boolean;
  valid: boolean;
  registeredAt?: Date;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
  private readonly PRIVATE_KEY = process.env.PRIVATE_KEY || '';

  private readonly NETWORKS = {
    POLYGON: {
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      chainId: 137,
      explorerUrl: 'https://polygonscan.com',
    },
    POLYGON_AMOY: {
      rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      explorerUrl: 'https://amoy.polygonscan.com',
    },
    ETHEREUM: {
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
      chainId: 1,
      explorerUrl: 'https://etherscan.io',
    },
  };

  constructor(private prisma: PrismaService) {}

  generateCertificateHash(documentId: string, metadata: Record<string, any>): string {
    const hashInput = JSON.stringify({
      documentId,
      metadata,
      timestamp: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
    });

    return '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private getProvider(network: string): ethers.JsonRpcProvider {
    const networkConfig = this.NETWORKS[network as keyof typeof this.NETWORKS];

    if (!networkConfig) {
      throw new Error(`Unsupported network: ${network}`);
    }

    return new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  }

  private getContract(network: string, signer?: ethers.Wallet): ethers.Contract {
    const provider = this.getProvider(network);
    const contractSigner = signer || new ethers.Wallet(this.PRIVATE_KEY, provider);

    return new ethers.Contract(this.CONTRACT_ADDRESS, CERTIFICATE_VERIFICATION_ABI, contractSigner);
  }

  async storeHashOnBlockchain(
    hash: string,
    metadata: string = '{}',
    network: string = 'POLYGON_AMOY',
  ): Promise<{ transactionHash: string; blockNumber: number }> {
    this.logger.log(`Storing hash on ${network} blockchain: ${hash}`);

    if (!this.CONTRACT_ADDRESS || !this.PRIVATE_KEY || this.PRIVATE_KEY.startsWith('0x000')) {
      this.logger.warn('Blockchain not configured. Using mock transaction for development.');

      return {
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 10000000),
      };
    }

    try {
      const contract = this.getContract(network);

      const tx = await contract.registerCertificate(hash, metadata);
      const receipt = await tx.wait();

      this.logger.log(`Hash stored successfully. TX: ${receipt.hash}, Block: ${receipt.blockNumber}`);

      return {
        transactionHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      this.logger.error(`Failed to store hash on blockchain: ${error.message}`);
      throw new Error(`Blockchain registration failed: ${error.message}`);
    }
  }

  async verifyOnBlockchain(
    hash: string,
    network: string = 'POLYGON_AMOY',
  ): Promise<{ exists: boolean; valid: boolean; registeredAt: Date | null }> {
    this.logger.log(`Verifying hash on ${network} blockchain: ${hash}`);

    if (!this.CONTRACT_ADDRESS || !this.PRIVATE_KEY || this.PRIVATE_KEY.startsWith('0x000')) {
      this.logger.warn('Blockchain not configured. Checking local database only.');

      const localRecord = await this.prisma.blockchainCertificate.findFirst({
        where: { certificateHash: hash },
      });

      return {
        exists: !!localRecord,
        valid: !!localRecord,
        registeredAt: localRecord?.createdAt || null,
      };
    }

    try {
      const contract = this.getContract(network);
      const [exists, valid, registeredAt] = await contract.verifyCertificate(hash);

      return {
        exists,
        valid,
        registeredAt: registeredAt > 0 ? new Date(Number(registeredAt) * 1000) : null,
      };
    } catch (error) {
      this.logger.error(`Blockchain verification failed: ${error.message}`);
      throw new Error(`Blockchain verification failed: ${error.message}`);
    }
  }

  async revokeOnBlockchain(
    hash: string,
    network: string = 'POLYGON_AMOY',
  ): Promise<{ transactionHash: string; blockNumber: number }> {
    this.logger.log(`Revoking hash on ${network} blockchain: ${hash}`);

    if (!this.CONTRACT_ADDRESS || !this.PRIVATE_KEY || this.PRIVATE_KEY.startsWith('0x000')) {
      this.logger.warn('Blockchain not configured. Skipping on-chain revocation.');

      return {
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        blockNumber: Math.floor(Math.random() * 10000000),
      };
    }

    try {
      const contract = this.getContract(network);

      const tx = await contract.revokeCertificate(hash);
      const receipt = await tx.wait();

      this.logger.log(`Hash revoked successfully. TX: ${receipt.hash}, Block: ${receipt.blockNumber}`);

      return {
        transactionHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      this.logger.error(`Failed to revoke hash on blockchain: ${error.message}`);
      throw new Error(`Blockchain revocation failed: ${error.message}`);
    }
  }

  async certifyDocument(input: BlockchainCertifyInput): Promise<BlockchainVerificationResult> {
    this.logger.log(`Certifying document on blockchain: ${input.documentId}`);

    const network = input.network || 'POLYGON_AMOY';
    const metadata = JSON.stringify({
      documentId: input.documentId,
      schoolId: input.schoolId,
      documentSignatureId: input.documentSignatureId,
      certifiedAt: new Date().toISOString(),
      ...input.metadata,
    });

    const blockchainResult = await this.storeHashOnBlockchain(
      input.certificateHash,
      metadata,
      network,
    );

    const networkConfig = this.NETWORKS[network as keyof typeof this.NETWORKS];
    const verificationUrl = `${networkConfig.explorerUrl}/tx/${blockchainResult.transactionHash}`;

    const blockchainCertificate = await this.prisma.blockchainCertificate.create({
      data: {
        documentId: input.documentId,
        documentSignatureId: input.documentSignatureId,
        certificateHash: input.certificateHash,
        blockchainNetwork: network,
        transactionHash: blockchainResult.transactionHash,
        smartContract: this.CONTRACT_ADDRESS || 'development-mode',
        verificationUrl,
        metadata: {
          blockNumber: blockchainResult.blockNumber,
          certifiedAt: new Date().toISOString(),
          network,
          contractAddress: this.CONTRACT_ADDRESS,
        },
      },
    });

    await this.prisma.documentSignature.update({
      where: { id: input.documentSignatureId },
      data: {
        blockchainHash: blockchainCertificate.transactionHash,
      },
    });

    this.logger.log(`Document certified on blockchain. TX: ${blockchainResult.transactionHash}`);

    return {
      transactionHash: blockchainResult.transactionHash,
      blockNumber: blockchainResult.blockNumber,
      verificationUrl,
      network,
      exists: true,
      valid: true,
      registeredAt: new Date(),
    };
  }

  async getBlockchainCertificate(documentId: string): Promise<any> {
    return this.prisma.blockchainCertificate.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllBlockchainCertificates(schoolId: string): Promise<any[]> {
    return this.prisma.blockchainCertificate.findMany({
      where: {
        documentSignature: {
          schoolId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllCertificates(): Promise<any[]> {
    return this.prisma.blockchainCertificate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTotalRegistered(network: string = 'POLYGON_AMOY'): Promise<number> {
    if (!this.CONTRACT_ADDRESS || !this.PRIVATE_KEY || this.PRIVATE_KEY.startsWith('0x000')) {
      return this.prisma.blockchainCertificate.count();
    }

    try {
      const contract = this.getContract(network);
      const total = await contract.getTotalCertificates();
      return Number(total);
    } catch (error) {
      this.logger.error(`Failed to get total certificates: ${error.message}`);
      return this.prisma.blockchainCertificate.count();
    }
  }

  getExplorerUrl(network: string, transactionHash: string): string {
    const networkConfig = this.NETWORKS[network as keyof typeof this.NETWORKS];
    return `${networkConfig.explorerUrl}/tx/${transactionHash}`;
  }
}
