import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { CapabilityGuard } from '../auth/guard/capability.guard';
import { RequireCapability } from '../auth/decorator/requireCapability.decorator';
import { GetUser } from '../auth/decorator/getUser.decorator';
import { UploadLimitRequestService } from './upload-limit-request.service';
import { UserSevice } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/users')
@RequireCapability('uploadLimits.manage')
@UseGuards(JwtGuard, CapabilityGuard)
export class AdminUploadLimitRequestController {
  constructor(
    private uploadLimitRequestService: UploadLimitRequestService,
    private prisma: PrismaService,
  ) {}

  @Get('upload-limit-requests')
  async getAllPendingRequests() {
    const requests = await this.uploadLimitRequestService.getAllPendingRequests();

    return requests.map((request) => {
      const currentLimitBytes = request.user.maxFileSizeOverride || BigInt(0);
      const currentLimitGB = Number(currentLimitBytes) / (1024 * 1024 * 1024);
      const requestedLimitGB = Number(request.requestedLimit) / (1024 * 1024 * 1024);

      return {
        userId: request.user.id,
        username: request.user.username,
        email: request.user.email,
        currentLimit: Math.round(currentLimitGB),
        requestedLimit: Math.round(requestedLimitGB),
        reason: request.reason,
        createdAt: request.createdAt,
      };
    });
  }

  @Post(':userId/upload-limit-request/approve')
  async approveRequest(
    @Param('userId') userId: string,
    @GetUser() admin: any,
  ) {
    const result = await this.uploadLimitRequestService.approveRequest(
      userId,
      admin.id,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        maxFileSizeOverride: result.newLimit,
      },
    });

    const newLimitGB = Number(result.newLimit) / (1024 * 1024 * 1024);

    return {
      success: true,
      message: 'Request approved successfully',
      newLimit: Math.round(newLimitGB),
    };
  }

  @Post(':userId/upload-limit-request/decline')
  async declineRequest(
    @Param('userId') userId: string,
    @GetUser() admin: any,
  ) {
    await this.uploadLimitRequestService.declineRequest(userId, admin.id);

    return {
      success: true,
      message: 'Request declined successfully',
    };
  }
}
