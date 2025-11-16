import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Query, 
  Param, 
  UseGuards, 
  Request,
  NotFoundException 
} from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto } from './dto/doctor-response.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { AvailableSlotsResponseDto } from './dto/available-slots-response.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/common';

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

  @Get(':id/available-slots')
  async getAvailableSlots(
    @Param('id') id: string,
    @Query() query: AvailableSlotsQueryDto,
  ): Promise<AvailableSlotsResponseDto> {
    const slots = await this.doctorsService.getAvailableSlots(id, query.date);
    
    if (!slots) {
      throw new NotFoundException(`Doctor with ID ${id} not found or has no schedule configured`);
    }

    return slots;
  }

  // ==================== DOCTOR PROFILE MANAGEMENT ====================

  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async getMyProfile(@Request() req: any) {
    return this.doctorsService.getProfile(req.user.userId);
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async updateMyProfile(@Request() req: any, @Body() updateDto: UpdateProfileDto) {
    return this.doctorsService.updateProfile(req.user.userId, updateDto);
  }

  // ==================== SCHEDULE MANAGEMENT ====================

  @Post('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async createSchedule(@Request() req: any, @Body() createDto: CreateScheduleDto) {
    return this.doctorsService.createSchedule(req.user.userId, createDto);
  }

  @Get('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async getMySchedule(@Request() req: any) {
    return this.doctorsService.getSchedule(req.user.userId);
  }

  @Put('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async updateSchedule(@Request() req: any, @Body() updateDto: UpdateScheduleDto) {
    return this.doctorsService.updateSchedule(req.user.userId, updateDto);
  }

  @Delete('me/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async deleteSchedule(@Request() req: any) {
    await this.doctorsService.deleteSchedule(req.user.userId);
    return { message: 'Schedule deleted successfully' };
  }

  // ==================== TIME SLOT MANAGEMENT ====================

  @Post('me/time-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async createTimeSlot(@Request() req: any, @Body() createDto: CreateTimeSlotDto) {
    return this.doctorsService.createTimeSlot(req.user.userId, createDto);
  }

  @Post('me/time-slots/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async bulkCreateTimeSlots(@Request() req: any, @Body() slots: CreateTimeSlotDto[]) {
    return this.doctorsService.bulkCreateTimeSlots(req.user.userId, slots);
  }

  @Get('me/time-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async getMyTimeSlots(@Request() req: any) {
    return this.doctorsService.getTimeSlots(req.user.userId);
  }

  @Get('me/time-slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async getTimeSlot(@Request() req: any, @Param('slotId') slotId: string) {
    return this.doctorsService.getTimeSlot(slotId, req.user.userId);
  }

  @Put('me/time-slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async updateTimeSlot(
    @Request() req: any,
    @Param('slotId') slotId: string,
    @Body() updateDto: UpdateTimeSlotDto,
  ) {
    return this.doctorsService.updateTimeSlot(slotId, req.user.userId, updateDto);
  }

  @Delete('me/time-slots/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DOCTOR)
  async deleteTimeSlot(@Request() req: any, @Param('slotId') slotId: string) {
    await this.doctorsService.deleteTimeSlot(slotId, req.user.userId);
    return { message: 'Time slot deleted successfully' };
  }
}
