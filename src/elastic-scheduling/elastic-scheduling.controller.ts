import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import { ExpandSessionDto } from './dto/expand-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('doctors/:doctorId/sessions/:date')
@UseGuards(JwtAuthGuard)
export class ElasticSchedulingController {
  constructor(
    private readonly elasticSchedulingService: ElasticSchedulingService,
  ) {}

  @Post('expand-start')
  async expandStartTime(
    @Param('doctorId') doctorId: string,
    @Param('date') date: string,
    @Body() dto: ExpandSessionDto,
  ) {
    // Validate that newStartTime is provided
    if (!dto.newStartTime) {
      throw new BadRequestException('newStartTime is required');
    }

    // Validate date format
    this.validateDate(date);

    return await this.elasticSchedulingService.expandStartTimeWave(
      doctorId,
      date,
      dto.newStartTime,
      dto.reason,
    );
  }

  @Post('expand-end')
  async expandEndTime(
    @Param('doctorId') doctorId: string,
    @Param('date') date: string,
    @Body() dto: ExpandSessionDto,
  ) {
    // Validate that newEndTime is provided
    if (!dto.newEndTime) {
      throw new BadRequestException('newEndTime is required');
    }

    // Validate date format
    this.validateDate(date);

    // Phase 1: Only Wave scheduling is supported
    return await this.elasticSchedulingService.expandEndTimeWave(
      doctorId,
      date,
      dto.newEndTime,
      dto.reason,
    );

  }

  private validateDate(dateString: string): void {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new BadRequestException('Cannot adjust sessions for past dates');
    }
  }
}
