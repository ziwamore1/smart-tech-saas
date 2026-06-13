import { Controller, Post, Get, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('blockchain')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  private readonly logger = new Logger(BlockchainController.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  @Post('certify')
  async certifyDocument(@Body() body: any) {
    const { documentId, documentSignatureId, certificateHash, schoolId, network } = body;

    const result = await this.blockchainService.certifyDocument({
      documentId,
      documentSignatureId,
      certificateHash,
      schoolId,
      network,
    });

    return {
      success: true,
      blockchain: result,
    };
  }

  @Get('verify/:transactionHash')
  async verifyBlockchain(@Param('transactionHash') transactionHash: string, @Body() body: any) {
    const network = body?.network || 'POLYGON';
    const isValid = await this.blockchainService.verifyOnBlockchain(transactionHash, network);

    return {
      success: true,
      verified: isValid,
      transactionHash,
      network,
    };
  }

  @Get('document/:documentId')
  async getDocumentCertificate(@Param('documentId') documentId: string) {
    const certificate = await this.blockchainService.getBlockchainCertificate(documentId);

    return {
      success: true,
      certificate,
    };
  }

  @Get('all')
  async getAllCertificates() {
    const certificates = await this.blockchainService.getAllCertificates();

    return {
      success: true,
      certificates,
    };
  }

  @Get('school/:schoolId')
  async getSchoolCertificates(@Param('schoolId') schoolId: string) {
    const certificates = await this.blockchainService.getAllBlockchainCertificates(schoolId);

    return {
      success: true,
      certificates,
    };
  }

  @Post('generate-hash')
  async generateHash(@Body() body: any) {
    const { documentId, metadata } = body;
    const hash = this.blockchainService.generateCertificateHash(documentId, metadata || {});

    return {
      success: true,
      hash,
    };
  }
}
