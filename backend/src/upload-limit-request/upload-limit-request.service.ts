import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUploadLimitRequestDto } from './upload-limit-request.dto';

@Injectable()
export class UploadLimitRequestService {
  constructor(private prisma: PrismaService) {}

  async getCurrentUserRequest(userId: string) {
    return this.prisma.uploadLimitRequest.findFirst({
      where: {
        userId,
        status: 'pending',
      },
    });
  }

  async createRequest(userId: string, dto: CreateUploadLimitRequestDto) {
    const existingRequest = await this.getCurrentUserRequest(userId);
    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending upload limit request',
      );
    }

    const requestedLimitBytes = BigInt(dto.requestedLimit) * BigInt(1024 * 1024 * 1024);

    return this.prisma.uploadLimitRequest.create({
      data: {
        userId,
        requestedLimit: requestedLimitBytes,
        reason: dto.reason,
        status: 'pending',
      },
    });
  }

  async cancelRequest(userId: string): Promise<void> {
    const request = await this.getCurrentUserRequest(userId);
    if (!request) {
      throw new NotFoundException('No pending request found');
    }

    await this.prisma.uploadLimitRequest.delete({
      where: { id: request.id },
    });
  }

  async getAllPendingRequests() {
    return this.prisma.uploadLimitRequest.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            maxFileSizeOverride: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUserRequest(userId: string) {
    return this.prisma.uploadLimitRequest.findFirst({
      where: {
        userId,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            maxFileSizeOverride: true,
          },
        },
      },
    });
  }

  async approveRequest(
    userId: string,
    adminId: string,
  ): Promise<{ success: boolean; newLimit: bigint }> {
    const request = await this.getUserRequest(userId);
    if (!request) {
      throw new NotFoundException('No pending request found for this user');
    }

    await this.prisma.uploadLimitRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminId,
      },
    });

    return {
      success: true,
      newLimit: request.requestedLimit,
    };
  }

  async declineRequest(userId: string, adminId: string): Promise<void> {
    const request = await this.getUserRequest(userId);
    if (!request) {
      throw new NotFoundException('No pending request found for this user');
    }

    await this.prisma.uploadLimitRequest.update({
      where: { id: request.id },
      data: {
        status: 'declined',
        processedAt: new Date(),
        processedBy: adminId,
      },
    });
  }
}
