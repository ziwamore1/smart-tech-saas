import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { DigitalSignatureService } from './digital-signature.service';

describe('DigitalSignatureService handwriting extraction', () => {
  const prisma = {
    digitalSignature: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(async ({ data }: any) => data),
    },
  } as any;
  const cloudinary = {
    uploadBuffer: jest.fn(async () => ({ secureUrl: '', publicId: '' })),
    delete: jest.fn(),
  } as any;

  beforeEach(() => jest.clearAllMocks());

  it('rejects a signature without visual source artwork', async () => {
    const service = new DigitalSignatureService(prisma, cloudinary);
    await expect(service.createSignature('school-1', { name: 'Principal' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('extracts ink into a cropped transparent PNG and preserves the original', async () => {
    const source = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#ffffff' } })
      .composite([{ input: Buffer.from('<svg width="120" height="80"><path d="M15 45 C35 10 60 70 105 30" fill="none" stroke="#111" stroke-width="4"/></svg>') }])
      .png().toBuffer();
    const result = await new DigitalSignatureService(prisma, cloudinary).createSignature('school-1', {
      name: 'Principal', signatureData: `data:image/png;base64,${source.toString('base64')}`, isDefault: true,
    });
    const processed = await sharp(Buffer.from(result.signatureData.split(',')[1], 'base64')).metadata();
    expect(result.originalImageUrl).toContain('data:image/png;base64,');
    expect(result.processingVersion).toBe('v2');
    expect(processed.hasAlpha).toBe(true);
    expect(processed.width).toBeLessThan(120);
    expect(processed.height).toBeLessThan(80);
  });
});
