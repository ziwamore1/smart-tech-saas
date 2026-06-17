import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.smarttechsaas.com';

interface VerificationResult {
  documentId: string;
  documentType: string;
  schoolName: string;
  signatureValid: boolean;
  blockchainVerified: boolean;
  ministryVerified: boolean;
  approvalChainComplete: boolean;
  overallStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'INVALID';
  verificationDetails: {
    signature: any;
    blockchain: any;
    ministry: any;
    approvals: any;
  };
  verifiedAt: string;
}

class VerificationService {
  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('authToken');
  }

  private async getHeaders() {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async verifyCertificate(token: string): Promise<VerificationResult | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/certificate-validation/verify/${token}`,
        { headers: await this.getHeaders() }
      );

      if (response.data.success) {
        return response.data.verification;
      }
      return null;
    } catch (error: any) {
      console.error('Verification failed:', error.message);
      throw new Error(error.response?.data?.message || 'Verification failed');
    }
  }

  async verifyByDocumentId(documentId: string): Promise<VerificationResult | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/certificate-validation/document/${documentId}`,
        { headers: await this.getHeaders() }
      );

      if (response.data.success) {
        return response.data.verification;
      }
      return null;
    } catch (error: any) {
      console.error('Verification failed:', error.message);
      throw new Error(error.response?.data?.message || 'Verification failed');
    }
  }

  async verifyBlockchain(transactionHash: string, network: string = 'POLYGON'): Promise<{ verified: boolean; network: string }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/blockchain/verify/${transactionHash}`,
        {
          headers: await this.getHeaders(),
          data: { network },
        }
      );

      return {
        verified: response.data.verified,
        network: response.data.network,
      };
    } catch (error: any) {
      console.error('Blockchain verification failed:', error.message);
      throw new Error(error.response?.data?.message || 'Blockchain verification failed');
    }
  }

  async getVerificationStats(schoolId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/certificate-validation/stats/${schoolId}`,
        { headers: await this.getHeaders() }
      );

      return response.data.stats;
    } catch (error: any) {
      console.error('Failed to get stats:', error.message);
      return null;
    }
  }

  parseQRCode(qrData: string): string | null {
    try {
      const url = new URL(qrData);
      const pathParts = url.pathname.split('/');
      const token = pathParts[pathParts.length - 1];
      return token || null;
    } catch {
      if (qrData.length === 36) {
        return qrData;
      }
      return null;
    }
  }
}

export const verificationService = new VerificationService();
export type { VerificationResult };
