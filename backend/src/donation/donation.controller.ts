import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { Request } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { CapabilityGuard } from "src/auth/guard/capability.guard";
import { RequireCapability } from "src/auth/decorator/requireCapability.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CreateDonationIntentDto, UpdateDonationStatusDto } from "./donation.dto";
import { DonationService } from "./donation.service";

@Controller("donations")
export class DonationController {
  constructor(private donationService: DonationService) {}

  @Get("groups/:groupId/summary")
  @UseGuards(JwtGuard)
  async getGroupSummary(
    @GetUser() user: User,
    @Param("groupId") groupId: string,
    @Req() request: Request,
  ) {
    return await this.donationService.getGroupSummary(groupId, user, request);
  }

  @Post("groups/:groupId/intents")
  @UseGuards(JwtGuard)
  async createIntent(
    @GetUser() user: User,
    @Param("groupId") groupId: string,
    @Body() dto: CreateDonationIntentDto,
    @Req() request: Request,
  ) {
    return await this.donationService.createIntent(groupId, user, dto, request);
  }

  @Post("webhooks/btcpay")
  async handleBtcpayWebhook(@Req() request: Request & { rawBody?: Buffer }, @Body() body: any) {
    return await this.donationService.handleBtcpayWebhook(request, body);
  }

  @Get("webhooks/btcpay")
  async checkBtcpayWebhook() {
    return { ok: true };
  }

  @Get("admin")
  @RequireCapability("donations.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async listAdminDonations() {
    return await this.donationService.listAdminDonations();
  }

  @Patch("admin/:id")
  @RequireCapability("donations.manage")
  @UseGuards(JwtGuard, CapabilityGuard)
  async updateAdminDonation(
    @Param("id") id: string,
    @Body() dto: UpdateDonationStatusDto,
  ) {
    return await this.donationService.updateAdminDonation(id, dto);
  }
}
