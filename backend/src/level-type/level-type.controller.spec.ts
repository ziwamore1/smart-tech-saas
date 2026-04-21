import { Test, TestingModule } from '@nestjs/testing';
import { LevelTypeController } from './level-type.controller';

describe('LevelTypeController', () => {
  let controller: LevelTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LevelTypeController],
    }).compile();

    controller = module.get<LevelTypeController>(LevelTypeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
