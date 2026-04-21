import { Test, TestingModule } from '@nestjs/testing';
import { ReportCardController } from './report-card.controller';

describe('ReportCardController', () => {
  let controller: ReportCardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportCardController],
    }).compile();

    controller = module.get<ReportCardController>(ReportCardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
