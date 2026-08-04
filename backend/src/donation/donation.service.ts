import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import * as crypto from "crypto";
import { Request } from "express";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateDonationIntentDto, UpdateDonationStatusDto } from "./donation.dto";

const GIB = 1024 ** 3;
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;
const RATE_CACHE_TTL = 6 * 60 * 60 * 1000;
const EURO_COUNTRIES = new Set([
  "AT",
  "BE",
  "HR",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
]);
const COUNTRY_CURRENCY: Record<string, string> = {
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  DK: "DKK",
  GB: "GBP",
  JP: "JPY",
  NO: "NOK",
  SE: "SEK",
  US: "USD",
};
const FALLBACK_USD_RATES: Record<string, number> = {
  AUD: 1.53,
  CAD: 1.37,
  CHF: 0.91,
  DKK: 6.95,
  EUR: 0.93,
  GBP: 0.8,
  JPY: 155,
  NOK: 10.8,
  SEK: 10.6,
  USD: 1,
};

@Injectable()
export class DonationService {
  private geoCache = new Map<string, { countryCode?: string; timestamp: number }>();
  private rateCache = new Map<string, { rate: number; timestamp: number }>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private parseStorageCost(): number {
    const value = Number.parseFloat(
      this.config.get("donations.storageCostPerGibMonthUsd") || "0",
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private parseServerCost(): number {
    const value = Number.parseFloat(
      this.config.get("donations.serverCostPerMonthUsd") || "0",
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private getWalletAddress(): string {
    return (this.config.get("donations.btcAddress") || "").trim();
  }

  private getBtcpayConfig() {
    const serverUrl = (this.config.get("donations.btcpayServerUrl") || "").trim().replace(/\/+$/, "");
    const storeId = (this.config.get("donations.btcpayStoreId") || "").trim();
    const apiKey = (this.config.get("donations.btcpayApiKey") || "").trim();
    const webhookSecret = (this.config.get("donations.btcpayWebhookSecret") || "").trim();
    const expirationMinutes = Math.max(
      5,
      Number(this.config.get("donations.btcpayInvoiceExpirationMinutes") || 30),
    );

    return {
      serverUrl,
      storeId,
      apiKey,
      webhookSecret,
      expirationMinutes,
      enabled: Boolean(serverUrl && storeId && apiKey),
    };
  }

  private getAppUrl() {
    return (this.config.get("general.appUrl") || "http://localhost:3000").replace(/\/+$/, "");
  }

  private getClientIp(request: Request): string {
    const cfConnectingIp = request.headers["cf-connecting-ip"];
    const xForwardedFor = request.headers["x-forwarded-for"];
    const xRealIp = request.headers["x-real-ip"];

    if (typeof cfConnectingIp === "string") return cfConnectingIp;
    if (xForwardedFor) {
      return (typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0])
        .split(",")[0]
        .trim();
    }
    if (typeof xRealIp === "string") return xRealIp;

    return request.ip || request.socket.remoteAddress || "";
  }

  private isPrivateIp(ip: string): boolean {
    const normalized = ip.trim().replace(/^::ffff:/i, "");
    return (
      !normalized ||
      normalized === "127.0.0.1" ||
      normalized === "::1" ||
      normalized.startsWith("10.") ||
      normalized.startsWith("192.168.") ||
      normalized.startsWith("172.")
    );
  }

  private async getCountryCode(request: Request): Promise<string | undefined> {
    const headerCountry =
      request.headers["cf-ipcountry"] ||
      request.headers["x-vercel-ip-country"] ||
      request.headers["x-country-code"];

    if (typeof headerCountry === "string" && headerCountry.length === 2) {
      return headerCountry.toUpperCase();
    }

    const ip = this.getClientIp(request);
    if (this.isPrivateIp(ip)) return undefined;

    const cached = this.geoCache.get(ip);
    if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
      return cached.countryCode;
    }

    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`);
      const data = (await response.json()) as {
        status: string;
        countryCode?: string;
      };
      const countryCode =
        data.status === "success" && data.countryCode
          ? data.countryCode.toUpperCase()
          : undefined;
      this.geoCache.set(ip, { countryCode, timestamp: Date.now() });
      return countryCode;
    } catch {
      return undefined;
    }
  }

  private getCurrencyForCountry(countryCode?: string): string {
    if (!countryCode) return "USD";
    if (EURO_COUNTRIES.has(countryCode)) return "EUR";
    return COUNTRY_CURRENCY[countryCode] || "USD";
  }

  private async getUsdRate(currency: string): Promise<number> {
    if (currency === "USD") return 1;

    const cached = this.rateCache.get(currency);
    if (cached && Date.now() - cached.timestamp < RATE_CACHE_TTL) {
      return cached.rate;
    }

    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
      const data = (await response.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[currency];
      if (Number.isFinite(rate) && rate > 0) {
        this.rateCache.set(currency, { rate, timestamp: Date.now() });
        return rate;
      }
    } catch {
    }

    return FALLBACK_USD_RATES[currency] || 1;
  }

  private async getFiatDisplay(request: Request) {
    const countryCode = await this.getCountryCode(request);
    const currency = this.getCurrencyForCountry(countryCode);
    const conversionRateFromUsd = await this.getUsdRate(currency);

    return {
      countryCode,
      currency,
      conversionRateFromUsd,
    };
  }

  private async ensureGroupAccess(groupId: string, user: User) {
    const group = await this.prisma.userGroup.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    if (!group) {
      throw new NotFoundException("Group not found");
    }

    if (!user.isAdmin && group.memberships.length === 0) {
      throw new ForbiddenException("You do not have access to this group");
    }

    return group;
  }

  async getGroupSummary(groupId: string, user: User, request: Request) {
    const group = await this.ensureGroupAccess(groupId, user);
    const fiat = await this.getFiatDisplay(request);
    const files = await this.prisma.file.findMany({
      where: {
        share: {
          groupId,
        },
      },
      select: {
        size: true,
      },
    });

    const storageBytes = files.reduce((total, file) => {
      const size = Number.parseInt(file.size, 10);
      return total + (Number.isFinite(size) ? size : 0);
    }, 0);
    const storageGib = storageBytes / GIB;
    const storageCostPerGibMonthUsd = this.parseStorageCost();
    const serverCostPerMonthUsd = this.parseServerCost();
    const estimatedMonthlyUsd = storageGib * storageCostPerGibMonthUsd;

    const confirmed = await this.prisma.groupDonation.aggregate({
      where: {
        groupId,
        status: "confirmed",
      },
      _sum: {
        amountUsd: true,
      },
    });

    const donatedUsdAllTime = confirmed._sum.amountUsd ?? 0;
    const btcAddress = this.getWalletAddress();
    const btcpay = this.getBtcpayConfig();
    const provider = this.config.get("donations.provider") || "btcpay";

    // Only http(s): an admin-supplied link is rendered as an anchor, so a
    // javascript: value here would be stored XSS against every group member.
    const rawExternalUrl = (this.config.get("donations.externalUrl") || "").trim();
    const externalUrl = /^https?:\/\//i.test(rawExternalUrl) ? rawExternalUrl : "";

    return {
      enabled: this.config.get("donations.enabled"),
      provider,
      groupId: group.id,
      groupName: group.name,
      storageBytes,
      storageGib,
      storageCostPerGibMonthUsd,
      serverCostPerMonthUsd,
      estimatedMonthlyUsd,
      donatedUsdAllTime,
      displayCurrency: fiat.currency,
      displayCountryCode: fiat.countryCode,
      conversionRateFromUsd: fiat.conversionRateFromUsd,
      storageCostPerGibMonthDisplay:
        storageCostPerGibMonthUsd * fiat.conversionRateFromUsd,
      serverCostPerMonthDisplay:
        serverCostPerMonthUsd * fiat.conversionRateFromUsd,
      estimatedMonthlyDisplay: estimatedMonthlyUsd * fiat.conversionRateFromUsd,
      donatedDisplayAllTime: donatedUsdAllTime * fiat.conversionRateFromUsd,
      donationNote: this.config.get("donations.note") || "",
      btcAddress,
      btcpayEnabled: btcpay.enabled,
      btcEnabled: provider === "btcpay" ? btcpay.enabled : Boolean(btcAddress),
      externalUrl,
      externalLabel:
        this.config.get("donations.externalLabel") || "Donate via PayPal",
    };
  }

  private async createBtcpayInvoice(input: {
    donationId: string;
    groupId: string;
    groupName: string;
    userId: string;
    username: string;
    amount: number;
    currency: string;
  }) {
    const btcpay = this.getBtcpayConfig();
    if (!btcpay.enabled) {
      throw new BadRequestException("BTCPay is not configured");
    }

    const response = await fetch(
      `${btcpay.serverUrl}/api/v1/stores/${encodeURIComponent(btcpay.storeId)}/invoices`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${btcpay.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(input.amount.toFixed(2)),
          currency: input.currency,
          metadata: {
            orderId: input.donationId,
            donationId: input.donationId,
            groupId: input.groupId,
            groupName: input.groupName,
            userId: input.userId,
            username: input.username,
            itemDesc: `${this.config.get("general.appName") || "Group"} donation for ${input.groupName}`,
          },
          checkout: {
            expirationMinutes: btcpay.expirationMinutes,
            redirectURL: `${this.getAppUrl()}/account/group-shares`,
            redirectAutomatically: false,
          },
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      checkoutLink?: string;
      message?: string;
    };

    if (!response.ok || !data.id || !data.checkoutLink) {
      throw new BadRequestException(
        data.message || "Unable to create BTCPay invoice",
      );
    }

    return data;
  }

  async createIntent(
    groupId: string,
    user: User,
    dto: CreateDonationIntentDto,
    request: Request,
  ) {
    await this.ensureGroupAccess(groupId, user);

    if (!this.config.get("donations.enabled")) {
      throw new BadRequestException("Donations are not enabled");
    }

    const fiat = await this.getFiatDisplay(request);
    const amountUsd = dto.amountFiat / fiat.conversionRateFromUsd;
    const provider = this.config.get("donations.provider") || "btcpay";
    const group = await this.ensureGroupAccess(groupId, user);

    const donation = await this.prisma.groupDonation.create({
      data: {
        groupId,
        userId: user.id,
        provider,
        currency: "BTC",
        amountUsd: Number(amountUsd.toFixed(2)),
        status: "pending",
        metadata: JSON.stringify({
          displayCurrency: fiat.currency,
          amountDisplay: dto.amountFiat,
          conversionRateFromUsd: fiat.conversionRateFromUsd,
          note:
            provider === "btcpay"
              ? "BTCPay invoice donation intent. Confirmation is automatic after BTCPay marks the invoice settled."
              : "Manual wallet donation intent. Admin confirmation is required after payment is received.",
        }),
      },
    });

    if (provider === "btcpay") {
      try {
        const invoice = await this.createBtcpayInvoice({
          donationId: donation.id,
          groupId,
          groupName: group.name,
          userId: user.id,
          username: user.username,
          amount: dto.amountFiat,
          currency: fiat.currency,
        });

        await this.prisma.groupDonation.update({
          where: { id: donation.id },
          data: {
            providerInvoiceId: invoice.id,
            metadata: JSON.stringify({
              displayCurrency: fiat.currency,
              amountDisplay: dto.amountFiat,
              conversionRateFromUsd: fiat.conversionRateFromUsd,
              checkoutUrl: invoice.checkoutLink,
              btcpayInvoiceId: invoice.id,
            }),
          },
        });

        return {
          id: donation.id,
          status: donation.status,
          provider,
          currency: donation.currency,
          amountUsd: donation.amountUsd,
          amountDisplay: dto.amountFiat,
          displayCurrency: fiat.currency,
          checkoutUrl: invoice.checkoutLink,
          invoiceId: invoice.id,
          expiresInMinutes: this.getBtcpayConfig().expirationMinutes,
          instructions:
            "Open the BTCPay checkout to get a unique BTC invoice address. The group total updates automatically after the invoice is settled.",
        };
      } catch (error) {
        await this.prisma.groupDonation.update({
          where: { id: donation.id },
          data: {
            status: "failed",
            metadata: JSON.stringify({
              displayCurrency: fiat.currency,
              amountDisplay: dto.amountFiat,
              conversionRateFromUsd: fiat.conversionRateFromUsd,
              error: error instanceof Error ? error.message : "BTCPay invoice failed",
            }),
          },
        });
        throw error;
      }
    }

    const address = this.getWalletAddress();
    if (!address) {
      await this.prisma.groupDonation.update({
        where: { id: donation.id },
        data: { status: "failed" },
      });
      throw new BadRequestException("BTC donations are not configured");
    }

    return {
      id: donation.id,
      status: donation.status,
      provider,
      currency: donation.currency,
      amountUsd: donation.amountUsd,
      amountDisplay: dto.amountFiat,
      displayCurrency: fiat.currency,
      address,
      instructions:
        "Send the selected amount to this wallet, then include the donation ID if you contact support. The group total updates after an admin confirms the payment.",
    };
  }

  private verifyBtcpayWebhook(request: Request & { rawBody?: Buffer }) {
    const btcpay = this.getBtcpayConfig();
    if (!btcpay.webhookSecret) {
      throw new UnauthorizedException("BTCPay webhook secret is not configured");
    }

    const signatureHeader = request.headers["btcpay-sig"];
    const signature =
      typeof signatureHeader === "string"
        ? signatureHeader.replace(/^sha256=/i, "")
        : undefined;

    if (!signature || !request.rawBody) {
      throw new UnauthorizedException("Missing BTCPay webhook signature");
    }

    const expected = crypto
      .createHmac("sha256", btcpay.webhookSecret)
      .update(request.rawBody)
      .digest("hex");

    const providedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid BTCPay webhook signature");
    }
  }

  async handleBtcpayWebhook(request: Request & { rawBody?: Buffer }, payload: any) {
    this.verifyBtcpayWebhook(request);

    const invoiceId = payload?.invoiceId || payload?.invoice?.id || payload?.id;
    const eventType = String(payload?.type || payload?.eventType || "");

    if (!invoiceId) {
      throw new BadRequestException("Missing BTCPay invoice ID");
    }

    const donation = await this.prisma.groupDonation.findFirst({
      where: {
        provider: "btcpay",
        providerInvoiceId: invoiceId,
      },
    });

    if (!donation) {
      return { success: true, ignored: true };
    }

    const normalizedEvent = eventType.toLowerCase();
    let status = donation.status;

    if (
      normalizedEvent.includes("settled") ||
      normalizedEvent.includes("confirmed") ||
      normalizedEvent.includes("completed")
    ) {
      status = "confirmed";
    } else if (normalizedEvent.includes("expired")) {
      status = "expired";
    } else if (normalizedEvent.includes("invalid")) {
      status = "failed";
    } else if (normalizedEvent.includes("paidlate")) {
      status = "paid_late";
    }

    let previousMetadata = {};
    try {
      previousMetadata = donation.metadata ? JSON.parse(donation.metadata) : {};
    } catch {
      previousMetadata = {};
    }
    await this.prisma.groupDonation.update({
      where: { id: donation.id },
      data: {
        status,
        metadata: JSON.stringify({
          ...previousMetadata,
          lastBtcpayEvent: payload,
          lastBtcpayEventAt: new Date().toISOString(),
        }),
      },
    });

    return { success: true, donationId: donation.id, status };
  }

  async listAdminDonations() {
    return await this.prisma.groupDonation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        group: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
      },
      take: 200,
    });
  }

  async updateAdminDonation(id: string, dto: UpdateDonationStatusDto) {
    const donation = await this.prisma.groupDonation.findUnique({ where: { id } });
    if (!donation) {
      throw new NotFoundException("Donation not found");
    }

    return await this.prisma.groupDonation.update({
      where: { id },
      data: {
        status: dto.status,
        txHash: dto.txHash,
        amountCrypto: dto.amountCrypto,
      },
    });
  }
}
