import { Test, TestingModule } from '@nestjs/testing';
import { TeachingAssignmentService } from './teaching-assignment.service';

describe('TeachingAssignmentService', () => {
  let service: TeachingAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeachingAssignmentService],
    }).compile();

    service = module.get<TeachingAssignmentService>(TeachingAssignmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
