import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { NotFoundException } from '@nestjs/common';

describe('StudentController', () => {
  let controller: StudentController;
  let service: jest.Mocked<StudentService>;

  const mockUpdateResult = {
    id: 'student-1',
    firstName: 'John',
    lastName: 'Doe',
    admissionNumber: 'ADM001',
    gender: 'MALE',
    dateOfBirth: new Date('2010-01-01'),
    schoolId: 'school-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      enroll: jest.fn(),
      promoteStudent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        { provide: StudentService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<StudentController>(StudentController);
    service = module.get(StudentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('PATCH update', () => {
    it('should update a student successfully', async () => {
      const updateDto = { firstName: 'Jane', lastName: 'Smith' };
      service.update.mockResolvedValue({ ...mockUpdateResult, ...updateDto });

      const result = controller.update('student-1', updateDto);

      expect(service.update).toHaveBeenCalledWith('student-1', updateDto);
      expect(result).toEqual({ ...mockUpdateResult, ...updateDto });
    });

    it('should throw NotFoundException when student not found', async () => {
      service.update.mockRejectedValue(new NotFoundException('Student not found'));

      await expect(controller.update('invalid-id', {})).rejects.toThrow(NotFoundException);
    });
  });
});