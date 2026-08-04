import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { GetUser } from '../auth/decorator/getUser.decorator';
import { UploadLimitRequestService } from './upload-limit-request.service';
import { CreateUploadLimitRequestDto } from './upload-limit-request.dto';

@Controller('user/upload-limit-request')
@UseGuards(JwtGuard)
export class UserUploadLimitRequestController {
  constructor(
    private uploadLimitRequestService: UploadLimitRequestService,
  ) {}

  @Get()
  async getCurrentRequest(@GetUser() user: any) {
    const request = await this.uploadLimitRequestService.getCurrentUserRequest(
      user.id,
    );

    if (!request) {
      return null;
    }

    const requestedLimitGB = Number(request.requestedLimit) / (1024 * 1024 * 1024);

    return {
      requestedLimit: Math.round(requestedLimitGB),
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  @Post()
  async createRequest(
    @GetUser() user: any,
    @Body() dto: CreateUploadLimitRequestDto,
  ) {
    await this.uploadLimitRequestService.createRequest(user.id, dto);

    return {
      success: true,
      message: 'Upload limit request submitted successfully',
    };
  }

  @Delete()
  async cancelRequest(@GetUser() user: any) {
    await this.uploadLimitRequestService.cancelRequest(user.id);

    return {
      success: true,
      message: 'Request cancelled successfully',
    };
  }
}
