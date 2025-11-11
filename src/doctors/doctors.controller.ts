import { Controller, Get, Query, Param, NotFoundException } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto } from './dto/doctor-response.dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  async findAll(@Query() query: DoctorQueryDto): Promise<DoctorResponseDto[]> {
    return this.doctorsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DoctorResponseDto> {
    const doctor = await this.doctorsService.findOne(id);
    
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }
}
