import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ConfigService } from "src/config/config.service";
import { CreateReverseShareDTO } from "./dto/createReverseShare.dto";
import { ReverseShareDTO } from "./dto/reverseShare.dto";
import { ReverseShareTokenWithShares } from "./dto/reverseShareTokenWithShares";
import { ReverseShareOwnerGuard } from "./guards/reverseShareOwner.guard";
import { ReverseShareService } from "./reverseShare.service";

@Controller("reverseShares")
export class ReverseShareController {
  constructor(
    private reverseShareService: ReverseShareService,
    private config: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  async create(@Body() body: CreateReverseShareDTO, @GetUser() user: User) {
    if (!this.config.get("share.allowReverseShares"))
      throw new ForbiddenException("Reverse shares are disabled");

    const token = await this.reverseShareService.create(body, user.id);

    const link = `${this.config.get("general.appUrl")}/upload/${token}`;

    return { token, link };
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60,
    },
  })
  @Get(":reverseShareToken")
  async getByToken(@Param("reverseShareToken") reverseShareToken: string) {
    const status = await this.reverseShareService.getStatus(reverseShareToken);

    if (status !== "valid") {
      throw new NotFoundException({
        statusCode: 404,
        error: "Not Found",
        message: "Reverse share token not found",
        reason: status,
      });
    }

    return new ReverseShareDTO().from(
      await this.reverseShareService.getByToken(reverseShareToken),
    );
  }

  @Get()
  @UseGuards(JwtGuard)
  async getAllByUser(@GetUser() user: User) {
    return new ReverseShareTokenWithShares().fromList(
      await this.reverseShareService.getAllByUser(user.id),
    );
  }

  @Delete(":reverseShareId")
  @UseGuards(JwtGuard, ReverseShareOwnerGuard)
  async remove(@Param("reverseShareId") id: string) {
    await this.reverseShareService.remove(id);
  }
}
