import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { JwtGuard } from "../auth/guard/jwt.guard";
import { GetUser } from "../auth/decorator/getUser.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users")
export class UserThemeController {
  constructor(private prisma: PrismaService) {}

  @Get("me/theme")
  @UseGuards(JwtGuard)
  async getTheme(@GetUser() user: { id: string }) {
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { theme: true },
    });

    return { theme: userData?.theme || "dark" };
  }

  @Patch("me/theme")
  @UseGuards(JwtGuard)
  async updateTheme(
    @GetUser() user: { id: string },
    @Body() body: { theme: string },
  ) {
    if (!body.theme || !["dark", "light"].includes(body.theme)) {
      throw new BadRequestException("Theme must be 'dark' or 'light'");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { theme: body.theme },
    });

    return { success: true, theme: body.theme };
  }
}
