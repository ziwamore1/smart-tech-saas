import { Test, TestingModule } from '@nestjs/testing';
import { LevelTypeService } from './level-type.service';

describe('LevelTypeService', () => {
  let service: LevelTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LevelTypeService],
    }).compile();

    service = module.get<LevelTypeService>(LevelTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
