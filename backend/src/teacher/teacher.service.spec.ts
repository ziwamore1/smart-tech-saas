import { Test, TestingModule } from '@nestjs/testing';
import { TeacherService } from './teacher.service';
import { ClassAccessService } from '../common/access/class-access.service';

describe('TeacherService', () => {
  let service: TeacherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        { provide: ClassAccessService, useValue: { canAccessClasses: jest.fn(), getPermissions: jest.fn() } },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
