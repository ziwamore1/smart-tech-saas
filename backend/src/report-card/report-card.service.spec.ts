import { Test, TestingModule } from '@nestjs/testing';
import { ReportCardService } from './report-card.service';

describe('ReportCardService', () => {
  let service: ReportCardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportCardService],
    }).compile();

    service = module.get<ReportCardService>(ReportCardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
