import { Test, TestingModule } from '@nestjs/testing';
import { ConstraintsService } from './constraints.service';

describe('ConstraintsService', () => {
  let service: ConstraintsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConstraintsService],
    }).compile();

    service = module.get<ConstraintsService>(ConstraintsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
